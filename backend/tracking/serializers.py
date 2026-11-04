from rest_framework import serializers
from django.utils import timezone
from .models import BiometricProfile, DetectionEvent, StudentLatestLocation, TrackingAccessLog, FaceEnrollment
from students.models import Student
from cameras.models import Camera, CameraZone


class FaceEnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_number = serializers.CharField(source='student.student_number', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    consent_by_name = serializers.CharField(source='consent_by.get_full_name', read_only=True)

    class Meta:
        model = FaceEnrollment
        fields = [
            'id', 'student', 'student_name', 'student_number', 'roll_number',
            'embedding', 'consent_given', 'consent_by', 'consent_by_name',
            'consent_at', 'retention_until', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_embedding(self, value):
        if not isinstance(value, list) or len(value) != 128:
            raise serializers.ValidationError(
                "Face enrollment strictly requires an irreversible 128-D numerical vector. "
                "Raw face images, binary blobs, and non-128-D embeddings are prohibited."
            )
        if not all(isinstance(x, (int, float)) for x in value):
            raise serializers.ValidationError("Embedding components must be numerical floating-point values.")
        return value


class BiometricProfileSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_number = serializers.CharField(source='student.student_number', read_only=True)
    enrolled_by_name = serializers.CharField(source='enrolled_by.get_full_name', read_only=True)

    class Meta:
        model = BiometricProfile
        fields = [
            'id', 'student', 'student_name', 'student_number',
            'status', 'enrolled_by', 'enrolled_by_name',
            'enrolled_at', 'representation_hash', 'notes'
        ]
        read_only_fields = ['id', 'enrolled_at']


class DetectionEventSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_number = serializers.CharField(source='student.student_number', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    camera_code = serializers.CharField(source='camera.code', read_only=True)
    camera_name = serializers.CharField(source='camera.name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    zone_code = serializers.CharField(source='zone.code', read_only=True)
    building = serializers.CharField(source='zone.building', read_only=True)
    floor = serializers.IntegerField(source='zone.floor', read_only=True)

    class Meta:
        model = DetectionEvent
        fields = [
            'id', 'camera', 'camera_code', 'camera_name',
            'zone', 'zone_name', 'zone_code', 'building', 'floor',
            'student', 'student_name', 'student_number', 'roll_number',
            'detected_at', 'confidence_score', 'event_type',
            'processing_status', 'snapshot_url', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class DetectionIngestSerializer(serializers.Serializer):
    """Payload from edge CV gateway service."""
    camera_code = serializers.CharField(max_length=50)
    student_number = serializers.CharField(max_length=50)
    confidence_score = serializers.DecimalField(max_digits=5, decimal_places=4, default=0.9500)
    detected_at = serializers.DateTimeField(required=False)
    event_type = serializers.ChoiceField(choices=DetectionEvent.EVENT_TYPE_CHOICES, default='FACE_RECOGNITION')
    snapshot_url = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')


class StudentLatestLocationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_number = serializers.CharField(source='student.student_number', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    department_name = serializers.CharField(source='student.department.name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    zone_code = serializers.CharField(source='zone.code', read_only=True)
    building = serializers.CharField(source='zone.building', read_only=True)
    floor = serializers.IntegerField(source='zone.floor', read_only=True)
    camera_code = serializers.CharField(source='camera.code', read_only=True)
    camera_name = serializers.CharField(source='camera.name', read_only=True)

    class Meta:
        model = StudentLatestLocation
        fields = [
            'id', 'student', 'student_name', 'student_number', 'roll_number',
            'department_name', 'zone', 'zone_name', 'zone_code', 'building',
            'floor', 'camera', 'camera_code', 'camera_name',
            'detected_at', 'confidence_score', 'updated_at'
        ]


class TrackingAccessLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_number = serializers.CharField(source='student.student_number', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)

    class Meta:
        model = TrackingAccessLog
        fields = [
            'id', 'user', 'user_email', 'user_name', 'user_role',
            'student', 'student_name', 'student_number', 'roll_number',
            'action', 'reason', 'ip_address', 'accessed_at'
        ]
        read_only_fields = ['id', 'accessed_at']
