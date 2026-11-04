from rest_framework.routers import DefaultRouter
from .views import (
    CourseViewSet,
    BatchViewSet,
    SemesterViewSet,
    SubjectViewSet,
    FacultySubjectViewSet,
    TimetableEntryViewSet,
    SubjectAssignmentViewSet,
)

router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'batches', BatchViewSet, basename='batch')
router.register(r'semesters', SemesterViewSet, basename='semester')
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'faculty-assignments', FacultySubjectViewSet, basename='faculty-assignment')
router.register(r'subject-assignments', SubjectAssignmentViewSet, basename='subject-assignment')
router.register(r'timetable', TimetableEntryViewSet, basename='timetable')

urlpatterns = router.urls
