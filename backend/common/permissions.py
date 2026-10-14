from rest_framework import permissions

class IsPrincipal(permissions.BasePermission):
    """Allows access to Principal or Super Admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            request.user.role in ['PRINCIPAL', 'SUPER_ADMIN']
        )


# Backward-compatible alias for existing imports
IsSuperAdmin = IsPrincipal


class IsAdminOrPrincipal(permissions.BasePermission):
    """Allows access to Principal or Super Admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            request.user.role in ['PRINCIPAL', 'SUPER_ADMIN']
        )


class IsAdminPrincipalOrHOD(permissions.BasePermission):
    """Allows access to Principal, Super Admin, or HOD."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            request.user.role in ['PRINCIPAL', 'SUPER_ADMIN', 'HOD']
        )


class IsTenantMember(permissions.BasePermission):
    """
    Enforces strict tenant isolation:
    1. Authenticated user must belong to a college (unless Super Admin or Principal).
    2. Any accessed object with a `college` attribute must match user's college.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            return True
        return bool(request.user.college and request.user.college.is_active)

    def has_object_permission(self, request, view, obj):
        if request.user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            return True
        if hasattr(obj, 'college'):
            return obj.college_id == request.user.college_id
        return True


class HasGranularPermission(permissions.BasePermission):
    """
    Checks if the user has a specific granular permission code.
    View must specify `required_permission = 'student.view'` or list of permissions.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'PRINCIPAL':
            return True

        required_perm = getattr(view, 'required_permission', None)
        if not required_perm:
            return True

        user_perms = request.user.get_all_permissions_list()
        if isinstance(required_perm, (list, tuple)):
            return any(perm in user_perms for perm in required_perm)
        return required_perm in user_perms
