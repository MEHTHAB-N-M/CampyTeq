from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from common.permissions import IsPrincipal, IsTenantMember
from .models import College
from .serializers import CollegeSerializer, CollegeDetailSerializer

class CollegeViewSet(viewsets.ModelViewSet):
    """
    CRUD for institutional Colleges.
    Principals can create or list colleges.
    Regular tenant users can access their current college profile.
    """
    queryset = College.objects.filter(is_deleted=False)
    serializer_class = CollegeSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [IsPrincipal()]
        if self.action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ['retrieve', 'current']:
            return CollegeDetailSerializer
        return CollegeSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return College.objects.none()
        if user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
            return College.objects.filter(is_deleted=False)
        if user.college_id:
            return College.objects.filter(id=user.college_id, is_deleted=False)
        return College.objects.none()

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Returns the currently authenticated user's college profile."""
        if not request.user.college:
            if request.user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
                active_college = getattr(request, 'college', None)
                if active_college:
                    return Response(self.get_serializer(active_college).data)
                first_college = College.objects.filter(is_deleted=False).first()
                if first_college:
                    serializer = self.get_serializer(first_college)
                    return Response(serializer.data)
            return Response(
                {'detail': 'User is not associated with an active college.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(request.user.college)
        return Response(serializer.data)
