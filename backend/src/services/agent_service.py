"""
This file defines the service that coordinates the interaction between all the agents
"""
import json
import asyncio

from sqlalchemy.orm import Session

from .query_service import QueryService
from .state_service import StateService, CourseState
from ..agents.explainer_agent.agent import CodeReviewAgent
from ..db.crud import chapters_crud, documents_crud, images_crud, questions_crud, courses_crud


from google.adk.sessions import InMemorySessionService

from ..agents.planner_agent import PlannerAgent
from ..agents.explainer_agent import ExplainerAgent
from ..agents.info_agent.agent import InfoAgent

from ..agents.image_agent.agent import ImageAgent

from ..agents.tester_agent import TesterAgent
from ..agents.utils import create_text_query, create_docs_query
from ..db.models.db_course import CourseStatus
from ..api.schemas.course import CourseRequest
from ..services.notification_service import WebSocketConnectionManager
from ..db.models.db_course import Course
from google.genai import types



class AgentService:
    def __init__(self):
        
        # session
        self.session_service = InMemorySessionService()
        self.app_name = "Mentora"
        self.state_manager = StateService()
        self.query_service = QueryService(self.state_manager)
        
        # define agents
        self.info_agent = InfoAgent(self.app_name, self.session_service)
        self.planner_agent = PlannerAgent(self.app_name, self.session_service)
        self.coding_agent = CodeReviewAgent(self.app_name, self.session_service)
        self.tester_agent = TesterAgent(self.app_name, self.session_service)
        self.image_agent = ImageAgent(self.app_name, self.session_service)

    async def get_image(self, user_id: str, request, db: Session, task_id: str, ws_manager: WebSocketConnectionManager):
        """
        Main function for handling the course creation logic. Uses WebSocket for progress.

        Parameters:
        user_id (str): The unique identifier of the user who is creating the course.
        request: info_response
        db (Session): The SQLAlchemy database session.
        task_id (str): The unique ID for this course creation task, used for WebSocket communication.
        ws_manager (NotificationService): Manager to send messages over WebSockets.
        """

        print(f"[{task_id}] Starting ImageAgent")
        image_response = await self.image_agent.run(
            user_id=user_id,
            state={},
            content=create_text_query(request["title"] + "\n\n" + request["description"]),
            debug=True
        )

        print(f"[{task_id}] ImageAgent response: {image_response['image_url']}")
        
        # Save Image to DB
        db_image = db.query(Course).filter(Course.id == request.course_id).first()
        db_image.image_url = image_response['image_url']
        db.commit()
        db.refresh(db_image)
        return db_image


    async def create_course(self, user_id: str, request: CourseRequest, db: Session, task_id: str, ws_manager: WebSocketConnectionManager):
        """
        Main function for handling the course creation logic. Uses WebSocket for progress.

        Parameters:
        user_id (str): The unique identifier of the user who is creating the course.
        request (CourseRequest): A CourseRequest object containing all necessary details for creating a new course.
        db (Session): The SQLAlchemy database session.
        task_id (str): The unique ID for this course creation task, used for WebSocket communication.
        ws_manager (WebSocketConnectionManager): Manager to send messages over WebSockets.
        """
        course_db = None
        try:
            print(f"[{task_id}] Starting course creation for user {user_id}")
            # Create a memory session for the course creation
            session = await self.session_service.create_session(
                app_name=self.app_name,
                user_id=user_id,
                state={}
            )
            session_id = session.id
            print(f"[{task_id}] Session created: {session_id}")

            # Retrieve documents from database
            docs = documents_crud.get_documents_by_ids(db, request.document_ids)
            images = images_crud.get_images_by_ids(db, request.picture_ids)
            print(f"[{task_id}] Retrieved {len(docs)} documents and {len(images)} images.")

            # Get a short course title and description from the info_agent
            info_response = await self.info_agent.run(
                user_id=user_id,
                state={},
                content=self.query_service.get_info_query(request, docs, images)
            )
            print(f"[{task_id}] InfoAgent response: {info_response['title']}")

            # Create course in database
            course_db = courses_crud.create_course(
                db=db,
                session_id=session_id,
                user_id=user_id,
                title=info_response['title'],
                description=info_response['description'],
                total_time_hours=request.time_hours,
                status=CourseStatus.CREATING
            )
            db.commit() # Commit to get course_db.id
            print(f"[{task_id}] Course created in DB with ID: {course_db.id}")


            # Start image Agent
            task = asyncio.create_task(self.get_image(user_id, info_response, db, task_id, ws_manager))

            # Create initial state
            init_state = CourseState(
                query=request.query,
                time_hours=request.time_hours,
            )
            self.state_manager.create_state(user_id, course_db.id, init_state)

            # Bind documents to this course
            for doc in docs:
                documents_crud.update_document(db, int(doc.id), course_id=course_db.id)
            for img in images:
                images_crud.update_image(db, int(img.id), course_id=course_db.id)
            db.commit()
            print(f"[{task_id}] Documents and images bound to course.")

            # Stream the course info first
            course_info_data = {
                "course_id": course_db.id,
                "title": course_db.title,
                "description": course_db.description,
                "session_id": course_db.session_id,
                "total_time_hours": course_db.total_time_hours,
                "status": course_db.status.value
            }
            await ws_manager.send_json_message(task_id, {"type": "course_info", "data": course_info_data})
            print(f"[{task_id}] Sent course_info update.")

            # Query the planner agent
            response_planner = await self.planner_agent.run(
                user_id=user_id,
                state=self.state_manager.get_state(user_id=user_id, course_id=course_db.id),
                content=self.query_service.get_planner_query(request, docs, images),
                debug=False
            )
            print(f"[{task_id}] PlannerAgent responded with {len(response_planner.get('chapters', []))} chapters.")

            # Save chapters to state
            self.state_manager.save_chapters(user_id, course_db.id, response_planner["chapters"])

            # Process each chapter and stream as it's created
            for idx, topic in enumerate(response_planner["chapters"]):
                # Get response from coding agent
                response_code = await self.coding_agent.run(
                    user_id=user_id,
                    state=self.state_manager.get_state(user_id=user_id, course_id=course_db.id),
                    content=self.query_service.get_explainer_query(user_id, course_db.id, idx),
                )

                # Get response from tester agent
                response_tester = await self.tester_agent.run(
                    user_id=user_id,
                    state=self.state_manager.get_state(user_id=user_id, course_id=course_db.id),
                    content=self.query_service.get_tester_query(user_id, course_db.id, idx, response_code["explanation"]),
                )

                # Save the chapter in db first
                chapter_db = chapters_crud.create_chapter(
                    db=db,
                    course_id=course_db.id,
                    index=idx + 1,
                    caption=topic['caption'],
                    summary=json.dumps(topic['content'], indent=2),
                    content=response_code['explanation'],
                    time_minutes=topic['time'],
                )

                # Save questions in db
                question_objects = []
                for q_data in response_tester['questions']:
                    q_db = questions_crud.create_question(
                        db=db,
                        chapter_id=int(chapter_db.id),
                        question=q_data['question'],
                        answer_a=q_data['answer_a'],
                        answer_b=q_data['answer_b'],
                        answer_c=q_data['answer_c'],
                        answer_d=q_data['answer_d'],
                        correct_answer=q_data['correct_answer'],
                        explanation=q_data['explanation']
                    )
                    question_objects.append({
                        "id": q_db.id,
                        "question": q_db.question,
                        "answer_a": q_db.answer_a,
                        "answer_b": q_db.answer_b,
                        "answer_c": q_db.answer_c,
                        "answer_d": q_db.answer_d,
                        "correct_answer": q_db.correct_answer,
                        "explanation": q_db.explanation
                    })
                    print(f"[{task_id}] Saved {len(question_objects)} questions for chapter {chapter_db.id}.")

                    # Build chapter response data
                    chapter_response_data = {
                        "id": chapter_db.id,
                        "index": chapter_db.index,
                        "caption": chapter_db.caption,
                        "summary": chapter_db.summary, # This is JSON string from topic['content']
                        "content": chapter_db.content,
                        "mc_questions": question_objects,
                        "time_minutes": chapter_db.time_minutes,
                        "is_completed": chapter_db.is_completed
                    }
                    await ws_manager.send_json_message(task_id, {"type": "chapter", "data": chapter_response_data})
                    print(f"[{task_id}] Sent chapter update for chapter {chapter_db.id}.")

            # Update course status to finished
            courses_crud.update_course_status(db, course_db.id, CourseStatus.FINISHED)
            db.commit()
            print(f"[{task_id}] Course {course_db.id} status updated to FINISHED.")

            # Wait for image agent to finish
            await task

            # Send completion signal
            await ws_manager.send_json_message(task_id, {
                "type": "complete", 
                "data": {"course_id": course_db.id, "message": "Course created successfully"}
            })
            print(f"[{task_id}] Sent completion signal.")

        except Exception as e:
            error_message = f"Course creation failed: {str(e)}"
            print(f"[{task_id}] Error during course creation: {error_message}")
            # Log detailed error traceback here if possible, e.g., import traceback; traceback.print_exc()
            if course_db and course_db.id:
                try:
                    courses_crud.update_course_status(db, course_db.id, CourseStatus.FAILED)
                    print(f"[{task_id}] Course {course_db.id} status updated to FAILED due to error.")
                except Exception as db_error:
                    print(f"[{task_id}] Additionally, failed to update course status to FAILED: {db_error}")
            
            await ws_manager.send_json_message(task_id, {
                "type": "error", 
                "data": {"message": error_message, "course_id": course_db.id if course_db else None}
            })
            # Re-raise the exception if you want the background task to show as 'failed' in FastAPI logs
            # or if something upstream needs to handle it. For now, we handle it and inform client.
            # raise e 

        finally:
            print(f"[{task_id}] Finished processing create_course background task.")
            # Ensure the database session is closed if it was passed specifically for this task
            # and not managed by FastAPI's Depends. For now, assuming Depends handles it.
            # db.close() # If db session is task-specific and not managed by Depends.

