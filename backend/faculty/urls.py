from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    FacultyViewSet,
    FacultyClassesView,
    FacultyClassRiskRadarView,
    FacultyClassAttendanceView,
    FindAbsentStudentView,
)

router = DefaultRouter()
router.register(r'', FacultyViewSet, basename='faculty')

urlpatterns = [
    path('classes/', FacultyClassesView.as_view(), name='faculty-classes'),
    path('classes/<str:pk>/risk-radar/', FacultyClassRiskRadarView.as_view(), name='faculty-class-risk-radar'),
    path('classes/<str:pk>/attendance/', FacultyClassAttendanceView.as_view(), name='faculty-class-attendance'),
    path('periods/<str:period_id>/absent/<str:student_id>/find/', FindAbsentStudentView.as_view(), name='faculty-find-absent'),
] + router.urls
