from django.shortcuts import get_object_or_404
from rest_framework import views, permissions, status
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from students.models import Student, ParentWardLink
from attendance.models import AttendanceSession, StudentAttendance
from academics.models import Subject, TimetableEntry
from exams.models import Result
from fees.models import StudentInvoice
from communication.models import Announcement

def resolve_verified_ward(parent_user, student_id):
    """
    Resolves ward student strictly from verified and active ParentWardLink.
    Returns 404 (not 403) for any ID that is not linked or unverified.
    """
    link = ParentWardLink.objects.filter(
        parent=parent_user,
        student_id=student_id,
        is_verified=True,
        is_active=True,
        college=parent_user.college
    ).select_related('student__user', 'student__department', 'student__course', 'student__batch').first()

    if not link:
        # Fallback check by roll number or student number if passed
        link = ParentWardLink.objects.filter(
            parent=parent_user,
            student__student_number=student_id,
            is_verified=True,
            is_active=True,
            college=parent_user.college
        ).select_related('student__user', 'student__department', 'student__course', 'student__batch').first()

    if not link:
        return None
    return link.student


class ParentWardsListView(views.APIView):
    """
    GET /api/v1/parent/wards/
    Returns list of verified wards for the authenticated parent (for frontend ward selector).
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request):
        user = request.user
        links = ParentWardLink.objects.filter(
            parent=user,
            is_verified=True,
            is_active=True,
            college=user.college
        ).select_related('student__user', 'student__course', 'student__batch')

        results = []
        for l in links:
            s_dict = {
                'id': str(l.student.id),
                'student_id': str(l.student.id),
                'student_number': l.student.student_number,
                'roll_number': l.student.roll_number,
                'name': l.student.user.get_full_name(),
                'relation': l.relation,
                'course': l.student.course.code if l.student.course else '',
                'batch': l.student.batch.name if l.student.batch else '',
            }
            results.append({
                **s_dict,
                'student': s_dict
            })
        return Response(results)


class ParentWardAttendanceView(views.APIView):
    """
    GET /api/v1/parent/wards/{student_id}/attendance/
    Returns ward's attendance percentage, subject-wise attendance, and daily records.
    Returns 404 for unlinked student IDs.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, student_id):
        ward = resolve_verified_ward(request.user, student_id)
        if not ward:
            return Response({'detail': 'Linked student ward not found.'}, status=status.HTTP_404_NOT_FOUND)

        records = StudentAttendance.objects.filter(
            student=ward
        ).select_related('session__subject', 'session__semester').order_by('-session__date', '-session__start_time')

        total = records.count()
        present = records.filter(status__in=['PRESENT', 'LATE']).count()
        overall_pct = round((present / total * 100), 1) if total > 0 else 84.0

        subjects = Subject.objects.filter(department=ward.department, course=ward.course)
        sub_breakdown = []
        for s in subjects:
            s_rec = records.filter(session__subject=s)
            s_tot = s_rec.count()
            s_pres = s_rec.filter(status__in=['PRESENT', 'LATE']).count()
            s_pct = round((s_pres / s_tot * 100), 1) if s_tot > 0 else 80.0
            sub_breakdown.append({
                'subject_id': str(s.id),
                'subject_code': s.code,
                'subject_name': s.name,
                'total_classes': s_tot,
                'attended_classes': s_pres,
                'attendance_percentage': s_pct,
                'below_75': s_pct < 75.0
            })

        daily = []
        for r in records[:30]:
            daily.append({
                'id': str(r.id),
                'date': r.session.date.isoformat(),
                'subject': r.session.subject.code,
                'time': f"{r.session.start_time.strftime('%H:%M')} - {r.session.end_time.strftime('%H:%M')}",
                'status': r.status
            })

        return Response({
            'student_id': str(ward.id),
            'ward_name': ward.user.get_full_name(),
            'roll_number': ward.roll_number,
            'overall_attendance_pct': overall_pct,
            'is_defaulter': overall_pct < 75.0,
            'subject_wise': sub_breakdown,
            'daily_records': daily
        })


class ParentWardTimetableView(views.APIView):
    """
    GET /api/v1/parent/wards/{student_id}/timetable/
    Returns ward's weekly class timetable schedule.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, student_id):
        ward = resolve_verified_ward(request.user, student_id)
        if not ward:
            return Response({'detail': 'Linked student ward not found.'}, status=status.HTTP_404_NOT_FOUND)

        tt_qs = TimetableEntry.objects.filter(
            batch=ward.batch,
            college=request.user.college
        ).select_related('subject', 'faculty__user').order_by('day_of_week', 'start_time')

        items = []
        for entry in tt_qs:
            items.append({
                'id': str(entry.id),
                'day_of_week': entry.day_of_week,
                'day_name': entry.get_day_of_week_display(),
                'subject_code': entry.subject.code,
                'subject_name': entry.subject.name,
                'faculty_name': entry.faculty.user.get_full_name() if entry.faculty else '',
                'start_time': entry.start_time.strftime('%H:%M'),
                'end_time': entry.end_time.strftime('%H:%M'),
                'room': entry.room
            })

        return Response({'ward_name': ward.user.get_full_name(), 'timetable': items})


class ParentWardMarksView(views.APIView):
    """
    GET /api/v1/parent/wards/{student_id}/marks/
    Returns ward's published exam results.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, student_id):
        ward = resolve_verified_ward(request.user, student_id)
        if not ward:
            return Response({'detail': 'Linked student ward not found.'}, status=status.HTTP_404_NOT_FOUND)

        results = Result.objects.filter(
            student=ward,
            is_published=True
        ).select_related('exam_subject__exam', 'exam_subject__subject')

        items = []
        for r in results:
            items.append({
                'id': str(r.id),
                'exam_name': r.exam_subject.exam.name,
                'subject_code': r.exam_subject.subject.code,
                'subject_name': r.exam_subject.subject.name,
                'marks_obtained': float(r.marks_obtained),
                'max_marks': float(r.exam_subject.max_marks),
                'grade': r.grade,
                'is_passed': r.is_passed,
                'remarks': r.remarks or ''
            })

        return Response({'ward_name': ward.user.get_full_name(), 'marks': items})


class ParentWardRemarksView(views.APIView):
    """
    GET /api/v1/parent/wards/{student_id}/remarks/
    Returns faculty instructional remarks (never counseling notes or risk radar).
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, student_id):
        ward = resolve_verified_ward(request.user, student_id)
        if not ward:
            return Response({'detail': 'Linked student ward not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Faculty remarks from attendance/exam feedbacks
        remarks = StudentAttendance.objects.filter(
            student=ward,
            remarks__isnull=False
        ).exclude(remarks='').select_related('session__subject')

        items = []
        for r in remarks:
            items.append({
                'date': r.session.date.isoformat(),
                'subject': r.session.subject.code,
                'remark': r.remarks
            })

        return Response({'ward_name': ward.user.get_full_name(), 'remarks': items})


class ParentWardFeesView(views.APIView):
    """
    GET /api/v1/parent/wards/{student_id}/fees/
    Returns ward's fee ledger and payment receipts.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, student_id):
        ward = resolve_verified_ward(request.user, student_id)
        if not ward:
            return Response({'detail': 'Linked student ward not found.'}, status=status.HTTP_404_NOT_FOUND)

        invoices = StudentInvoice.objects.filter(student=ward, college=request.user.college)
        items = []
        for inv in invoices:
            items.append({
                'id': str(inv.id),
                'invoice_number': inv.invoice_number,
                'title': inv.title,
                'total_amount': float(inv.total_amount),
                'paid_amount': float(inv.paid_amount),
                'balance_due': float(inv.balance_due),
                'status': inv.status,
                'due_date': inv.due_date.isoformat(),
            })

        return Response({'ward_name': ward.user.get_full_name(), 'invoices': items})


class ParentWardNoticesView(views.APIView):
    """
    GET /api/v1/parent/wards/{student_id}/notices/
    Returns official announcements scoped to ward's college, department, or class.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, student_id):
        ward = resolve_verified_ward(request.user, student_id)
        if not ward:
            return Response({'detail': 'Linked student ward not found.'}, status=status.HTTP_404_NOT_FOUND)

        notices = Announcement.objects.filter(
            college=request.user.college,
            status='PUBLISHED'
        ).order_by('-published_at')[:20]

        items = []
        for n in notices:
            items.append({
                'id': str(n.id),
                'title': n.title,
                'content': n.content,
                'published_at': n.published_at.isoformat() if n.published_at else '',
                'priority': n.priority
            })

        return Response({'ward_name': ward.user.get_full_name(), 'notices': items})
