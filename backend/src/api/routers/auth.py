import base64
from datetime import timedelta
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from authlib.integrations.starlette_client import OAuth, OAuthError
import requests # Add requests for fetching image
import secrets # Added for generating random passwords/suffixes


from ..schemas import user as user_schema # For Pydantic models
from ..schemas import token as token_schema
from ...db.models import db_user as user_model
from ...utils import auth
from ...db.database import get_db
from ...config import settings
from ...db.models.db_user import User as UserModel


api_router = APIRouter(
    prefix="", # Später /auth ???
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)


oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)


# Define /token and /register directly under api_router if you want them prefixed
@api_router.post("/token", response_model=token_schema.Token, tags=["authentication"])
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user: # This check should come first
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not getattr(user, 'is_active', False): # Use getattr for safety, though direct access should work
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "user_id": user.id, "is_admin": user.is_admin, "email": user.email}, # Added email
        expires_delta=access_token_expires,
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "email": user.email, # Added email
        "is_admin": user.is_admin
    }


@api_router.post("/register", response_model=user_schema.User, status_code=status.HTTP_201_CREATED,
                 tags=["Authentication"])
async def register_user(user_data: user_schema.UserCreate, db: Session = Depends(get_db)):
    # Check if username from incoming data (user_data.username) already exists in the DB
    db_user_by_username = db.query(user_model.User).filter(user_model.User.username == user_data.username).first()
    if db_user_by_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    # Check if email from incoming data (user_data.email) already exists in the DB
    db_user_by_email = db.query(user_model.User).filter(user_model.User.email == user_data.email).first()
    if db_user_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    hashed_password = auth.get_password_hash(user_data.password)

    # Generate a unique string ID
    user_id = str(uuid.uuid4())

    # Create an instance of the SQLAlchemy model (user_model.User)
    new_db_user = user_model.User(
        id=user_id,  # Explicitly set the ID
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        is_admin=False,
        is_active=True,  # Default to active
    )

    db.add(new_db_user)
    db.commit()
    db.refresh(new_db_user)
    return new_db_user



@api_router.get("/login/google")
async def login_google(request: Request):
    if oauth.google is None:
        raise RuntimeError("Google OAuth client not registered")
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


@api_router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    print("Google callback received")
    if oauth.google is None:
        raise RuntimeError("Google OAuth client not registered")
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as error:
        print(f"OAuthError: {error}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f'Could not validate credentials: {error.error}',
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    
    user_info = token.get('userinfo')
    if not user_info:
        print("No user info found in token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not fetch user info from Google."
        )

    email = user_info.get("email")
    if not email:
        print("Email not found in user info")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not found in Google user info."
        )
        
    name = user_info.get("name")
    picture_url = user_info.get("picture")

    db_user = db.query(UserModel).filter(UserModel.email == email).first()

    profile_image_base64_data = None
    if picture_url:
        try:
            response = requests.get(picture_url)
            response.raise_for_status() # Raise an exception for bad status codes
            profile_image_base64_data = base64.b64encode(response.content).decode('utf-8')
        except requests.exceptions.RequestException as e:
            print(f"Could not download image from {picture_url}: {e}")
            # Decide how to handle this: proceed without an image, or raise an error
            # For now, let's proceed without an image
            profile_image_base64_data = None


    if not db_user:
        # Create a new user
        # Determine initial username from name or email prefix
        if name:
            # Simple conversion: lowercase, replace spaces with dots, take first 40 chars
            base_username = name.lower().replace(" ", ".")[:40]
        else:
            base_username = email.split("@")[0][:40]

        # Ensure username uniqueness
        username_candidate = base_username
        # Limit username length to fit DB schema (String(50))
        # Max length for base_username part to allow for suffix like ".abc123" (7 chars)
        max_len_for_base_with_suffix = 50 - 8 
        
        # Ensure base_username is not too long if we need to add a suffix
        if len(username_candidate) > max_len_for_base_with_suffix:
            username_candidate = username_candidate[:max_len_for_base_with_suffix]

        final_username = username_candidate
        # Check for collision and append suffix if needed
        while db.query(UserModel).filter(UserModel.username == final_username).first():
            suffix = secrets.token_hex(3) # 6-character hex string
            final_username = f"{username_candidate}.{suffix}" 
            # Ensure the generated username does not exceed 50 chars
            if len(final_username) > 50:
                # If it's too long even with suffix, truncate the base part more aggressively
                # This is a fallback, ideally the initial truncation is enough
                base_part_len = 50 - len(suffix) - 1 # -1 for the dot
                final_username = f"{username_candidate[:base_part_len]}.{suffix}"

        random_password = secrets.token_urlsafe(16)
        hashed_password = auth.get_password_hash(random_password)
        
        db_user = UserModel(
            id=secrets.token_hex(16),  # Generate a random ID for the user
            email=email,
            username=final_username,
            hashed_password=hashed_password,
            # profile_image_base64=profile_image_base64_data, # Store base64 data
            is_active=True,
            is_admin=False 
        )
        if profile_image_base64_data: # Only set if image was successfully fetched
            setattr(db_user, 'profile_image_base64', profile_image_base64_data)

        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    else: # Existing user, update profile image if it changed or was not set
        # Check if the current image in DB is different from the new one, or if DB has no image
        current_db_image = getattr(db_user, 'profile_image_base64', None)
        if profile_image_base64_data and current_db_image != profile_image_base64_data:
            setattr(db_user, 'profile_image_base64', profile_image_base64_data)
            db.commit()
            db.refresh(db_user)
    
    if not getattr(db_user, 'is_active', False): # Use getattr for safety
        print("User is inactive")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User is inactive."
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": db_user.username, "user_id": db_user.id, "is_admin": db_user.is_admin, "email": db_user.email},
        expires_delta=access_token_expires,
    )
    
    # OLD RETURN JSON:
    # return {{
    #     "access_token": access_token,
    #     "token_type": "bearer",
    #     "user_id": db_user.id,
    #     "username": db_user.username,
    #     "email": db_user.email,
    #     "is_admin": db_user.is_admin
    # }}

    # NEW RETURN: Redirect to frontend with token in fragment
    frontend_base_url = settings.FRONTEND_BASE_URL  # Assuming frontend runs on port 3000
    frontend_callback_path = "/auth/google/callback"

    redirect_url_with_fragment = f"{frontend_base_url}{frontend_callback_path}#access_token={access_token}&token_type=bearer&expires_in={auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60}"
    print(f"Redirecting to: {redirect_url_with_fragment}")
    
    return RedirectResponse(url=redirect_url_with_fragment)


