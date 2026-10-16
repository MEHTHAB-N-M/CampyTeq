from django.urls import path
from .views_mentor import (
    MentorMenteesView,
    Mentee360ProfileView,
    MenteeCounselingNotesView,
    MenteeLocationSearchView,
)

urlpatterns = [
    path('mentees/', MentorMenteesView.as_view(), name='mentor-mentees-list'),
    path('mentees/<str:pk>/profile/', Mentee360ProfileView.as_view(), name='mentor-mentee-profile'),
    path('mentees/<str:pk>/notes/', MenteeCounselingNotesView.as_view(), name='mentor-mentee-notes'),
    path('mentees/<str:pk>/location/', MenteeLocationSearchView.as_view(), name='mentor-mentee-location'),
]
