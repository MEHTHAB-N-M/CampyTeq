from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IngestDetectionView,
    DetectionEventViewSet,
    StudentLastSeenView,
    TrackingAuditLogViewSet,
    BiometricProfileViewSet,
    FaceEnrollmentViewSet,
)

router = DefaultRouter()
router.register(r'detections', DetectionEventViewSet, basename='tracking-detections')
router.register(r'audit-logs', TrackingAuditLogViewSet, basename='tracking-audit-logs')
router.register(r'biometrics', BiometricProfileViewSet, basename='tracking-biometrics')
router.register(r'face-enrollment', FaceEnrollmentViewSet, basename='tracking-face-enrollment')

urlpatterns = [
    path('ingest/', IngestDetectionView.as_view(), name='tracking-ingest'),
    path('last-seen/', StudentLastSeenView.as_view(), name='tracking-last-seen'),
    path('my-searches/', TrackingAuditLogViewSet.as_view({'get': 'my_searches'}), name='tracking-my-searches'),
    path('', include(router.urls)),
]
