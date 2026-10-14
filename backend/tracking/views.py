from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import models
from django.utils import timezone
from datetime import timedelta
import uuid

from common.permissions import IsTenantMember
from cameras.models import Camera, CameraZone
from students.models import Student, MentorAssignment
from .models import BiometricProfile, DetectionEvent, StudentLatestLocation, TrackingAccessLog
from .serializers import (
    BiometricProfileSerializer,
    DetectionEventSerializer,
    DetectionIngestSerializer,
    StudentLatestLocationSerializer,
    TrackingAccessLogSerializer,
)


class IsSecurityOrAdmin(permissions.BasePermission):
    """Allows access to Principal, Security, HOD, Mentor, or Faculty."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ['PRINCIPAL', 'HOD', 'MENTOR', 'FACULTY', 'SECURITY']


IsTrackingAuthorized = IsSecurityOrAdmin


class IngestDetectionView(APIView):
    """
    Edge CV gateway ingestion endpoint.
    Receives detection event metadata from camera edge devices / YOLO workers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DetectionIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        college = user.college if not (user.role == 'PRINCIPAL' and not user.college_id) else None

        # Resolve camera
        cam_qs = Camera.objects.filter(code=data['camera_code'])
        if college:
            cam_qs = cam_qs.filter(college=college)
        camera = cam_qs.first()
        if not camera:
            return Response({
                'success': False,
                'message': f"Camera with code '{data['camera_code']}' not registered in this institution.",
                'code': 'CAMERA_NOT_FOUND'
            }, status=status.HTTP_404_NOT_FOUND)

        # Resolve student (by student_number or roll_number)
        student_qs = Student.objects.filter(
            models.Q(student_number=data['student_number']) |
            models.Q(roll_number=data['student_number'])
        )
        if college:
            student_qs = student_qs.filter(college=college)
        student = student_qs.first()
        if not student:
            return Response({
                'success': False,
                'message': f"Student with ID '{data['student_number']}' not found in this institution.",
                'code': 'STUDENT_NOT_FOUND'
            }, status=status.HTTP_404_NOT_FOUND)

        detected_at = data.get('detected_at') or timezone.now()
        effective_college = student.college

        # Create DetectionEvent
        event = DetectionEvent.objects.create(
            college=effective_college,
            camera=camera,
            zone=camera.zone,
            student=student,
            detected_at=detected_at,
            confidence_score=data.get('confidence_score', 0.9500),
            event_type=data.get('event_type', 'FACE_RECOGNITION'),
            snapshot_url=data.get('snapshot_url', '')
        )

        # Update or create StudentLatestLocation
        latest_loc = StudentLatestLocation.objects.filter(student=student).first()
        if not latest_loc:
            StudentLatestLocation.objects.create(
                college=effective_college,
                student=student,
                camera=camera,
                zone=camera.zone,
                detected_at=detected_at,
                confidence_score=data.get('confidence_score', 0.9500)
            )
        elif detected_at >= latest_loc.detected_at:
            latest_loc.camera = camera
            latest_loc.zone = camera.zone
            latest_loc.detected_at = detected_at
            latest_loc.confidence_score = data.get('confidence_score', 0.9500)
            latest_loc.save()

        # Update camera heartbeat and ensure status is ONLINE
        camera.last_heartbeat = detected_at
        if camera.status != 'ONLINE':
            camera.status = 'ONLINE'
        camera.save(update_fields=['last_heartbeat', 'status'])

        return Response({
            'success': True,
            'message': f"Detection event registered for student {student.roll_number}",
            'data': DetectionEventSerializer(event).data
        }, status=status.HTTP_201_CREATED)


class DetectionEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Real-time detection event stream across campus cameras."""
    serializer_class = DetectionEventSerializer
    permission_classes = [IsTenantMember, IsSecurityOrAdmin]
    ordering_fields = ['detected_at', 'confidence_score']

    def get_queryset(self):
        user = self.request.user
        qs = DetectionEvent.objects.select_related('camera', 'zone', 'student', 'student__user')
        if not (user.role == 'PRINCIPAL' and not user.college_id):
            qs = qs.filter(college=user.college)

        camera_id = self.request.query_params.get('camera')
        if camera_id:
            qs = qs.filter(camera_id=camera_id)

        zone_id = self.request.query_params.get('zone')
        if zone_id:
            qs = qs.filter(zone_id=zone_id)

        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)

        hours = self.request.query_params.get('hours')
        if hours:
            try:
                since = timezone.now() - timedelta(hours=int(hours))
                qs = qs.filter(detected_at__gte=since)
            except ValueError:
                pass

        return qs[:100]  # Limit stream feed to latest 100 items


class StudentLastSeenView(APIView):
    """
    Authorized Student Last-Detected Location Search.
    Strictly restricted to Security, Principal, SuperAdmin, and cohort Mentors.
    Enforces mandatory operational reason and writes immutable audit log.
    """
    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user

        # 1. Role authorization check
        allowed_roles = ['SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'MENTOR', 'FACULTY']
        if user.role not in allowed_roles or user.role == 'SECURITY':
            return Response({
                'success': False,
                'message': "Security personnel are restricted from individual student location queries. Only academic administrators, faculty, and mentors may query student locations.",
                'code': 'SECURITY_STUDENT_SEARCH_RESTRICTED'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Mandatory Reason Validation
        reason = request.query_params.get('reason', '').strip()
        if not reason or len(reason) < 5:
            return Response({
                'success': False,
                'message': "A valid operational reason (minimum 5 characters) is required to access student detection history.",
                'code': 'REASON_REQUIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Resolve target student
        student_param = request.query_params.get('student_id') or request.query_params.get('student_number')
        if not student_param:
            return Response({
                'success': False,
                'message': "Please provide a valid 'student_id' or 'student_number' parameter.",
                'code': 'STUDENT_REQUIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        student_qs = Student.objects.select_related('user', 'department', 'batch', 'current_semester')
        if not (user.role == 'PRINCIPAL' and not user.college_id):
            student_qs = student_qs.filter(college=user.college)

        # Try UUID lookup then student_number or roll_number
        target_student = None
        try:
            uuid_obj = uuid.UUID(str(student_param))
            target_student = student_qs.filter(id=uuid_obj).first()
        except ValueError:
            target_student = student_qs.filter(
                models.Q(student_number__iexact=student_param) |
                models.Q(roll_number__iexact=student_param)
            ).first()

        if not target_student:
            return Response({
                'success': False,
                'message': f"Student '{student_param}' not found.",
                'code': 'STUDENT_NOT_FOUND'
            }, status=status.HTTP_404_NOT_FOUND)

        # 4. Mentor Cohort Scoping
        if user.role == 'MENTOR':
            is_assigned = MentorAssignment.objects.filter(
                mentor__user=user,
                student=target_student,
                is_active=True
            ).exists()
            if not is_assigned:
                return Response({
                    'success': False,
                    'message': f"Access denied. As a Mentor, you are only authorized to query students within your assigned mentorship cohort.",
                    'code': 'MENTOR_COHORT_VIOLATION'
                }, status=status.HTTP_403_FORBIDDEN)

        # 5. Write Immutable Privacy Audit Log
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        TrackingAccessLog.objects.create(
            college=target_student.college,
            user=user,
            student=target_student,
            action='SEARCH_LAST_SEEN',
            reason=reason,
            ip_address=ip_addr
        )

        # 6. Retrieve Latest Location & Chronological Breadcrumb History
        latest_loc = StudentLatestLocation.objects.filter(student=target_student).select_related('camera', 'zone').first()
        latest_loc_data = StudentLatestLocationSerializer(latest_loc).data if latest_loc else None

        # Fetch recent detections (past 48 hours)
        since_48h = timezone.now() - timedelta(hours=48)
        timeline_qs = DetectionEvent.objects.filter(
            student=target_student,
            detected_at__gte=since_48h
        ).select_related('camera', 'zone').order_by('-detected_at')[:25]

        timeline_data = DetectionEventSerializer(timeline_qs, many=True).data

        return Response({
            'success': True,
            'data': {
                'student': {
                    'id': str(target_student.id),
                    'student_number': target_student.student_number,
                    'roll_number': target_student.roll_number,
                    'full_name': target_student.user.get_full_name(),
                    'email': target_student.user.email,
                    'department': target_student.department.name if target_student.department else None,
                    'batch': target_student.batch.name if target_student.batch else None,
                    'status': target_student.status,
                },
                'latest_location': latest_loc_data,
                'trajectory_history': timeline_data,
                'total_sightings_48h': len(timeline_data),
                'disclaimer': "Notice: This represents the last-detected camera sighting. Blind spots exist across campus; camera detections should not be assumed as continuous live GPS tracking."
            }
        })


class TrackingAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit trail of all student tracking inquiries for compliance."""
    serializer_class = TrackingAccessLogSerializer
    permission_classes = [IsTenantMember, IsSecurityOrAdmin]
    ordering_fields = ['accessed_at']

    def get_queryset(self):
        user = self.request.user
        qs = TrackingAccessLog.objects.select_related('user', 'student', 'student__user')
        if not (user.role == 'PRINCIPAL' and not user.college_id):
            qs = qs.filter(college=user.college)
        return qs[:100]


class BiometricProfileViewSet(viewsets.ModelViewSet):
    """Institutional biometric enrollment status administration."""
    serializer_class = BiometricProfileSerializer
    permission_classes = [IsTenantMember, IsSecurityOrAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = BiometricProfile.objects.select_related('student', 'student__user', 'enrolled_by')
        if not (user.role == 'PRINCIPAL' and not user.college_id):
            qs = qs.filter(college=user.college)
        return qs
