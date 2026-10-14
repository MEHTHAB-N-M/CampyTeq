import uuid
from django.utils.deprecation import MiddlewareMixin
from django.core.exceptions import ValidationError

class TenantMiddleware(MiddlewareMixin):
    """
    Resolves and attaches `request.college` based on the authenticated user context.
    Ensures that tenant context is strictly derived from the authenticated user
    rather than unauthenticated / client-tampered query params.

    For PRINCIPAL users, an optional 'X-College-ID' header is permitted to switch
    active management context across colleges.
    """
    def process_request(self, request):
        request.college = None

        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return

        # For SUPER_ADMIN and PRINCIPAL users, support active college context switching via header
        if getattr(user, 'role', '') in ['SUPER_ADMIN', 'PRINCIPAL']:
            college_id_header = request.headers.get('X-College-ID')
            if college_id_header:
                try:
                    uuid_val = uuid.UUID(college_id_header)
                    from colleges.models import College
                    college = College.objects.filter(id=uuid_val, is_deleted=False).first()
                    if college:
                        request.college = college
                        return
                except (ValueError, ValidationError):
                    pass

        # Direct college assignment from user
        if hasattr(user, 'college') and user.college:
            request.college = user.college
            return
