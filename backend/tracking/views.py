from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta
import uuid

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog
from cameras.models import Camera, CameraZone
from students.models import Student, MentorAssignment, ParentWardLink
from attendance.models import AttendanceSession, StudentAttendance
from academics.models import SubjectAssignment, ClassIncharge
from .models import (
    BiometricProfile,
    DetectionEvent,
    StudentLatestLocation,
    TrackingAccessLog,
    FaceEnrollment,
)
from .serializers import (
    BiometricProfileSerializer,
    DetectionEventSerializer,
    DetectionIngestSerializer,
    StudentLatestLocationSerializer,
    TrackingAccessLogSerializer,
    FaceEnrollmentSerializer,
)
from .services import cleanup_old_sightings


class IsSecurityOrAdmin(permissions.BasePermission):
    """Allows general camera/infrastructure inspection to Principal, Security, HOD, Mentor, or Faculty."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        acting_role = get_acting_role(request)
        return acting_role in ['PRINCIPAL', 'HOD', 'MENTOR', 'FACULTY', 'SECURITY', 'SUPER_ADMIN']


class IngestDetectionView(APIView):
    """
    Edge CV gateway ingestion endpoint.
    Receives detection event metadata from camera edge devices / YOLO workers.
    Ensures student has active, verified biometric consent before logging any sightings.
    Never accepts or stores raw face images.
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

        # Consent-first gate: Student must have verified face enrollment consent
        enrollment = FaceEnrollment.objects.filter(student=student, is_active=True, consent_given=True).first()
        if not enrollment or not enrollment.embedding:
            return Response({
                'success': False,
                'message': f"Student {student.roll_number} has not consented to biometric processing. Sighting dropped.",
                'code': 'BIOMETRIC_CONSENT_REQUIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        detected_at = data.get('detected_at') or timezone.now()
        effective_college = student.college

        # Auto-delete sightings older than retention window (default 24h)
        cleanup_old_sightings(retention_hours=24)

        # Create DetectionEvent (irreversible coordinate/zone sighting; no raw face images stored)
        event = DetectionEvent.objects.create(
            college=effective_college,
            camera=camera,
            zone=camera.zone,
            student=student,
            detected_at=detected_at,
            confidence_score=data.get('confidence_score', 0.9500),
            event_type=data.get('event_type', 'FACE_RECOGNITION'),
            snapshot_url=''  # Never store raw face snapshots
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
    Absent-student locator (camera feature).
    Purpose: find students who are marked absent in a class but may still be on campus.

    Rules:
    - Allowed requesters: Faculty (own period), Class Incharge (own section), HOD (own department).
    - Blocked: Security, Student, Parent, Accountant, Print, Library, Super Admin, Principal.
    - Only students marked ABSENT in the current period, and only within the period plus 30 minutes.
    - Consent first: Face enrollment requires verified consent (guardian consent if minor <18).
      Students without consent show "Not enrolled". No fallback tracking.
    - Returns LAST-SEEN ZONE + TIME only (e.g. "Canteen, 10:42"). No live video, no movement trail.
    - Mandatory reason: Every search is logged into TrackingAccessLog and AuditLog.
    """
    permission_classes = [IsTenantMember]

    def get(self, request):
        return self._handle_locate(request)

    def post(self, request):
        return self._handle_locate(request)

    def _handle_locate(self, request):
        user = request.user
        acting_role = get_acting_role(request)

        # 1. Allowed requesters check
        # Allowed: Faculty, Class Incharge, HOD.
        # Blocked: Security, Student, Parent, Accountant, Print, Library, Super Admin, Principal.
        if acting_role not in ['FACULTY', 'CLASS_INCHARGE', 'HOD']:
            return Response({
                'success': False,
                'message': f"Role '{acting_role}' is not authorized to use the student locator. "
                           f"Student searches are strictly restricted to Faculty (own period), "
                           f"Class Incharge (own section), and HOD (own department).",
                'code': 'LOCATOR_ROLE_RESTRICTED'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Mandatory Reason Validation
        reason = (request.query_params.get('reason') or request.data.get('reason') or '').strip()
        if not reason or len(reason) < 3:
            return Response({
                'success': False,
                'message': "A valid operational reason (minimum 3 characters) is legally required to locate an absent student.",
                'code': 'REASON_REQUIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Resolve target student
        student_param = (
            request.query_params.get('student_id')
            or request.query_params.get('student_number')
            or request.data.get('student_id')
            or request.data.get('student_number')
        )
        if not student_param:
            return Response({
                'success': False,
                'message': "Please provide a valid 'student_id' or 'student_number' parameter.",
                'code': 'STUDENT_REQUIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        student_qs = Student.objects.select_related('user', 'department', 'batch', 'current_semester')
        if not (user.role == 'PRINCIPAL' and not user.college_id):
            student_qs = student_qs.filter(college=user.college)

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

        now = timezone.now()

        # 4. Resolve AttendanceSession & Check Active Period Window (+30 min)
        session_id = request.query_params.get('session_id') or request.data.get('session_id')
        session = None
        if session_id:
            session = AttendanceSession.objects.filter(id=session_id, college=user.college).first()
            if not session:
                return Response({
                    'success': False,
                    'message': f"Attendance session '{session_id}' not found.",
                    'code': 'SESSION_NOT_FOUND'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            # Auto-resolve current period today for this student
            sessions_today = AttendanceSession.objects.filter(
                college=user.college,
                date=now.date(),
                student_attendances__student=target_student,
            ).order_by('-start_time')
            session = sessions_today.first()

        if not session:
            return Response({
                'success': False,
                'message': "No class session found for today for the student.",
                'code': 'NO_ACTIVE_SESSION'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify time window: active period plus 30 minutes
        session_start_raw = datetime.combine(session.date, session.start_time)
        session_end_raw = datetime.combine(session.date, session.end_time)
        session_start_dt = timezone.make_aware(session_start_raw) if timezone.is_naive(session_start_raw) else session_start_raw
        session_end_dt = timezone.make_aware(session_end_raw) if timezone.is_naive(session_end_raw) else session_end_raw

        if now < session_start_dt:
            return Response({
                'success': False,
                'message': "The class period has not started yet. Locator is only active during the class period (+30 min).",
                'code': 'PERIOD_NOT_STARTED'
            }, status=status.HTTP_400_BAD_REQUEST)

        if now > (session_end_dt + timedelta(minutes=30)):
            return Response({
                'success': False,
                'message': "The locator lookup window (+30 minutes post-period) has expired for this class period.",
                'code': 'LOCATOR_WINDOW_EXPIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Verify Student is marked ABSENT in this session
        att_record = StudentAttendance.objects.filter(session=session, student=target_student).first()
        if not att_record or att_record.status != 'ABSENT':
            return Response({
                'success': False,
                'message': f"Student {target_student.roll_number} is not marked ABSENT in this class period.",
                'code': 'STUDENT_NOT_ABSENT'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 6. Verify Requester Scope
        if acting_role == 'FACULTY':
            # Faculty can only locate for their own assigned period/subject
            is_assigned = (session.faculty.user_id == user.id)
            if not is_assigned:
                is_substitute = SubjectAssignment.objects.filter(
                    faculty__user=user,
                    subject=session.subject,
                    college=user.college,
                    is_active=True
                ).exists()
                if not is_substitute:
                    return Response({
                        'success': False,
                        'message': "Faculty can only locate absent students in their own assigned class periods.",
                        'code': 'FACULTY_PERIOD_MISMATCH'
                    }, status=status.HTTP_403_FORBIDDEN)

        elif acting_role == 'CLASS_INCHARGE':
            # Class Incharge can locate students in their assigned section only
            student_section = getattr(target_student, 'class_section', None)
            if not student_section and target_student.batch:
                student_section = target_student.batch.class_section

            is_incharge = ClassIncharge.objects.filter(
                faculty__user=user,
                class_section=student_section,
                is_active=True
            ).exists()
            if not is_incharge:
                return Response({
                    'success': False,
                    'message': "Class Incharge can only locate absent students in their assigned section.",
                    'code': 'SECTION_INCHARGE_MISMATCH'
                }, status=status.HTTP_403_FORBIDDEN)

        elif acting_role == 'HOD':
            # HOD can locate students within their own department
            faculty_profile = getattr(user, 'faculty_profile', None)
            hod_dept_id = faculty_profile.department_id if faculty_profile else None
            if not hod_dept_id or target_student.department_id != hod_dept_id:
                return Response({
                    'success': False,
                    'message': "HOD can only locate absent students within their own department.",
                    'code': 'HOD_DEPARTMENT_MISMATCH'
                }, status=status.HTTP_403_FORBIDDEN)

        # 7. Consent Gate (India DPDP Act 2023 compliance)
        # Face enrollment requires verified consent. Minor students (<18) require guardian consent.
        # Students without consent show "Not enrolled". No fallback tracking.
        enrollment = FaceEnrollment.objects.filter(
            student=target_student,
            college=user.college,
            is_active=True,
            consent_given=True
        ).first()

        if not enrollment or not enrollment.embedding:
            return Response({
                'success': False,
                'status': 'NOT_ENROLLED',
                'message': "Not enrolled (biometric face recognition consent not provided or revoked).",
                'code': 'NOT_ENROLLED'
            }, status=status.HTTP_200_OK)

        # Verify minor consent if student is under 18
        dob = getattr(target_student, 'date_of_birth', None) or getattr(target_student.user, 'date_of_birth', None)
        if dob:
            today = now.date()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                is_guardian_verified = ParentWardLink.objects.filter(
                    student=target_student,
                    parent=enrollment.consent_by,
                    is_verified=True
                ).exists()
                if not is_guardian_verified:
                    return Response({
                        'success': False,
                        'status': 'NOT_ENROLLED',
                        'message': "Not enrolled: Minor student (<18) requires verified guardian consent.",
                        'code': 'NOT_ENROLLED'
                    }, status=status.HTTP_200_OK)

        # 8. Retrieve LAST-SEEN ZONE + TIME only (No movement trail / breadcrumbs)
        # Auto-delete detections older than 24 hours
        cleanup_old_sightings(retention_hours=24)

        latest_loc = StudentLatestLocation.objects.filter(
            student=target_student
        ).select_related('camera', 'zone').first()

        # If sighting is older than 24 hours, treat as no recent sighting
        if latest_loc and (now - latest_loc.detected_at).total_seconds() > 24 * 3600:
            latest_loc = None

        last_seen_data = None
        if latest_loc and latest_loc.zone:
            last_seen_data = {
                'zone_name': latest_loc.zone.name,
                'zone_code': latest_loc.zone.code,
                'building': latest_loc.zone.building,
                'floor': latest_loc.zone.floor,
                'detected_at': latest_loc.detected_at.isoformat(),
                'time_display': latest_loc.detected_at.strftime('%H:%M'),
            }

        # 9. Write Immutable Audit Records
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()

        # Specific tracking query log (accessible by the student)
        TrackingAccessLog.objects.create(
            college=target_student.college,
            user=user,
            student=target_student,
            action='LOCATOR_SEARCH',
            reason=reason,
            ip_address=ip_addr
        )

        # Append-only institutional audit log
        AuditLog.objects.create(
            college=target_student.college,
            user=user,
            acting_role=acting_role,
            action='LOCATOR_SEARCHED',
            resource_type='Student',
            resource_id=str(target_student.id),
            new_values={
                'details': f"Absent student locator search for {target_student.roll_number} by {user.email} ({acting_role}). Reason: {reason}",
                'student_id': str(target_student.id),
                'roll_number': target_student.roll_number,
                'reason': reason,
                'session_id': str(session.id),
                'last_seen': last_seen_data,
            }
        )

        return Response({
            'success': True,
            'status': 'FOUND' if last_seen_data else 'NO_RECENT_SIGHTING',
            'data': {
                'student': {
                    'id': str(target_student.id),
                    'student_number': target_student.student_number,
                    'roll_number': target_student.roll_number,
                    'full_name': target_student.user.get_full_name(),
                },
                'last_seen': last_seen_data,
                'disclaimer': "Statutory DPDP Notice: Last-detected stationary camera sighting only. "
                              "Continuous movement trail and live surveillance tracking are prohibited by law."
            }
        })


class FaceEnrollmentViewSet(viewsets.ModelViewSet):
    """
    Facial biometric enrollment and consent administration.
    Rules:
    - Stores only irreversible 128-D vectors. Never stores raw face images.
    - Verified consent required (guardian consent if minor <18).
    - Consent is withdrawable; withdrawal permanently deletes the 128-D vector.
    """
    serializer_class = FaceEnrollmentSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        qs = FaceEnrollment.objects.select_related('student', 'student__user', 'consent_by')
        if not (acting_role == 'SUPER_ADMIN' and not user.college_id):
            qs = qs.filter(college=user.college)

        # Scoping: Students see their own enrollment; Parents see their verified ward; Admins see college
        if acting_role == 'STUDENT':
            qs = qs.filter(student__user=user)
        elif acting_role == 'PARENT':
            ward_ids = ParentWardLink.objects.filter(parent=user, is_verified=True).values_list('student_id', flat=True)
            qs = qs.filter(student_id__in=ward_ids)
        elif acting_role not in ['SUPER_ADMIN', 'PRINCIPAL', 'HOD']:
            return FaceEnrollment.objects.none()

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        college = getattr(user, 'college', None)

        student = serializer.validated_data['student']
        consent_by = serializer.validated_data.get('consent_by') or user

        # Minor verification: if student is under 18, verify guardian consent
        dob = getattr(student, 'date_of_birth', None) or getattr(student.user, 'date_of_birth', None)
        if dob:
            today = timezone.now().date()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                is_guardian = ParentWardLink.objects.filter(
                    student=student,
                    parent=consent_by,
                    is_verified=True
                ).exists()
                if not is_guardian and acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
                    raise permissions.exceptions.PermissionDenied("Minor student (<18) requires verified guardian consent.")

        enrollment = serializer.save(
            college=college or student.college,
            consent_by=consent_by,
            consent_given=True,
            consent_at=timezone.now(),
            is_active=True
        )

        AuditLog.objects.create(
            college=enrollment.college,
            user=user,
            acting_role=acting_role,
            action='BIOMETRIC_CONSENT_GRANTED',
            resource_type='FaceEnrollment',
            resource_id=str(enrollment.id),
            new_values={
                'details': f"Facial biometric consent recorded for student {student.roll_number} by {consent_by.email}",
                'student_id': str(student.id),
                'consent_given': True
            }
        )

    @action(detail=True, methods=['post'], url_path='withdraw')
    def withdraw_consent(self, request, pk=None):
        """
        Withdraw biometric consent.
        Rule: Withdrawal immediately and permanently deletes the 128-D vector.
        """
        enrollment = self.get_object()
        user = request.user
        acting_role = get_acting_role(request)

        # Verify authority: student themselves, their verified parent, or Principal/SuperAdmin
        if acting_role == 'STUDENT' and enrollment.student.user_id != user.id:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if acting_role == 'PARENT':
            is_ward = ParentWardLink.objects.filter(parent=user, student=enrollment.student, is_verified=True).exists()
            if not is_ward:
                return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        # Erase vector and revoke consent
        enrollment.embedding = []
        enrollment.consent_given = False
        enrollment.is_active = False
        enrollment.save(update_fields=['embedding', 'consent_given', 'is_active', 'updated_at'])

        AuditLog.objects.create(
            college=enrollment.college,
            user=user,
            acting_role=acting_role,
            action='BIOMETRIC_CONSENT_REVOKED',
            resource_type='FaceEnrollment',
            resource_id=str(enrollment.id),
            new_values={
                'details': f"Facial biometric consent withdrawn for student {enrollment.student.roll_number}. Vector deleted.",
                'consent_given': False,
                'vector_deleted': True
            }
        )

        return Response({
            'success': True,
            'message': "Biometric consent withdrawn and 128-D vector permanently deleted.",
            'status': 'REVOKED'
        })


class TrackingAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit trail of student tracking inquiries for compliance."""
    serializer_class = TrackingAccessLogSerializer
    permission_classes = [IsTenantMember]
    ordering_fields = ['accessed_at']

    def get_queryset(self):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        qs = TrackingAccessLog.objects.select_related('user', 'student', 'student__user')
        if not (acting_role == 'SUPER_ADMIN' and not user.college_id):
            qs = qs.filter(college=user.college)

        if acting_role == 'STUDENT':
            # Student can see searches conducted on themselves
            return qs.filter(student__user=user)
        elif acting_role == 'PARENT':
            ward_ids = ParentWardLink.objects.filter(parent=user, is_verified=True).values_list('student_id', flat=True)
            return qs.filter(student_id__in=ward_ids)
        elif acting_role in ['PRINCIPAL', 'HOD']:
            return qs[:100]

        return qs.none()

    @action(detail=False, methods=['get'], url_path='my-searches')
    def my_searches(self, request):
        """Allows students to view who has performed locator searches for them."""
        user = request.user
        student = Student.objects.filter(user=user).first()
        if not student:
            return Response({'results': []})
        qs = TrackingAccessLog.objects.filter(student=student).select_related('user').order_by('-accessed_at')
        serializer = TrackingAccessLogSerializer(qs, many=True)
        return Response({'results': serializer.data})


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
