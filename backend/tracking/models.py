from django.db import models
from common.models import TenantModel


class BiometricProfile(TenantModel):
    """Institutional biometric feature enrollment representation (no raw biometrics stored)."""
    STATUS_CHOICES = [
        ('ENROLLED', 'Enrolled'),
        ('ACTIVE', 'Active & Verified'),
        ('REVOKED', 'Revoked'),
        ('DISABLED', 'Disabled / Inactive'),
    ]

    student = models.OneToOneField(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='biometric_profile'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ENROLLED', db_index=True)
    enrolled_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='biometrics_enrolled'
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    representation_hash = models.CharField(
        max_length=128,
        help_text="Secure irreversible one-way feature representation hash"
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"Biometrics for {self.student} ({self.status})"


class FaceEnrollment(TenantModel):
    """
    Enrolled facial reference embedding vectors with explicit legal consent.
    India DPDP Act 2023 compliance:
    - Requires consent_given=True and recorded consent_by (guardian for minors).
    - Retention period: 3 years or student active enrollment lifecycle.
    - Only PRINCIPAL or assigned administrative delegate manages enrollments.
    """
    student = models.OneToOneField(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='face_enrollment'
    )
    embedding = models.JSONField(
        default=list,
        help_text="Reference embedding numerical vector array (512-dim or 128-dim)"
    )
    consent_given = models.BooleanField(default=False, db_index=True)
    consent_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consented_face_enrollments',
        help_text="Guardian or student user who granted biometric consent"
    )
    consent_at = models.DateTimeField(null=True, blank=True)
    retention_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"FaceEnrollment: {self.student.roll_number} [Consent: {'YES' if self.consent_given else 'NO'}]"



class DetectionEvent(TenantModel):
    """Individual edge CV sighting event logged by campus cameras."""
    EVENT_TYPE_CHOICES = [
        ('FACE_RECOGNITION', 'Automated Face Recognition'),
        ('BADGE_SCAN_CORROBORATION', 'Badge Corroboration'),
        ('PASSING_DETECTION', 'Zone Transit Detection'),
    ]

    STATUS_CHOICES = [
        ('PROCESSED', 'Processed'),
        ('FLAGGED', 'Flagged for Review'),
        ('ARCHIVED', 'Archived'),
    ]

    camera = models.ForeignKey('cameras.Camera', on_delete=models.CASCADE, related_name='detections')
    zone = models.ForeignKey('cameras.CameraZone', on_delete=models.CASCADE, related_name='detections')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='detections')
    detected_at = models.DateTimeField(db_index=True)
    confidence_score = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.9500,
        help_text="Inference confidence score between 0.0000 and 1.0000"
    )
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES, default='FACE_RECOGNITION')
    processing_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PROCESSED', db_index=True)
    snapshot_url = models.CharField(max_length=500, blank=True, help_text="Temporary signed edge snapshot path")

    class Meta:
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['college', 'student', '-detected_at']),
            models.Index(fields=['college', 'camera', '-detected_at']),
        ]

    def __str__(self):
        return f"{self.student} detected at {self.zone.code} on {self.detected_at.strftime('%Y-%m-%d %H:%M')}"


class StudentLatestLocation(TenantModel):
    """Denormalized latest sighting record for rapid location retrieval."""
    student = models.OneToOneField(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='latest_location'
    )
    camera = models.ForeignKey('cameras.Camera', on_delete=models.CASCADE)
    zone = models.ForeignKey('cameras.CameraZone', on_delete=models.CASCADE)
    detected_at = models.DateTimeField()
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-detected_at']

    def __str__(self):
        return f"{self.student} last seen at {self.zone.code} ({self.detected_at.strftime('%H:%M')})"


class TrackingAccessLog(TenantModel):
    """Mandatory immutable privacy audit log for student tracking lookups."""
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='tracking_accesses')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='tracking_queries')
    action = models.CharField(max_length=50, default='SEARCH_LAST_SEEN')
    reason = models.CharField(max_length=255, help_text="Mandatory institutional reason for tracking inquiry")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    accessed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-accessed_at']

    def __str__(self):
        return f"{self.user.email} queried {self.student.student_number} at {self.accessed_at.strftime('%Y-%m-%d %H:%M')}: {self.reason}"
