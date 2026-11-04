from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, GuardianViewSet, MentorAssignmentViewSet, ParentWardLinkViewSet

router = DefaultRouter()
router.register(r'guardians', GuardianViewSet, basename='guardian')
router.register(r'mentor-assignments', MentorAssignmentViewSet, basename='mentor-assignment')
router.register(r'parent-links', ParentWardLinkViewSet, basename='parent-link')
router.register(r'', StudentViewSet, basename='student')

urlpatterns = router.urls
