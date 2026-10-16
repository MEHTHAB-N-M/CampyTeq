from django.urls import path
from .views_student import StudentAttendanceSelfView

urlpatterns = [
    path('attendance/', StudentAttendanceSelfView.as_view(), name='student-attendance-self'),
]
