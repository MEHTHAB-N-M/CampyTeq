from rest_framework import viewsets, permissions, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.exceptions import PermissionDenied
from common.permissions import IsSuperAdmin, IsAdminOrPrincipal, IsTenantMember, IsAdminPrincipalOrHOD, get_acting_role
from .models import User, Role, Permission, AuditLog, UserRole
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    RoleSerializer,
    PermissionSerializer,
    AuditLogSerializer,
)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        active_role = get_acting_role(request)
        serializer = UserProfileSerializer(request.user, context={'request': request, 'active_role': active_role})
        return Response(serializer.data)

    def patch(self, request):
        active_role = get_acting_role(request)
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True, context={'request': request, 'active_role': active_role})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserModulesView(views.APIView):
    """
    Returns the role-adaptive permitted modules, routes, icons, and actions
    strictly for the user's active acting_role.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .role_modules import get_modules_for_role
        acting_role = get_acting_role(request)
        modules = get_modules_for_role(acting_role, request.user)
        return Response({
            'role': acting_role,
            'modules': modules
        })


class SwitchRoleView(views.APIView):
    """
    Role Switcher endpoint:
    1. Verifies user holds the role and it is active in UserRole.
    2. Sets an active_role claim in token.
    3. Writes an audit log: old role, new role, IP, timestamp, acting_role.
    4. Returns updated tokens and user object so frontend reloads menu and routes.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        target_role = request.data.get('role')
        if not target_role:
            return Response(
                {'detail': 'Role parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        held_roles = user.get_held_roles()

        if target_role not in held_roles:
            return Response(
                {'detail': f'You do not hold an active assignment for role: {target_role}.'},
                status=status.HTTP_403_FORBIDDEN
            )

        old_role = getattr(request, 'acting_role', None) or user.last_active_role or user.get_default_active_role()

        # Update last active role on user
        user.last_active_role = target_role
        user.save(update_fields=['last_active_role'])

        # Write immutable audit log
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        valid_ip = ip if ('.' in ip and ':' not in ip) else None

        AuditLog.objects.create(
            user=user,
            college=user.college,
            acting_role=target_role,
            action='ROLE_SWITCH',
            resource_type='User',
            resource_id=str(user.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={'active_role': old_role, 'old_role': old_role},
            new_values={'active_role': target_role, 'new_role': target_role},
        )

        # Issue new short-lived JWT token with active_role claim
        refresh = RefreshToken.for_user(user)
        refresh['active_role'] = target_role
        refresh['role'] = user.role
        if user.college_id:
            refresh['college_id'] = str(user.college_id)

        user_data = UserProfileSerializer(user, context={'active_role': target_role}).data

        return Response({
            'message': f'Active role successfully switched to {target_role}',
            'active_role': target_role,
            'role': target_role,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data,
        })


class ChangePasswordView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['current_password']):
            return Response(
                {'detail': 'Current password does not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'message': 'Password changed successfully.'})


class UserViewSet(viewsets.ModelViewSet):
    """
    Tenant-isolated User management enforcing hierarchical provisioning:
    - SUPER_ADMIN: creates Colleges and Principals.
    - PRINCIPAL: creates HODs, service staff, and parents within own college.
    - HOD: creates Faculty, Lab Faculty, and Students within own department.
    """
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'deactivate']:
            return [IsAdminPrincipalOrHOD()]
        return [IsAdminPrincipalOrHOD()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()

        qs = User.objects.filter(is_deleted=False).select_related('college').prefetch_related('custom_roles', 'user_roles')
        acting_role = get_acting_role(self.request)

        if acting_role in ['SUPER_ADMIN', 'PRINCIPAL']:
            college_filter = self.request.query_params.get('college_id') or getattr(self.request, 'college', None)
            if college_filter:
                cid = getattr(college_filter, 'id', college_filter)
                return qs.filter(college_id=cid)
            if acting_role == 'PRINCIPAL' and user.college_id:
                return qs.filter(college_id=user.college_id)
            return qs

        return qs.filter(college_id=user.college_id)

    def perform_create(self, serializer):
        caller = self.request.user
        acting_role = get_acting_role(self.request)
        target_role = serializer.validated_data.get('role', 'STUDENT')
        target_college = serializer.validated_data.get('college') or caller.college

        # 1. SUPER_ADMIN rules
        if acting_role == 'SUPER_ADMIN':
            if target_role not in ['PRINCIPAL', 'SUPER_ADMIN']:
                raise PermissionDenied("Super Administrators can only provision Principals or Super Administrators.")
            user = serializer.save()
        # 2. PRINCIPAL rules
        elif acting_role == 'PRINCIPAL':
            allowed_for_principal = ['HOD', 'ACCOUNTANT', 'LIBRARY_FACULTY', 'PRINT_STAFF', 'SECURITY', 'PARENT']
            if target_role not in allowed_for_principal:
                raise PermissionDenied(f"Principals can only provision HODs, service staff, or parents. '{target_role}' not permitted.")
            if caller.college_id and target_college and target_college.id != caller.college_id:
                raise PermissionDenied("Cannot create users for a different college.")
            user = serializer.save(college=caller.college)
        # 3. HOD rules
        elif acting_role == 'HOD':
            allowed_for_hod = ['FACULTY', 'LAB_FACULTY', 'STUDENT']
            if target_role not in allowed_for_hod:
                raise PermissionDenied(f"HODs can only provision Faculty, Lab Faculty, or Students. '{target_role}' not permitted.")
            if caller.college_id and target_college and target_college.id != caller.college_id:
                raise PermissionDenied("Cannot create users for a different college.")
            user = serializer.save(college=caller.college)
        else:
            raise PermissionDenied("You do not have permission to provision user accounts.")

        # Write immutable audit log
        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=user.college,
            user=caller,
            acting_role=acting_role,
            action='USER_CREATED',
            resource_type='User',
            resource_id=str(user.id),
            ip_address=ip_addr,
            new_values={'email': user.email, 'role': user.role, 'status': user.status}
        )

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        target_user = self.get_object()
        caller = request.user
        acting_role = get_acting_role(request)

        if acting_role == 'SUPER_ADMIN':
            pass
        elif acting_role == 'PRINCIPAL':
            if target_user.college_id != caller.college_id:
                return Response({'detail': 'Cannot deactivate users from another college.'}, status=status.HTTP_403_FORBIDDEN)
            if target_user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
                return Response({'detail': 'Cannot deactivate peer or superior administrator.'}, status=status.HTTP_403_FORBIDDEN)
        elif acting_role == 'HOD':
            if target_user.college_id != caller.college_id or target_user.role not in ['FACULTY', 'LAB_FACULTY', 'STUDENT']:
                return Response({'detail': 'HODs can only deactivate departmental faculty and students.'}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        target_user.is_active = False
        target_user.status = 'INACTIVE'
        target_user.save()
        UserRole.objects.filter(user=target_user).update(is_active=False)

        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=target_user.college,
            user=caller,
            acting_role=acting_role,
            action='USER_DEACTIVATED',
            resource_type='User',
            resource_id=str(target_user.id),
            ip_address=ip_addr,
            new_values={'is_active': False, 'status': 'INACTIVE'}
        )
        return Response({'success': True, 'message': f"User {target_user.email} deactivated successfully."})


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Role.objects.all().prefetch_related('permissions')
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrPrincipal]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPER_ADMIN' or (user.role == 'PRINCIPAL' and not user.college_id):
            return AuditLog.objects.all().select_related('user', 'college')
        return AuditLog.objects.filter(college=user.college).select_related('user', 'college')
