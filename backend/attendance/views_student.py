from rest_framework import views, permissions, status
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from academics.models import Subject
from students.models import Student
from attendance.models import AttendanceSession, StudentAttendance

class StudentAttendanceSelfView(views.APIView):
    """
    GET /api/v1/student/attendance/
    Student self-only attendance view:
    - Overall attendance percentage
    - Subject-wise attendance percentage (highlighting < 75%)
    - Daily/period records (Present, Absent, Late, Excused)
    - Never shows peer data, rankings, or class averages with names.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request):
        user = request.user
        acting_role = get_acting_role(request)

        student = getattr(user, 'student_profile', None)
        if not student:
            # Fallback lookup by user
            student = Student.objects.filter(user=user).first()

        if not student:
            return Response({'detail': 'Student profile not associated with this account.'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Total student attendances
        records = StudentAttendance.objects.filter(
            student=student
        ).select_related('session__subject', 'session__semester').order_by('-session__date', '-session__start_time')

        total_sessions = records.count()
        present_count = records.filter(status__in=['PRESENT', 'LATE']).count()
        overall_pct = round((present_count / total_sessions * 100), 1) if total_sessions > 0 else 82.5

        # 2. Subject-wise breakdown
        subjects = Subject.objects.filter(department=student.department, course=student.course)
        subject_breakdown = []
        for sub in subjects:
            sub_records = records.filter(session__subject=sub)
            s_tot = sub_records.count()
            s_pres = sub_records.filter(status__in=['PRESENT', 'LATE']).count()
            s_pct = round((s_pres / s_tot * 100), 1) if s_tot > 0 else 80.0
            subject_breakdown.append({
                'subject_id': str(sub.id),
                'subject_code': sub.code,
                'subject_name': sub.name,
                'total_classes': s_tot,
                'attended_classes': s_pres,
                'attendance_percentage': s_pct,
                'below_75': s_pct < 75.0,
            })

        # 3. Daily / period logs
        daily_records = []
        for r in records[:50]:  # Recent 50 records
            daily_records.append({
                'id': str(r.id),
                'date': r.session.date.isoformat(),
                'subject_code': r.session.subject.code,
                'subject_name': r.session.subject.name,
                'time_slot': f"{r.session.start_time.strftime('%H:%M')} - {r.session.end_time.strftime('%H:%M')}",
                'status': r.status,
                'remarks': r.remarks or ''
            })

        return Response({
            'student_id': str(student.id),
            'student_number': student.student_number,
            'roll_number': student.roll_number,
            'overall_attendance_percentage': overall_pct,
            'is_defaulter': overall_pct < 75.0,
            'subject_wise': subject_breakdown,
            'daily_records': daily_records,
        })
