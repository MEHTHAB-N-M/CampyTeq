from django.urls import path
from .views_parent import (
    ParentWardsListView,
    ParentWardAttendanceView,
    ParentWardTimetableView,
    ParentWardMarksView,
    ParentWardRemarksView,
    ParentWardFeesView,
    ParentWardNoticesView,
)

urlpatterns = [
    path('wards/', ParentWardsListView.as_view(), name='parent-wards-list'),
    path('wards/<str:student_id>/attendance/', ParentWardAttendanceView.as_view(), name='parent-ward-attendance'),
    path('wards/<str:student_id>/timetable/', ParentWardTimetableView.as_view(), name='parent-ward-timetable'),
    path('wards/<str:student_id>/marks/', ParentWardMarksView.as_view(), name='parent-ward-marks'),
    path('wards/<str:student_id>/remarks/', ParentWardRemarksView.as_view(), name='parent-ward-remarks'),
    path('wards/<str:student_id>/fees/', ParentWardFeesView.as_view(), name='parent-ward-fees'),
    path('wards/<str:student_id>/notices/', ParentWardNoticesView.as_view(), name='parent-ward-notices'),
]
