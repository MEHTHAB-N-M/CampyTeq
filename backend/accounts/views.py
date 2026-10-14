from rest_framework import viewsets, permissions, status, views
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from common.permissions import IsSuperAdmin, IsAdminOrPrincipal, IsTenantMember
from .models import User, Role, Permission, AuditLog
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
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SwitchRoleView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        target_role = request.data.get('role')
        if target_role not in ['FACULTY', 'MENTOR']:
            return Response(
                {'detail': 'Target role must be FACULTY or MENTOR.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        has_faculty = hasattr(user, 'faculty_profile')
        if user.role not in ['FACULTY', 'MENTOR'] and not has_faculty:
            return Response(
                {'detail': 'Only faculty and mentors can switch between these roles.'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.role = target_role
        user.save(update_fields=['role'])
        serializer = UserProfileSerializer(user)
        return Response({
            'message': f'Active role successfully switched to {target_role}',
            'role': target_role,
            'user': serializer.data
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
    Principals can manage users belonging to their college (and across colleges if multi-tenant operator).
    Management can view/manage users belonging to their college.
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

        qs = User.objects.filter(is_deleted=False).select_related('college').prefetch_related('custom_roles')

        if user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            college_filter = self.request.query_params.get('college_id') or getattr(self.request, 'college', None)
            if college_filter:
                cid = getattr(college_filter, 'id', college_filter)
                return qs.filter(college_id=cid)
            if user.role == 'PRINCIPAL' and user.college_id:
                return qs.filter(college_id=user.college_id)
            return qs

        # Tenant isolation: strictly filter to user's college
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
        if user.role == 'PRINCIPAL' and not user.college_id:
            return AuditLog.objects.all().select_related('user', 'college')
        return AuditLog.objects.filter(college=user.college).select_related('user', 'college')
