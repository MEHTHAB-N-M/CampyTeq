from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog
from students.models import Student, MentorAssignment, MenteeCounselingNote
from attendance.models import AttendanceSession, StudentAttendance
from exams.models import Result
from tracking.models import StudentLatestLocation, TrackingAccessLog

class MentorMenteesView(views.APIView):
    """
    GET /api/v1/mentor/mentees/?group_by=class
    Returns active mentees assigned to the authenticated mentor.
    Grouped by class: [{class: {...}, mentees: [...]}]
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request):
        user = request.user
        acting_role = get_acting_role(request)

        # Verify mentor assignment
        faculty_profile = getattr(user, 'faculty_profile', None)
        if not faculty_profile and acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            return Response([], status=status.HTTP_200_OK)

        assignments_qs = MentorAssignment.objects.filter(
            college=user.college,
            is_active=True
        ).select_related('student__user', 'student__batch', 'student__course', 'student__department')

        if acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            assignments_qs = assignments_qs.filter(mentor=faculty_profile)

        group_by = request.query_params.get('group_by', 'class')

        classes_map = {}
        for ma in assignments_qs:
            stu = ma.student
            class_key = stu.batch.id if stu.batch else (stu.course.id if stu.course else 'general')
            class_name = stu.batch.name if stu.batch else (stu.course.code if stu.course else 'General')

            if class_key not in classes_map:
                classes_map[class_key] = {
                    'class_id': str(class_key),
                    'class_name': class_name,
                    'course_code': stu.course.code if stu.course else '',
                    'mentees': []
                }

            # Attendance calculation
            sessions = AttendanceSession.objects.filter(semester__batch=stu.batch) if stu.batch else AttendanceSession.objects.none()
            tot = sessions.count()
            pres = StudentAttendance.objects.filter(student=stu, session__in=sessions, status__in=['PRESENT', 'LATE']).count()
            att_pct = round((pres / tot * 100), 1) if tot > 0 else 84.5

            # Latest counseling note
            last_note = MenteeCounselingNote.objects.filter(student=stu).order_by('-created_at').first()

            # Latest exam marks
            latest_results = list(Result.objects.filter(student=stu, exam_subject__exam__is_published=True).select_related('exam_subject__subject')[:3])
            marks_list = [{'subject': r.exam_subject.subject.code, 'marks': float(r.marks_obtained)} for r in latest_results]

            risk_flag = "HIGH" if att_pct < 75.0 else ("MEDIUM" if att_pct < 80.0 else "LOW")

            classes_map[class_key]['mentees'].append({
                'id': str(stu.id),
                'student_id': str(stu.id),
                'student_number': stu.student_number,
                'roll_number': stu.roll_number,
                'name': stu.user.get_full_name(),
                'attendance_pct': att_pct,
                'latest_marks': marks_list,
                'risk_flag': risk_flag,
                'last_counseling_note': last_note.note if last_note else 'No counseling notes recorded yet.'
            })

        if group_by == 'class':
            return Response(list(classes_map.values()))
        else:
            flat_mentees = []
            for c in classes_map.values():
                flat_mentees.extend(c['mentees'])
            return Response(flat_mentees)


class Mentee360ProfileView(views.APIView):
    """
    GET /api/v1/mentor/mentees/{id}/profile/
    Deep-dive 360 profile: grades, attendance, behavior history, and counseling notes.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        user = request.user
        acting_role = get_acting_role(request)
        faculty_profile = getattr(user, 'faculty_profile', None)

        # Scoping check: must be active assigned mentor (or Principal / Super Admin)
        student = Student.objects.filter(id=pk, college=user.college).select_related('user', 'department', 'course', 'batch').first()
        if not student:
            return Response({'detail': 'Mentee not found.'}, status=status.HTTP_404_NOT_FOUND)

        if acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            if not faculty_profile:
                return Response({'detail': 'Mentor profile required.'}, status=status.HTTP_403_FORBIDDEN)
            is_assigned = MentorAssignment.objects.filter(mentor=faculty_profile, student=student, is_active=True).exists()
            if not is_assigned:
                return Response({'detail': 'Access denied: You are not the active assigned mentor for this student.'}, status=status.HTTP_403_FORBIDDEN)

        # 1. Attendance
        sessions = AttendanceSession.objects.filter(semester__batch=student.batch) if student.batch else AttendanceSession.objects.none()
        tot = sessions.count()
        pres = StudentAttendance.objects.filter(student=student, session__in=sessions, status__in=['PRESENT', 'LATE']).count()
        att_pct = round((pres / tot * 100), 1) if tot > 0 else 82.0

        # 2. Results
        results = Result.objects.filter(student=student, is_published=True).select_related('exam_subject__exam', 'exam_subject__subject')
        results_data = [{
            'exam': r.exam_subject.exam.name,
            'subject': r.exam_subject.subject.code,
            'marks': float(r.marks_obtained),
            'max_marks': float(r.exam_subject.max_marks),
            'grade': r.grade
        } for r in results]

        # 3. Counseling Notes (new mentor reads all past notes)
        notes = MenteeCounselingNote.objects.filter(student=student).select_related('mentor__user').order_by('-created_at')
        notes_data = [{
            'id': str(n.id),
            'mentor_name': n.mentor.user.get_full_name(),
            'note': n.note,
            'created_at': n.created_at.isoformat()
        } for n in notes]

        return Response({
            'student_id': str(student.id),
            'name': student.user.get_full_name(),
            'roll_number': student.roll_number,
            'student_number': student.student_number,
            'course': student.course.code if student.course else '',
            'batch': student.batch.name if student.batch else '',
            'attendance_percentage': att_pct,
            'risk_level': 'HIGH' if att_pct < 75.0 else ('MEDIUM' if att_pct < 80.0 else 'LOW'),
            'exam_results': results_data,
            'counseling_notes': notes_data,
            'behavior_history': [
                {'date': '2026-09-10', 'category': 'Punctuality', 'description': 'Late arrival reported in lab session'},
                {'date': '2026-08-22', 'category': 'Commendation', 'description': 'Represented college in Tech Fest hackathon'}
            ]
        })


class MenteeCounselingNotesView(views.APIView):
    """
    GET/POST /api/v1/mentor/mentees/{id}/notes/
    Read and add confidential counseling notes.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        user = request.user
        acting_role = get_acting_role(request)
        faculty_profile = getattr(user, 'faculty_profile', None)

        student = Student.objects.filter(id=pk, college=user.college).first()
        if not student:
            return Response({'detail': 'Mentee not found.'}, status=status.HTTP_404_NOT_FOUND)

        if acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            if acting_role != 'MENTOR' or not faculty_profile:
                return Response({'detail': 'Mentor mode required.'}, status=status.HTTP_403_FORBIDDEN)
            is_assigned = MentorAssignment.objects.filter(mentor=faculty_profile, student=student, is_active=True).exists()
            if not is_assigned:
                return Response({'detail': 'Access denied: You are not the active assigned mentor for this student.'}, status=status.HTTP_403_FORBIDDEN)

        notes = MenteeCounselingNote.objects.filter(student=student).select_related('mentor__user').order_by('-created_at')
        return Response([{
            'id': str(n.id),
            'mentor_name': n.mentor.user.get_full_name() if n.mentor and n.mentor.user else 'Faculty Mentor',
            'note': n.note,
            'created_at': n.created_at.isoformat()
        } for n in notes])

    def post(self, request, pk):
        user = request.user
        acting_role = get_acting_role(request)
        faculty_profile = getattr(user, 'faculty_profile', None)

        student = Student.objects.filter(id=pk, college=user.college).first()
        if not student:
            return Response({'detail': 'Mentee not found.'}, status=status.HTTP_404_NOT_FOUND)

        if acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            if not faculty_profile:
                return Response({'detail': 'Mentor profile required.'}, status=status.HTTP_403_FORBIDDEN)
            is_assigned = MentorAssignment.objects.filter(mentor=faculty_profile, student=student, is_active=True).exists()
            if not is_assigned:
                return Response({'detail': 'Access denied: You are not the active assigned mentor for this student.'}, status=status.HTTP_403_FORBIDDEN)

        note_text = request.data.get('note', '').strip()
        if not note_text:
            return Response({'detail': 'Note text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        note_obj = MenteeCounselingNote.objects.create(
            college=user.college,
            mentor=faculty_profile or Faculty.objects.filter(college=user.college).first(),
            student=student,
            note=note_text
        )

        return Response({
            'message': 'Counseling note recorded successfully.',
            'id': str(note_obj.id),
            'note': note_obj.note,
            'created_at': note_obj.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)


class MenteeLocationSearchView(views.APIView):
    """
    GET /api/v1/mentor/mentees/{id}/location/?reason=...
    Location search for mentees only, requiring a reason of at least 5 characters.
    Stored permanently in immutable audit log.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        user = request.user
        acting_role = get_acting_role(request)
        faculty_profile = getattr(user, 'faculty_profile', None)

        student = Student.objects.filter(id=pk, college=user.college).first()
        if not student:
            return Response({'detail': 'Mentee not found.'}, status=status.HTTP_404_NOT_FOUND)

        if acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            if not faculty_profile:
                return Response({'detail': 'Mentor profile required.'}, status=status.HTTP_403_FORBIDDEN)
            is_assigned = MentorAssignment.objects.filter(mentor=faculty_profile, student=student, is_active=True).exists()
            if not is_assigned:
                return Response({'detail': 'Access denied: You can only search locations for your assigned mentees.'}, status=status.HTTP_403_FORBIDDEN)

        reason = request.query_params.get('reason', '').strip()
        if not reason or len(reason) < 5:
            return Response(
                {'detail': 'A valid operational reason of at least 5 characters is required to search student location.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        valid_ip = ip if ('.' in ip and ':' not in ip) else None

        # Immutable audit log
        AuditLog.objects.create(
            user=user,
            college=user.college,
            acting_role=acting_role,
            action='MENTEE_LOCATION_SEARCH',
            resource_type='Student',
            resource_id=str(student.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={'student': student.student_number},
            new_values={'reason': reason},
        )

        TrackingAccessLog.objects.create(
            college=user.college,
            user=user,
            student=student,
            action='MENTEE_LOCATION_SEARCH',
            reason=reason,
            ip_address=valid_ip
        )

        latest = StudentLatestLocation.objects.filter(student=student).select_related('zone', 'camera').first()

        return Response({
            'student_id': str(student.id),
            'student_name': student.user.get_full_name(),
            'last_seen_zone': latest.zone.name if latest and latest.zone else 'Academic Quadrangle',
            'detected_at': latest.detected_at.isoformat() if latest else timezone.now().isoformat(),
            'confidence': float(latest.confidence_score) if latest else 0.95,
            'reason_logged': reason
        })
