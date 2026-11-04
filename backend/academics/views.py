from datetime import datetime
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from common.permissions import IsAdminOrPrincipal, IsAdminPrincipalOrHOD, IsTenantMember, get_acting_role
from accounts.models import AuditLog
from students.models import ParentWardLink
from .models import Course, Batch, Semester, Subject, FacultySubject, TimetableEntry, SubjectAssignment, ClassSection, ClassIncharge
from .serializers import (
    CourseSerializer,
    BatchSerializer,
    SemesterSerializer,
    SubjectSerializer,
    FacultySubjectSerializer,
    TimetableEntrySerializer,
    SubjectAssignmentSerializer,
)

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'department__name']
    ordering_fields = ['name', 'code', 'created_at']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrPrincipal(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Course.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Course.objects.none()

        qs = Course.objects.filter(is_deleted=False).select_related('department', 'college').prefetch_related('batches')
        if acting_role == 'PRINCIPAL':
            if user.college:
                return qs.filter(college=user.college)
            return qs
        return qs.filter(college=user.college)

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class BatchViewSet(viewsets.ModelViewSet):
    serializer_class = BatchSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'course__name', 'course__code']
    ordering_fields = ['start_date', 'name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrPrincipal(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Batch.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Batch.objects.none()

        qs = Batch.objects.filter(is_deleted=False).select_related('course', 'college').prefetch_related('semesters')
        course_id = self.request.query_params.get('course_id')
        if course_id:
            qs = qs.filter(course_id=course_id)

        if acting_role == 'PRINCIPAL':
            if user.college:
                return qs.filter(college=user.college)
            return qs
        return qs.filter(college=user.college)

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class SemesterViewSet(viewsets.ModelViewSet):
    serializer_class = SemesterSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['semester_number']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrPrincipal(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Semester.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Semester.objects.none()

        qs = Semester.objects.filter(is_deleted=False).select_related('batch__course', 'college')
        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)

        if acting_role == 'PRINCIPAL':
            if user.college:
                return qs.filter(college=user.college)
            return qs
        return qs.filter(college=user.college)

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'course__code']
    ordering_fields = ['semester_number', 'code', 'name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrPrincipal(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Subject.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return Subject.objects.none()

        qs = Subject.objects.filter(is_deleted=False).select_related('course', 'department', 'college')
        course_id = self.request.query_params.get('course_id')
        if course_id:
            qs = qs.filter(course_id=course_id)

        sem_num = self.request.query_params.get('semester')
        if sem_num:
            qs = qs.filter(semester_number=sem_num)

        if acting_role == 'PRINCIPAL':
            if user.college:
                return qs.filter(college=user.college)
            return qs
        return qs.filter(college=user.college)

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class FacultySubjectViewSet(viewsets.ModelViewSet):
    serializer_class = FacultySubjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return FacultySubject.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return FacultySubject.objects.none()

        qs = FacultySubject.objects.filter(is_deleted=False).select_related(
            'subject', 'faculty__user', 'batch', 'college'
        )
        faculty_id = self.request.query_params.get('faculty_id')
        if faculty_id:
            qs = qs.filter(faculty_id=faculty_id)

        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)

        if acting_role == 'PRINCIPAL':
            if user.college:
                return qs.filter(college=user.college)
            return qs
        return qs.filter(college=user.college)

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class TimetableEntryViewSet(viewsets.ModelViewSet):
    serializer_class = TimetableEntrySerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['day_of_week', 'start_time']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminPrincipalOrHOD(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return TimetableEntry.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return TimetableEntry.objects.none()

        qs = TimetableEntry.objects.filter(is_deleted=False, college=user.college).select_related(
            'course', 'batch', 'semester', 'subject', 'faculty__user', 'college'
        )

        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)

        day = self.request.query_params.get('day_of_week')
        if day:
            qs = qs.filter(day_of_week=day)

        if acting_role == 'STUDENT':
            student_profile = getattr(user, 'student_profile', None)
            if student_profile:
                return qs.filter(batch=student_profile.batch)
            return TimetableEntry.objects.none()

        if acting_role == 'PARENT':
            ward_batch_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list('student__batch_id', flat=True)
            return qs.filter(batch_id__in=ward_batch_ids)

        if acting_role in ['FACULTY', 'LAB_FACULTY']:
            faculty_profile = getattr(user, 'faculty_profile', None)
            if faculty_profile:
                return qs.filter(faculty=faculty_profile)
            return TimetableEntry.objects.none()

        if acting_role == 'CLASS_INCHARGE':
            faculty_profile = getattr(user, 'faculty_profile', None)
            incharge_batch_ids = ClassIncharge.objects.filter(
                faculty=faculty_profile, is_active=True
            ).values_list('class_section__batch_id', flat=True)
            return qs.filter(batch_id__in=incharge_batch_ids)

        if acting_role == 'HOD':
            faculty_profile = getattr(user, 'faculty_profile', None)
            if faculty_profile and faculty_profile.department:
                return qs.filter(course__department=faculty_profile.department)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        course = serializer.validated_data.get('course')

        if acting_role == 'HOD':
            faculty_profile = getattr(user, 'faculty_profile', None)
            if not faculty_profile or not course or course.department_id != faculty_profile.department_id:
                raise PermissionDenied("HOD can only author timetable entries for courses in their department.")
            serializer.save(college=user.college)
        elif acting_role == 'PRINCIPAL':
            serializer.save(college=user.college)
        else:
            raise PermissionDenied("You do not have permission to author the timetable.")

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Returns today's classes tailored to the authenticated student or faculty member."""
        user = request.user
        acting_role = get_acting_role(request)
        from django.utils import timezone
        today_weekday = timezone.now().isoweekday()
        day_query = 1 if today_weekday > 6 else today_weekday

        qs = self.get_queryset().filter(day_of_week=day_query)
        serializer = self.get_serializer(qs, many=True)
        return Response({
            'day_of_week': day_query,
            'classes': serializer.data,
            'total': qs.count()
        })


class SubjectAssignmentViewSet(viewsets.ModelViewSet):
    """
    CRUD for SubjectAssignment (HOD authors subject allocations, primary & substitute teachers).
    Scoped strictly by college and HOD department.
    """
    serializer_class = SubjectAssignmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['subject__name', 'subject__code', 'faculty__user__first_name', 'faculty__user__last_name']
    ordering_fields = ['created_at', 'end_date']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminPrincipalOrHOD(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return SubjectAssignment.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == 'SUPER_ADMIN':
            return SubjectAssignment.objects.none()

        qs = SubjectAssignment.objects.filter(is_deleted=False, college=user.college).select_related(
            'department', 'faculty__user', 'subject', 'class_section'
        )

        if acting_role in ['FACULTY', 'LAB_FACULTY']:
            faculty_profile = getattr(user, 'faculty_profile', None)
            if faculty_profile:
                return qs.filter(faculty=faculty_profile)
            return SubjectAssignment.objects.none()

        if acting_role == 'CLASS_INCHARGE':
            faculty_profile = getattr(user, 'faculty_profile', None)
            incharge_sections = ClassIncharge.objects.filter(
                faculty=faculty_profile, is_active=True
            ).values_list('class_section_id', flat=True)
            return qs.filter(class_section_id__in=incharge_sections)

        if acting_role == 'HOD':
            faculty_profile = getattr(user, 'faculty_profile', None)
            if faculty_profile and faculty_profile.department:
                return qs.filter(department=faculty_profile.department)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        dept = serializer.validated_data.get('department')
        if not dept:
            subject = serializer.validated_data.get('subject')
            dept = subject.department if subject else None

        if acting_role == 'HOD':
            faculty_profile = getattr(user, 'faculty_profile', None)
            if not faculty_profile or not dept or dept.id != faculty_profile.department_id:
                raise PermissionDenied("HODs can only assign subjects within their own department.")
            sa = serializer.save(college=user.college, department=faculty_profile.department)
        elif acting_role == 'PRINCIPAL':
            sa = serializer.save(college=user.college)
        else:
            raise PermissionDenied("Only HOD or Principal can author subject assignments.")

        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=sa.college,
            user=user,
            acting_role=acting_role,
            action='SUBJECT_ASSIGNMENT_CREATED',
            resource_type='SubjectAssignment',
            resource_id=str(sa.id),
            ip_address=ip_addr,
            new_values={
                'faculty': str(sa.faculty_id),
                'subject': str(sa.subject_id),
                'class_section': str(sa.class_section_id),
                'end_date': str(sa.end_date) if sa.end_date else None,
                'is_active': sa.is_active,
            }
        )

    def perform_update(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        instance = self.get_object()

        if acting_role == 'HOD':
            faculty_profile = getattr(user, 'faculty_profile', None)
            if not faculty_profile or instance.department_id != faculty_profile.department_id:
                raise PermissionDenied("HODs can only modify subject assignments within their own department.")

        sa = serializer.save()
        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=sa.college,
            user=user,
            acting_role=acting_role,
            action='SUBJECT_ASSIGNMENT_UPDATED',
            resource_type='SubjectAssignment',
            resource_id=str(sa.id),
            ip_address=ip_addr,
            new_values={
                'end_date': str(sa.end_date) if sa.end_date else None,
                'is_active': sa.is_active,
            }
        )

