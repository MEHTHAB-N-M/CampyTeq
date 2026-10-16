from rest_framework import viewsets, permissions, status, views
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from common.permissions import IsSuperAdmin, IsAdminOrPrincipal, IsTenantMember
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
        active_role = getattr(request, 'acting_role', None) or request.user.last_active_role or request.user.get_default_active_role()
        serializer = UserProfileSerializer(request.user, context={'active_role': active_role})
        return Response(serializer.data)

    def patch(self, request):
        active_role = getattr(request, 'acting_role', None) or request.user.last_active_role or request.user.get_default_active_role()
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True, context={'active_role': active_role})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
    Tenant-isolated User management.
    Principals can manage users belonging to their college.
    Super Admins can administer across colleges.
    """
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrPrincipal()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()

        qs = User.objects.filter(is_deleted=False).select_related('college').prefetch_related('custom_roles', 'user_roles')

        if user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            college_filter = self.request.query_params.get('college_id') or getattr(self.request, 'college', None)
            if college_filter:
                cid = getattr(college_filter, 'id', college_filter)
                return qs.filter(college_id=cid)
            if user.role == 'PRINCIPAL' and user.college_id:
                return qs.filter(college_id=user.college_id)
            return qs

        return qs.filter(college_id=user.college_id)

    def perform_create(self, serializer):
        user = self.request.user
        college = getattr(user, 'college', None) or getattr(self.request, 'college', None)
        college_id = self.request.data.get('college_id') or getattr(college, 'id', None)
        if college_id and user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            serializer.save(college_id=college_id)
        else:
            serializer.save(college=user.college)


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
