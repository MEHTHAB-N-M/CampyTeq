from django.urls import path
from rest_framework.routers import DefaultRouter
from communication.views import (
    AnnouncementViewSet,
    NotificationViewSet,
    DocumentViewSet,
    contact_directory,
)

router = DefaultRouter()
router.register(r"announcements", AnnouncementViewSet, basename="announcements")
router.register(r"notifications", NotificationViewSet, basename="notifications")
router.register(r"documents", DocumentViewSet, basename="documents")

urlpatterns = router.urls + [
    path("contacts/", contact_directory, name="contact-directory"),
]
