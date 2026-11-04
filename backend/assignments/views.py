from django.utils import timezone
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsAdminOrPrincipal, IsTenantMember, get_acting_role
from accounts.models import AuditLog
from students.models import Student, ParentWardLink, MentorAssignment
from academics.models import SubjectAssignment, FacultySubject, ClassIncharge
from .models import Assignment, AssignmentSubmission
from .serializers import AssignmentSerializer, AssignmentSubmissionSerializer


def is_faculty_assigned_to_subject(faculty, subject):
    """Checks if a faculty is assigned to the subject via active SubjectAssignment or FacultySubject."""
    today = timezone.now().date()
    has_sa = SubjectAssignment.objects.filter(
        faculty=faculty,
        subject=subject,
        is_active=True,
    ).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=today)
    ).exists()
    if has_sa:
        return True

    return FacultySubject.objects.filter(
        faculty=faculty,
        subject=subject,
    ).exists()


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'subject__name', 'subject__code', 'faculty__user__first_name']
    ordering_fields = ['due_date', 'title']

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Assignment.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Assignment.objects.none()

        qs = Assignment.objects.filter(is_deleted=False, college=user.college).select_related(
            'faculty__user', 'subject', 'batch', 'college'
        )

        if acting_role == 'STUDENT':
            student_profile = getattr(user, 'student_profile', None)
            if student_profile:
                return qs.filter(batch=student_profile.batch)
            return Assignment.objects.none()

        if acting_role == 'PARENT':
            ward_batch_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list('student__batch_id', flat=True)
            return qs.filter(batch_id__in=ward_batch_ids)

        faculty_profile = getattr(user, 'faculty_profile', None)

        if acting_role in ['FACULTY', 'LAB_FACULTY']:
            if faculty_profile:
                return qs.filter(faculty=faculty_profile)
            return Assignment.objects.none()

        if acting_role == 'CLASS_INCHARGE':
            if faculty_profile:
                incharge_batch_ids = ClassIncharge.objects.filter(
                    faculty=faculty_profile, is_active=True
                ).values_list('class_section__batch_id', flat=True)
                return qs.filter(batch_id__in=incharge_batch_ids)
            return Assignment.objects.none()

        if acting_role == 'MENTOR':
            if faculty_profile:
                mentee_batch_ids = MentorAssignment.objects.filter(
                    mentor=faculty_profile, is_active=True
                ).values_list('student__batch_id', flat=True)
                return qs.filter(batch_id__in=mentee_batch_ids)
            return Assignment.objects.none()

        if acting_role == 'HOD':
            if faculty_profile and faculty_profile.department:
                return qs.filter(subject__department=faculty_profile.department)

        subject_id = self.request.query_params.get('subject_id')
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        if acting_role == 'PRINCIPAL':
            return qs

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        faculty = getattr(user, 'faculty_profile', None)

        # Rule: Created only by the faculty (or lab faculty) assigned to that subject and section.
        # Class Incharge, Mentor, and HOD: read-only.
        if acting_role not in ['FACULTY', 'LAB_FACULTY']:
            raise PermissionDenied("Assignments can only be created by the assigned faculty.")

        if not faculty:
            raise PermissionDenied("Faculty profile required.")

        subject = serializer.validated_data.get('subject')
        if not is_faculty_assigned_to_subject(faculty, subject):
            raise PermissionDenied("You can only create assignments for subjects you are actively assigned to teach.")

        assignment = serializer.save(college=user.college, faculty=faculty)
        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=assignment.college,
            user=user,
            acting_role=acting_role,
            action='ASSIGNMENT_CREATED',
            resource_type='Assignment',
            resource_id=str(assignment.id),
            ip_address=ip_addr,
            new_values={
                'title': assignment.title,
                'subject': str(assignment.subject_id),
                'batch': str(assignment.batch_id),
                'due_date': str(assignment.due_date),
            }
        )

    def perform_update(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        instance = self.get_object()

        if acting_role not in ['FACULTY', 'LAB_FACULTY']:
            raise PermissionDenied("Only the assigned faculty can edit this assignment.")

        if instance.faculty_id != user.faculty_profile.id:
            raise PermissionDenied("You can only edit assignments created for your assigned subjects.")

        assignment = serializer.save()
        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=assignment.college,
            user=user,
            acting_role=acting_role,
            action='ASSIGNMENT_UPDATED',
            resource_type='Assignment',
            resource_id=str(assignment.id),
            ip_address=ip_addr,
            new_values={'title': assignment.title, 'status': assignment.status}
        )

    def perform_destroy(self, instance):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role not in ['FACULTY', 'LAB_FACULTY'] or instance.faculty_id != user.faculty_profile.id:
            raise PermissionDenied("Only the assigned faculty can delete this assignment.")
        super().perform_destroy(instance)


class AssignmentSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return AssignmentSubmission.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return AssignmentSubmission.objects.none()

        qs = AssignmentSubmission.objects.filter(
            assignment__college=user.college
        ).select_related(
            'assignment__subject', 'student__user', 'graded_by__user'
        )

        if acting_role == 'STUDENT':
            return qs.filter(student__user=user)

        if acting_role == 'PARENT':
            ward_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list('student_id', flat=True)
            return qs.filter(student_id__in=ward_ids)

        faculty_profile = getattr(user, 'faculty_profile', None)

        if acting_role in ['FACULTY', 'LAB_FACULTY']:
            if faculty_profile:
                return qs.filter(assignment__faculty=faculty_profile)
            return AssignmentSubmission.objects.none()

        if acting_role == 'CLASS_INCHARGE':
            if faculty_profile:
                incharge_batch_ids = ClassIncharge.objects.filter(
                    faculty=faculty_profile, is_active=True
                ).values_list('class_section__batch_id', flat=True)
                return qs.filter(assignment__batch_id__in=incharge_batch_ids)
            return AssignmentSubmission.objects.none()

        if acting_role == 'MENTOR':
            if faculty_profile:
                assigned_student_ids = MentorAssignment.objects.filter(
                    mentor=faculty_profile, is_active=True
                ).values_list('student_id', flat=True)
                return qs.filter(student_id__in=assigned_student_ids)
            return AssignmentSubmission.objects.none()

        if acting_role == 'HOD':
            if faculty_profile and faculty_profile.department:
                return qs.filter(assignment__subject__department=faculty_profile.department)

        if acting_role == 'PRINCIPAL':
            return qs

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)

        if acting_role != 'STUDENT':
            raise PermissionDenied("Only students can submit assignments.")

        student = getattr(user, 'student_profile', None)
        if not student:
            raise PermissionDenied("Active student profile required.")

        assignment = serializer.validated_data['assignment']
        if student.batch_id != assignment.batch_id:
            raise PermissionDenied("Students can only submit assignments for their enrolled batch.")

        is_late = timezone.now() > assignment.due_date
        sub_status = 'LATE' if is_late else 'SUBMITTED'
        serializer.save(student=student, status=sub_status)

    @action(detail=True, methods=['post'])
    def grade(self, request, pk=None):
        """
        Allows assigned faculty to grade submissions.
        Class Incharge, Mentor, and HOD: strictly read-only.
        Grade changes are audited.
        """
        submission = self.get_object()
        user = request.user
        acting_role = get_acting_role(request)
        faculty_profile = getattr(user, 'faculty_profile', None)

        # Rule: Graded only by the faculty (or lab faculty) assigned to that subject.
        # Class Incharge, Mentor, and HOD: read-only.
        if acting_role not in ['FACULTY', 'LAB_FACULTY']:
            raise PermissionDenied("Only the assigned subject faculty can grade submissions.")

        if not faculty_profile or not is_faculty_assigned_to_subject(faculty_profile, submission.assignment.subject):
            raise PermissionDenied("Only the assigned subject faculty can grade submissions.")

        marks = request.data.get('marks_awarded')
        feedback = request.data.get('feedback', '')

        if marks is None:
            return Response({'detail': 'marks_awarded is required.'}, status=status.HTTP_400_BAD_REQUEST)

        old_marks = submission.marks_awarded
        submission.marks_awarded = marks
        submission.feedback = feedback
        submission.status = 'GRADED'
        submission.graded_by = faculty_profile
        submission.graded_at = timezone.now()
        submission.save()

        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        action_name = 'ASSIGNMENT_GRADE_OVERRIDDEN' if old_marks is not None and old_marks != marks else 'ASSIGNMENT_GRADED'
        AuditLog.objects.create(
            college=submission.assignment.college,
            user=user,
            acting_role=acting_role,
            action=action_name,
            resource_type='AssignmentSubmission',
            resource_id=str(submission.id),
            ip_address=ip_addr,
            old_values={'marks_awarded': str(old_marks) if old_marks is not None else None},
            new_values={
                'marks_awarded': str(marks),
                'feedback': feedback,
                'student_id': str(submission.student_id),
                'assignment_id': str(submission.assignment_id),
            }
        )

        return Response(AssignmentSubmissionSerializer(submission).data)
