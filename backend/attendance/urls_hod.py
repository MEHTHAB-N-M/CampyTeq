from django.urls import path
from .views_hod import HODAttendanceClassesView, HODAttendanceClassSubjectsView

urlpatterns = [
    path('attendance/classes/', HODAttendanceClassesView.as_view(), name='hod-attendance-classes'),
    path('attendance/classes/<str:pk>/subjects/', HODAttendanceClassSubjectsView.as_view(), name='hod-attendance-class-subjects'),
]
