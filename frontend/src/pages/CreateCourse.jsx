import { useState, useEffect } from 'react';
import { useTranslation, useI18n } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Title, 
  TextInput, 
  NumberInput, 
  Button, 
  Text, 
  Paper, 
  Stepper,
  Group,
  Textarea,
  FileInput,
  Alert,
  Loader,
  Progress,
  Card,
  List,
  Badge,
  SimpleGrid,
  Select
} from '@mantine/core';
import { IconUpload, IconAlertCircle, IconCheck, IconPhoto, IconFileText } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { toast } from 'react-toastify';
import { courseService } from '../api/courseService';

function CreateCourse() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('createCourse');
  const [active, setActive] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  
  const form = useForm({
    initialValues: {
      query: '',
      time_hours: 2,
      language: i18n.language,
      difficulty: 'university',
      documents: [],
      images: [],
    },
    validate: {
      query: (value) => (!value ? t('form.validation.topicRequired') : null),
      time_hours: (value) => (value <= 0 ? t('form.validation.timePositive') : null),
      difficulty: (value) => (!value ? t('form.validation.difficultyRequired') : null),
    },
  });

  const handleDocumentUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const documentData = await courseService.uploadDocument(file);
      setUploadedDocuments(prev => [...prev, documentData]);
      toast.success(t('toast.documentUploadSuccess', { fileName: file.name }));
      return documentData;
    } catch (err) {
      console.error('Error uploading document:', err);
      toast.error(t('toast.documentUploadError', { error: err.message || t('errors.unknown') }));
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const imageData = await courseService.uploadImage(file);
      setUploadedImages(prev => [...prev, imageData]);
      toast.success(t('toast.imageUploadSuccess', { fileName: file.name }));
      return imageData;
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error(t('toast.imageUploadError', { error: err.message || t('errors.unknown') }));
      return null;
    } finally {
      setIsUploading(false);
    }
  };  

  const handleSubmit = async () => {
    if (form.validate().hasErrors) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const documentIds = uploadedDocuments.map(doc => doc.id);
      const imageIds = uploadedImages.map(img => img.id);

      const data = await courseService.createCourse(
        { 
          query: form.values.query,
          time_hours: form.values.time_hours,
          language: form.values.language,
          difficulty: form.values.difficulty,
          document_ids: documentIds,
          picture_ids: imageIds,
        }
      );

      console.log('Course creation initiated:', data);
      navigate(`/dashboard/courses/${data.course_id}`);
      
    } catch (err) { 
      console.error('Error initiating course creation:', err);
      const errorMessage = err.response?.data?.detail || err.message || t('errors.courseCreationDefault');
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setActive((current) => (current < 2 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  const handleMultipleDocuments = async (files) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
      await handleDocumentUpload(file);
    }
    form.setFieldValue('documents', [...form.values.documents, ...files]);
  };

  const handleMultipleImages = async (files) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
      await handleImageUpload(file);
    }
    form.setFieldValue('images', [...form.values.images, ...files]);
  };

  return (
    <Container size="md" py="xl">
      <Title order={1} align="center" mb="xl">{t('title')}</Title>

      {isSubmitting ? (
        <Paper shadow="md" p="xl" withBorder>
          <Title order={3} align="center" mb="md">{t('streaming.title')}</Title>
          <Text align="center" mb="md">{t('streaming.description')}</Text>
        </Paper>
      ) : (
        <Paper shadow="md" p="xl" withBorder>
          <Stepper active={active} onStepClick={setActive} breakpoint="sm" mb="xl">
            <Stepper.Step label={t('stepper.details.label')} description={t('stepper.details.description')}>
              <Textarea
                label={t('form.topic.label')}
                placeholder={t('form.topic.placeholder')}
                required
                autosize
                minRows={3}
                mb="md"
                {...form.getInputProps('query')}
              />
              <NumberInput
                label={t('form.duration.label')}
                description={t('form.duration.description')}
                required
                min={1}
                max={100}
                mb="md"
                {...form.getInputProps('time_hours')}
              />
              
              <Select
                label={t('form.language.label')}
                placeholder={t('form.language.placeholder')}
                data={[
                  { value: 'en', label: t('form.language.options.english') },
                  { value: 'de', label: t('form.language.options.german') },
                ]}
                mb="md"
                clearable={false}
                {...form.getInputProps('language')}
              />
              
              <Select
                label={t('form.difficulty.label')}
                placeholder={t('form.difficulty.placeholder')}
                data={[
                  { value: 'beginner', label: t('form.difficulty.options.beginner') },
                  { value: 'intermediate', label: t('form.difficulty.options.intermediate') },
                  { value: 'advanced', label: t('form.difficulty.options.advanced') },
                  { value: 'university', label: t('form.difficulty.options.university') },
                ]}
                required
                mb="md"
                {...form.getInputProps('difficulty')}
              />
            </Stepper.Step>

            <Stepper.Step label={t('stepper.uploads.label')} description={t('stepper.uploads.description')}>
              <Text size="sm" mb="xs">{t('form.uploads.description')}</Text>
              <Group grow align="start">
                <div>
                  <FileInput
                    label={t('form.documents.label')}
                    placeholder={t('form.documents.placeholder')}
                    accept=".pdf,.doc,.docx,.txt"
                    icon={<IconFileText size={14} />}
                    onChange={handleMultipleDocuments}
                    multiple
                    mb="sm"
                    disabled={isUploading || isSubmitting}
                  />
                  {uploadedDocuments.length > 0 && (
                    <>
                      <Text size="sm" weight={500} mb="xs">{t('form.documents.uploadedTitle')}</Text>
                      <List size="sm" spacing="xs" mb="md">
                        {uploadedDocuments.map((doc) => (
                          <List.Item key={doc.id} icon={<IconFileText size={14} />}>
                            {t('form.documents.fileEntry', { fileName: doc.filename, sizeKB: Math.round(doc.size / 1024) })}
                          </List.Item>
                        ))}
                      </List>
                    </>
                  )}
                </div>
                
                <div>
                  <FileInput
                    label={t('form.images.label')}
                    placeholder={t('form.images.placeholder')}
                    accept="image/*"
                    icon={<IconPhoto size={14} />}
                    onChange={handleMultipleImages}
                    multiple
                    mb="sm"
                    disabled={isUploading || isSubmitting}
                  />
                  {uploadedImages.length > 0 && (
                    <>
                      <Text size="sm" weight={500} mb="xs">{t('form.images.uploadedTitle')}</Text>
                      <List size="sm" spacing="xs" mb="md">
                        {uploadedImages.map((img) => (
                          <List.Item key={img.id} icon={<IconPhoto size={14} />}>
                            {t('form.images.fileEntry', { fileName: img.filename, sizeKB: Math.round(img.size / 1024) })}
                          </List.Item>
                        ))}
                      </List>
                    </>
                  )}
                </div>
              </Group>
              
              {(uploadedDocuments.length > 0 || uploadedImages.length > 0) && (
                <Text size="sm" color="dimmed" mb="md">
                  {t('form.uploads.personalizedExperience')}
                </Text>
              )}
            </Stepper.Step>

            <Stepper.Step label={t('stepper.review.label')} description={t('stepper.review.description')}>
              <Text mb="md">{t('form.review.title')}</Text>
              <Card withBorder p="md" mb="md">
                <Text><strong>{t('form.topic.label')}:</strong> {form.values.query || t('form.review.notSet')}</Text>
                <Text><strong>{t('form.duration.label')}:</strong> {form.values.time_hours ? t('form.duration.value', { count: form.values.time_hours }) : t('form.review.notSet')}</Text>
                <Text><strong>{t('form.documents.uploadedTitle')}:</strong> {uploadedDocuments.length > 0 ? uploadedDocuments.map(d => d.filename).join(', ') : t('form.review.none')}</Text>
                <Text><strong>{t('form.images.uploadedTitle')}:</strong> {uploadedImages.length > 0 ? uploadedImages.map(i => i.filename).join(', ') : t('form.review.none')}</Text>
              </Card>
              <Text size="sm" color="dimmed">{t('form.review.confirmation')}</Text>
            </Stepper.Step>
          </Stepper>

          {error && !isSubmitting && (
            <Alert 
              icon={<IconAlertCircle size={16} />}
              title={t('form.error.alertTitle')} 
              color="red" 
              mb="lg"
            >
              {error}
            </Alert>
          )}

          {isUploading && (
            <Alert 
              icon={<Loader size={16} />}
              title={t('alert.uploading.title')} 
              color="blue" 
              mb="lg"
            >
              {t('alert.uploading.message')}
            </Alert>
          )}

          <Group position="right" mt="xl">
            {active > 0 && (
              <Button variant="default" onClick={prevStep} disabled={isSubmitting || isUploading}>
                {t('buttons.back')}
              </Button>
            )}
            {active < 2 ? (
              <Button onClick={nextStep} disabled={isSubmitting || isUploading}>
                {t('buttons.nextStep')}
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                loading={isSubmitting} 
                disabled={isSubmitting || isUploading || (form.values.query === '')} 
              >
                {isSubmitting ? t('buttons.creating') : t('buttons.createCourse')}
              </Button>
            )}
          </Group>
        </Paper>
      )}
    </Container>
  );
}

export default CreateCourse;