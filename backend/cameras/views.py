from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from datetime import timedelta

from common.permissions import IsTenantMember
from .models import CameraZone, Camera
from .serializers import (
    CameraZoneSerializer,
    CameraSerializer,
    CameraHeartbeatSerializer,
)


class IsCameraViewer(permissions.BasePermission):
    """Allows camera/zone inspection to Principal, Security, HOD, Mentor, and Faculty."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ['PRINCIPAL', 'HOD', 'MENTOR', 'FACULTY', 'SECURITY']


class IsCameraAdmin(permissions.BasePermission):
    """Allows camera/zone configuration to Principal and HOD."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ['PRINCIPAL', 'HOD']


class CameraZoneViewSet(viewsets.ModelViewSet):
    """Manage campus physical zones monitored by cameras."""
    serializer_class = CameraZoneSerializer
    permission_classes = [IsTenantMember, IsCameraViewer]
    filterset_fields = ['building', 'floor', 'is_active']
    search_fields = ['name', 'code', 'building']
    ordering_fields = ['building', 'floor', 'name']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'PRINCIPAL' and not user.college_id:
            return CameraZone.objects.all().prefetch_related('cameras')
        return CameraZone.objects.filter(college=user.college).prefetch_related('cameras')

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTenantMember(), IsCameraAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        college = getattr(user, 'college', None)
        serializer.save(college=college)


class CameraViewSet(viewsets.ModelViewSet):
    """Manage stationary authorized IP/RTSP camera registry."""
    serializer_class = CameraSerializer
    permission_classes = [IsTenantMember, IsCameraViewer]
    filterset_fields = ['zone', 'camera_type', 'status', 'is_active']
    search_fields = ['name', 'code', 'ip_address', 'location_description']
    ordering_fields = ['code', 'name', 'status', 'last_heartbeat']

    def get_queryset(self):
        user = self.request.user
        qs = Camera.objects.select_related('zone')
        if not (user.role == 'PRINCIPAL' and not user.college_id):
            qs = qs.filter(college=user.college)

        zone_id = self.request.query_params.get('zone')
        if zone_id:
            qs = qs.filter(zone_id=zone_id)
        cam_status = self.request.query_params.get('status')
        if cam_status:
            qs = qs.filter(status=cam_status)
        return qs

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsTenantMember(), IsCameraAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        user = self.request.user
        college = getattr(user, 'college', None)
        serializer.save(college=college)

    @action(detail=True, methods=['post'], permission_classes=[IsTenantMember, IsCameraAdmin])
    def heartbeat(self, request, pk=None):
        """Edge camera ping to update health status & heartbeat timestamp."""
        camera = self.get_object()
        serializer = CameraHeartbeatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        camera.status = serializer.validated_data.get('status', 'ONLINE')
        if 'fps' in serializer.validated_data:
            camera.fps = serializer.validated_data['fps']
        camera.last_heartbeat = timezone.now()
        camera.save(update_fields=['status', 'fps', 'last_heartbeat'])
        return Response({
            'success': True,
            'message': f"Heartbeat recorded for camera {camera.code}",
            'data': CameraSerializer(camera).data
        })


class CameraStatsView(APIView):
    """Aggregate overview of campus camera operations and health."""
    permission_classes = [IsTenantMember, IsCameraViewer]

    def get(self, request):
        user = request.user
        college = user.college

        is_cross_tenant_principal = (user.role == 'PRINCIPAL' and not user.college_id)
        cam_qs = Camera.objects.all() if is_cross_tenant_principal else Camera.objects.filter(college=college)
        zone_qs = CameraZone.objects.all() if is_cross_tenant_principal else CameraZone.objects.filter(college=college)

        total_cameras = cam_qs.count()
        online_cameras = cam_qs.filter(status='ONLINE').count()
        offline_cameras = cam_qs.filter(status='OFFLINE').count()
        maintenance_cameras = cam_qs.filter(status='MAINTENANCE').count()

        total_zones = zone_qs.count()
        active_zones = zone_qs.filter(is_active=True).count()

        # Count recent detections from tracking app if available
        recent_detections = 0
        try:
            from tracking.models import DetectionEvent
            det_qs = DetectionEvent.objects.all() if is_cross_tenant_principal else DetectionEvent.objects.filter(college=college)
            since_24h = timezone.now() - timedelta(hours=24)
            recent_detections = det_qs.filter(detected_at__gte=since_24h).count()
        except Exception:
            pass

        return Response({
            'success': True,
            'data': {
                'total_cameras': total_cameras,
                'online_cameras': online_cameras,
                'offline_cameras': offline_cameras,
                'maintenance_cameras': maintenance_cameras,
                'system_health_percentage': round((online_cameras / total_cameras * 100) if total_cameras else 100, 1),
                'total_zones': total_zones,
                'active_zones': active_zones,
                'recent_detections_24h': recent_detections,
            }
        })
