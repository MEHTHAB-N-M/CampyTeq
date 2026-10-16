from rest_framework import permissions
from accounts.models import UserRole

def get_acting_role(request):
    """
    Resolves the single active role for the current request.
    Sources checked:
    1. JWT token claim ('active_role')
    2. Header 'X-Active-Role'
    3. User's last_active_role
    4. Default active role precedence: HOD > CLASS_INCHARGE > MENTOR > FACULTY > base
    """
    if not request or not hasattr(request, 'user') or not request.user or not request.user.is_authenticated:
        return None

    if hasattr(request, 'acting_role') and request.acting_role:
        return request.acting_role

    role = None
    # 1. From decoded JWT payload if available
    auth = getattr(request, 'auth', None)
    if isinstance(auth, dict):
        role = auth.get('active_role')
    elif hasattr(auth, 'get'):
        try:
            role = auth.get('active_role')
        except Exception:
            pass

    # 2. From request header
    if not role:
        role = request.headers.get('X-Active-Role') or request.META.get('HTTP_X_ACTIVE_ROLE')

    # 3. From user's last_active_role or default
    if not role:
        role = request.user.last_active_role or request.user.get_default_active_role()

    request.acting_role = role
    return role


class IsPrincipal(permissions.BasePermission):
    """Allows access if acting role is Principal or Super Admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        return acting_role in ['PRINCIPAL', 'SUPER_ADMIN'] or request.user.role in ['PRINCIPAL', 'SUPER_ADMIN']


IsSuperAdmin = IsPrincipal
IsAdminOrPrincipal = IsPrincipal


class IsAdminPrincipalOrHOD(permissions.BasePermission):
    """Allows access if acting role is Principal, Super Admin, or HOD."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        return acting_role in ['PRINCIPAL', 'SUPER_ADMIN', 'HOD'] or request.user.role in ['PRINCIPAL', 'SUPER_ADMIN']


class IsHOD(permissions.BasePermission):
    """Allows access strictly if acting role is HOD and active."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        if acting_role == 'SUPER_ADMIN':
            return True
        if acting_role != 'HOD':
            return False
        # Verify HOD is still active in UserRole
        return UserRole.objects.filter(user=request.user, role='HOD', is_active=True).exists() or request.user.role == 'HOD'


class IsLibraryFaculty(permissions.BasePermission):
    """Allows access strictly to Library Faculty."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        if acting_role == 'SUPER_ADMIN':
            return True
        return acting_role == 'LIBRARY_FACULTY' and (
            UserRole.objects.filter(user=request.user, role='LIBRARY_FACULTY', is_active=True).exists()
            or request.user.role == 'LIBRARY_FACULTY'
        )


class IsTenantMember(permissions.BasePermission):
    """
    Enforces strict multi-tenant isolation:
    1. Authenticated user must belong to an active college (unless Super Admin or global Principal).
    2. Any accessed object with a `college` attribute must match user's college.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        if acting_role in ['SUPER_ADMIN', 'PRINCIPAL'] or request.user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            return True
        return bool(request.user.college and request.user.college.is_active)

    def has_object_permission(self, request, view, obj):
        acting_role = get_acting_role(request)
        if acting_role in ['SUPER_ADMIN', 'PRINCIPAL'] or request.user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            return True
        if hasattr(obj, 'college'):
            return obj.college_id == request.user.college_id
        return True


class HasGranularPermission(permissions.BasePermission):
    """
    Checks if the user has specific granular permission code(s).
    Enforces specification rule:
    - Only the ACTIVE role grants permissions, never the union of held roles.
    - Re-checks on every request that the active role is still active in UserRole,
      so a revoked assignment loses access immediately.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        acting_role = get_acting_role(request)

        # Super Admin override
        if acting_role == 'SUPER_ADMIN' or request.user.role == 'SUPER_ADMIN':
            return True

        # Re-check that active role is still active in UserRole (unless primary base role)
        is_active_held = UserRole.objects.filter(
            user=request.user,
            role=acting_role,
            is_active=True
        ).exists()

        if not is_active_held and acting_role != request.user.role:
            # Assignment was revoked! Access denied immediately.
            return False

        required_perm = getattr(view, 'required_permission', None)
        if not required_perm:
            return True

        # Fetch permissions strictly granted to the active role
        active_role_perms = request.user.get_all_permissions_list(acting_role=acting_role)

        if isinstance(required_perm, (list, tuple)):
            return any(perm in active_role_perms for perm in required_perm)
        return required_perm in active_role_perms


class IsLinkedParent(permissions.BasePermission):
    """
    Object-level permission verifying that a parent is actively and verifiably linked to the student ward.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        return acting_role == 'PARENT' or request.user.role in ['PARENT', 'PRINCIPAL', 'SUPER_ADMIN']

    def has_object_permission(self, request, view, obj):
        from students.models import ParentWardLink
        acting_role = get_acting_role(request)
        if acting_role in ['PRINCIPAL', 'SUPER_ADMIN'] or request.user.role in ['PRINCIPAL', 'SUPER_ADMIN']:
            return True

        student = getattr(obj, 'student', obj)
        return ParentWardLink.objects.filter(
            parent=request.user,
            student=student,
            college=request.user.college,
            is_verified=True,
            is_active=True
        ).exists()
