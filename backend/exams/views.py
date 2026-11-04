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
from .models import Exam, ExamSubject, Result
from .serializers import ExamSerializer, ExamSubjectSerializer, ResultSerializer


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


class ExamViewSet(viewsets.ModelViewSet):
    serializer_class = ExamSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'batch__name', 'semester__name']
    ordering_fields = ['start_date', 'name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'publish']:
            return [IsAdminOrPrincipal(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Exam.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Exam.objects.none()

        qs = Exam.objects.filter(is_deleted=False, college=user.college).select_related(
            'batch', 'semester', 'college'
        ).prefetch_related('exam_subjects__subject')

        if acting_role == 'STUDENT':
            student_profile = getattr(user, 'student_profile', None)
            if student_profile:
                return qs.filter(batch=student_profile.batch)
            return Exam.objects.none()

        if acting_role == 'PARENT':
            ward_batch_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list('student__batch_id', flat=True)
            return qs.filter(batch_id__in=ward_batch_ids)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(college=user.college)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Authorizes publishing exam results to students and parents."""
        exam = self.get_object()
        exam.is_published = True
        exam.status = 'COMPLETED'
        exam.save()

        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=exam.college,
            user=request.user,
            acting_role=get_acting_role(request),
            action='EXAM_RESULTS_PUBLISHED',
            resource_type='Exam',
            resource_id=str(exam.id),
            ip_address=ip_addr,
            new_values={'exam_name': exam.name, 'is_published': True}
        )
        return Response({'message': f"Results for '{exam.name}' have been officially published."})


class ExamSubjectViewSet(viewsets.ModelViewSet):
    serializer_class = ExamSubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return ExamSubject.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return ExamSubject.objects.none()

        qs = ExamSubject.objects.filter(exam__college=user.college).select_related('exam', 'subject')
        exam_id = self.request.query_params.get('exam_id')
        if exam_id:
            qs = qs.filter(exam_id=exam_id)

        return qs


class ResultViewSet(viewsets.ModelViewSet):
    """
    Manages marks and student results.
    Enforces privacy: students and parents ONLY receive results for published exams.
    Grade changes are audited.
    """
    serializer_class = ResultSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__roll_number', 'student__user__first_name', 'student__user__last_name', 'exam_subject__subject__code']
    ordering_fields = ['marks_obtained', 'student__roll_number']

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Result.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Result.objects.none()

        qs = Result.objects.filter(is_deleted=False, college=user.college).select_related(
            'exam_subject__exam', 'exam_subject__subject', 'student__user', 'college'
        )

        if acting_role == 'STUDENT':
            # Strict rule: student only sees their own marks AND ONLY if exam is published
            return qs.filter(
                student__user=user,
                exam_subject__exam__is_published=True
            )

        if acting_role == 'PARENT':
            # Parent only sees verified linked wards' results AND only if published
            ward_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list('student_id', flat=True)
            return qs.filter(
                student_id__in=ward_ids,
                exam_subject__exam__is_published=True
            )

        faculty_profile = getattr(user, 'faculty_profile', None)

        if acting_role == 'FACULTY':
            if faculty_profile:
                return qs.filter(
                    Q(exam_subject__subject__faculty_assignments__faculty=faculty_profile) |
                    Q(exam_subject__subject__subject_allocations__faculty=faculty_profile)
                ).distinct()
            return Result.objects.none()

        if acting_role == 'LAB_FACULTY':
            if faculty_profile:
                return qs.filter(
                    Q(exam_subject__subject__subject_type__in=['PRACTICAL', 'HYBRID']) &
                    (Q(exam_subject__subject__faculty_assignments__faculty=faculty_profile) |
                     Q(exam_subject__subject__subject_allocations__faculty=faculty_profile))
                ).distinct()
            return Result.objects.none()

        if acting_role == 'CLASS_INCHARGE':
            if faculty_profile:
                incharge_batch_ids = ClassIncharge.objects.filter(
                    faculty=faculty_profile, is_active=True
                ).values_list('class_section__batch_id', flat=True)
                return qs.filter(student__batch_id__in=incharge_batch_ids)
            return Result.objects.none()

        if acting_role == 'MENTOR':
            if faculty_profile:
                assigned_student_ids = MentorAssignment.objects.filter(
                    mentor=faculty_profile, is_active=True
                ).values_list('student_id', flat=True)
                return qs.filter(student_id__in=assigned_student_ids)
            return Result.objects.none()

        if acting_role == 'HOD':
            if faculty_profile and faculty_profile.department:
                return qs.filter(student__department=faculty_profile.department)

        exam_id = self.request.query_params.get('exam_id')
        if exam_id:
            qs = qs.filter(exam_subject__exam_id=exam_id)

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        exam_subject = serializer.validated_data.get('exam_subject')
        faculty_profile = getattr(user, 'faculty_profile', None)

        # Faculty enter internal marks for taught subjects. Lab Faculty enter lab marks.
        if acting_role == 'FACULTY':
            if not faculty_profile or not is_faculty_assigned_to_subject(faculty_profile, exam_subject.subject):
                raise PermissionDenied("Faculty can only enter internal marks for taught subjects.")
        elif acting_role == 'LAB_FACULTY':
            if not faculty_profile or exam_subject.subject.subject_type not in ['PRACTICAL', 'HYBRID'] or not is_faculty_assigned_to_subject(faculty_profile, exam_subject.subject):
                raise PermissionDenied("Lab faculty can only enter lab marks for assigned practical subjects.")
        elif acting_role == 'HOD':
            if not faculty_profile or exam_subject.subject.department_id != faculty_profile.department_id:
                raise PermissionDenied("HOD can only enter marks for subjects in their department.")
        elif acting_role == 'PRINCIPAL':
            pass
        else:
            raise PermissionDenied("You do not have permission to enter marks.")

        result = serializer.save(college=user.college, entered_by=user)
        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=result.college,
            user=user,
            acting_role=acting_role,
            action='RESULT_MARKS_ENTERED',
            resource_type='Result',
            resource_id=str(result.id),
            ip_address=ip_addr,
            new_values={
                'marks_obtained': str(result.marks_obtained),
                'grade': result.grade,
                'student_id': str(result.student_id),
                'exam_subject_id': str(result.exam_subject_id),
            }
        )

    def perform_update(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        instance = self.get_object()
        faculty_profile = getattr(user, 'faculty_profile', None)

        if acting_role == 'FACULTY':
            if not faculty_profile or not is_faculty_assigned_to_subject(faculty_profile, instance.exam_subject.subject):
                raise PermissionDenied("Only the assigned subject faculty can update marks.")
        elif acting_role == 'LAB_FACULTY':
            if not faculty_profile or instance.exam_subject.subject.subject_type not in ['PRACTICAL', 'HYBRID'] or not is_faculty_assigned_to_subject(faculty_profile, instance.exam_subject.subject):
                raise PermissionDenied("Only the assigned lab faculty can update lab marks.")
        elif acting_role == 'HOD':
            if not faculty_profile or instance.exam_subject.subject.department_id != faculty_profile.department_id:
                raise PermissionDenied("HOD can only update marks for subjects in their department.")
        elif acting_role == 'PRINCIPAL':
            pass
        else:
            raise PermissionDenied("You do not have permission to update marks.")

        old_marks = instance.marks_obtained
        old_grade = instance.grade
        result = serializer.save()

        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=result.college,
            user=user,
            acting_role=acting_role,
            action='RESULT_MARKS_CHANGED',
            resource_type='Result',
            resource_id=str(result.id),
            ip_address=ip_addr,
            old_values={'marks_obtained': str(old_marks), 'grade': old_grade},
            new_values={
                'marks_obtained': str(result.marks_obtained),
                'grade': result.grade,
                'student_id': str(result.student_id),
            }
        )

