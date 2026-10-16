from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import LibraryBookingViewSet, LibraryAvailabilityView

router = DefaultRouter()
router.register(r'bookings', LibraryBookingViewSet, basename='library-bookings')

urlpatterns = [
    path('availability/', LibraryAvailabilityView.as_view(), name='library-availability'),
    path('pending/', LibraryBookingViewSet.as_view({'get': 'pending'}), name='library-pending-alias'),
] + router.urls
