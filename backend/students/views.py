import csv
import io
from django.utils import timezone
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from common.permissions import IsAdminOrPrincipal, IsTenantMember, IsAdminPrincipalOrHOD, get_acting_role
from accounts.models import User, AuditLog
from academics.models import Course, Batch, Semester
from departments.models import Department
from .models import Student, Guardian, StudentGuardian, MentorAssignment, ParentWardLink
from .serializers import (
    StudentSerializer,
    StudentDetailSerializer,
    GuardianSerializer,
    StudentGuardianSerializer,
    MentorAssignmentSerializer,
    ParentWardLinkSerializer,
)

class StudentViewSet(viewsets.ModelViewSet):
    """
    CRUD for Students with strict multi-tenant isolation and role scoping:
    - Mentors can only access students assigned to them.
    - Students can only view their own record.
    - Parents can only view their linked wards.
    - Administrators, HODs, and Faculty have college-wide student access.
    """
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'student_number',
        'roll_number',
        'user__first_name',
        'user__last_name',
        'user__email',
        'course__code',
        'course__name',
    ]
    ordering_fields = ['roll_number', 'student_number', 'admission_date', 'user__first_name']

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'bulk_import']:
            return [IsAdminPrincipalOrHOD(), IsTenantMember()]
        return [permissions.IsAuthenticated(), IsTenantMember()]

    def get_serializer_class(self):
        if self.action in ['retrieve']:
            return StudentDetailSerializer
        return StudentSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Student.objects.none()

        acting_role = get_acting_role(self.request)

        qs = Student.objects.filter(is_deleted=False).select_related(
            'user', 'department', 'course', 'batch', 'current_semester', 'mentor__user', 'college'
        )

        # Principal access
        if acting_role == 'PRINCIPAL':
            if user.college:
                return self._apply_filters(qs.filter(college=user.college))
            return self._apply_filters(qs)

        # Multi-tenant isolation: strictly scope to user's college
        qs = qs.filter(college=user.college)

        # Role-based scoping:
        if acting_role == 'STUDENT':
            return qs.filter(user=user)

        if acting_role == 'PARENT':
            return qs.filter(guardian_relations__guardian__user=user)

        if acting_role == 'MENTOR':
            # Scoped strictly to mentor's assigned cohort
            faculty_profile = getattr(user, 'faculty_profile', None)
            if faculty_profile:
                from django.db.models import Q
                return self._apply_filters(
                    qs.filter(
                        Q(mentor=faculty_profile) |
                        Q(mentor_assignments__mentor=faculty_profile, mentor_assignments__is_active=True)
                    ).distinct()
                )
            return Student.objects.none()

        return self._apply_filters(qs)

    def _apply_filters(self, qs):
        dept_id = self.request.query_params.get('department_id')
        if dept_id:
            qs = qs.filter(department_id=dept_id)

        course_id = self.request.query_params.get('course_id')
        if course_id:
            qs = qs.filter(course_id=course_id)

        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def perform_create(self, serializer):
        caller = self.request.user
        acting_role = get_acting_role(self.request)
        dept = serializer.validated_data.get('department')

        # HODs can only enroll students in their own department
        if acting_role == 'HOD':
            faculty_profile = getattr(caller, 'faculty_profile', None)
            if faculty_profile and dept and dept.id != faculty_profile.department_id:
                raise PermissionDenied("HODs can only enroll students in their own department.")

        student = serializer.save(college=caller.college)

        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=student.college,
            user=caller,
            acting_role=acting_role,
            action='STUDENT_ENROLLED',
            resource_type='Student',
            resource_id=str(student.id),
            ip_address=ip_addr,
            new_values={'student_number': student.student_number, 'roll_number': student.roll_number}
        )

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        caller = request.user
        acting_role = get_acting_role(request)
        if acting_role not in ['PRINCIPAL', 'SUPER_ADMIN', 'HOD']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        hod_dept_id = None
        if acting_role == 'HOD':
            faculty_profile = getattr(caller, 'faculty_profile', None)
            if not faculty_profile:
                return Response({'detail': 'Active faculty profile required for HOD.'}, status=status.HTTP_403_FORBIDDEN)
            hod_dept_id = faculty_profile.department_id

        file_obj = request.FILES.get('file')
        csv_text = request.data.get('csv_data', '')
        if file_obj:
            content = file_obj.read().decode('utf-8-sig')
        elif csv_text:
            content = csv_text
        else:
            return Response({'detail': 'Please provide a CSV file or csv_data string.'}, status=status.HTTP_400_BAD_REQUEST)

        reader = csv.DictReader(io.StringIO(content))
        enrolled_students = []

        for row in reader:
            roll_number = row.get('roll_number', '').strip()
            email = row.get('email', '').strip()
            first_name = row.get('first_name', '').strip()
            last_name = row.get('last_name', '').strip()
            dept_id = row.get('department_id', '').strip()
            course_id = row.get('course_id', '').strip()
            batch_id = row.get('batch_id', '').strip()

            if not roll_number or not email or not first_name:
                continue

            dept = None
            if hod_dept_id:
                dept = Department.objects.filter(id=hod_dept_id, college=caller.college).first()
            elif dept_id:
                dept = Department.objects.filter(id=dept_id, college=caller.college).first() or Department.objects.filter(code=dept_id, college=caller.college).first()

            if not dept:
                continue

            course = Course.objects.filter(id=course_id, college=caller.college).first() or Course.objects.filter(code=course_id, college=caller.college).first() if course_id else None
            batch = Batch.objects.filter(id=batch_id, college=caller.college).first() or Batch.objects.filter(name=batch_id, college=caller.college).first() if batch_id else None

            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'STUDENT',
                    'college': caller.college,
                    'status': 'ACTIVE',
                }
            )
            if not user.password:
                user.set_password('Password123!')
                user.save()

            student, _ = Student.objects.get_or_create(
                user=user,
                college=caller.college,
                defaults={
                    'student_number': roll_number,
                    'roll_number': roll_number,
                    'department': dept,
                    'course': course,
                    'batch': batch,
                    'admission_date': timezone.now().date(),
                }
            )
            enrolled_students.append(student.roll_number)

        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=caller.college,
            user=caller,
            acting_role=acting_role,
            action='STUDENT_BULK_ENROLLED',
            resource_type='Student',
            resource_id=f"count:{len(enrolled_students)}",
            ip_address=ip_addr,
            new_values={'count': len(enrolled_students), 'students': enrolled_students}
        )

        return Response({
            'success': True,
            'enrolled_count': len(enrolled_students),
            'students': enrolled_students,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Allows a logged-in student to retrieve their own full academic profile."""
        student = Student.objects.filter(user=request.user, is_deleted=False).first()
        if not student:
            return Response({'detail': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = StudentDetailSerializer(student)
        return Response(serializer.data)


class GuardianViewSet(viewsets.ModelViewSet):
    serializer_class = GuardianSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'PRINCIPAL':
            if user.college:
                return Guardian.objects.filter(college=user.college, is_deleted=False)
            return Guardian.objects.filter(is_deleted=False)
        return Guardian.objects.filter(college=user.college, is_deleted=False)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class MentorAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = MentorAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        user = self.request.user
        qs = MentorAssignment.objects.filter(is_deleted=False).select_related(
            'mentor__user', 'student__user', 'student__course', 'college'
        )
        if user.role == 'PRINCIPAL':
            if user.college:
                return qs.filter(college=user.college)
            return qs

        qs = qs.filter(college=user.college)
        if user.role == 'MENTOR':
            faculty = getattr(user, 'faculty_profile', None)
            if faculty:
                return qs.filter(mentor=faculty)
            return MentorAssignment.objects.none()

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'PRINCIPAL':
            college_id = self.request.data.get('college_id') or user.college_id
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


class ParentWardLinkViewSet(viewsets.ModelViewSet):
    """
    Administrative management of Parent-Ward verified links.
    Strictly managed by Principals and HODs.
    """
    serializer_class = ParentWardLinkSerializer
    permission_classes = [IsAdminPrincipalOrHOD, IsTenantMember]

    def get_queryset(self):
        user = self.request.user
        return ParentWardLink.objects.filter(college=user.college).select_related('parent', 'student__user')

    def perform_create(self, serializer):
        caller = self.request.user
        acting_role = get_acting_role(self.request)
        link = serializer.save(college=caller.college, verified_by=caller, verified_at=timezone.now())

        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=caller.college,
            user=caller,
            acting_role=acting_role,
            action='PARENT_WARD_LINK_CREATED',
            resource_type='ParentWardLink',
            resource_id=str(link.id),
            ip_address=ip_addr,
            new_values={'parent': link.parent.email, 'student': link.student.roll_number, 'is_verified': link.is_verified}
        )

    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        link = self.get_object()
        link.is_verified = True
        link.is_active = True
        link.verified_by = request.user
        link.verified_at = timezone.now()
        link.save()

        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=link.college,
            user=request.user,
            acting_role=get_acting_role(request),
            action='PARENT_WARD_LINK_VERIFIED',
            resource_type='ParentWardLink',
            resource_id=str(link.id),
            ip_address=ip_addr,
            new_values={'is_verified': True, 'verified_by': request.user.email}
        )
        return Response({'success': True, 'message': f"Ward link between {link.parent.email} and {link.student.roll_number} verified."})

