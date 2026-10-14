from django.db import models
from django.utils import timezone
from common.models import TenantModel


class Announcement(TenantModel):
    class Category(models.TextChoices):
        ACADEMIC = "ACADEMIC", "Academic"
        EXAM = "EXAM", "Examination"
        EVENT = "EVENT", "Campus Event"
        ADMINISTRATIVE = "ADMINISTRATIVE", "Administrative"
        HOLIDAY = "HOLIDAY", "Holiday Notice"
        URGENT = "URGENT", "Urgent Alert"
        FEES = "FEES", "Fees & Finance"

    class Priority(models.TextChoices):
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class TargetAudience(models.TextChoices):
        ENTIRE_COLLEGE = "ENTIRE_COLLEGE", "Entire College"
        DEPARTMENT = "DEPARTMENT", "Specific Department"
        FACULTY_ONLY = "FACULTY_ONLY", "Faculty Only"
        STUDENTS_ONLY = "STUDENTS_ONLY", "Students Only"

    title = models.CharField(max_length=255)
    content = models.TextField()
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.ACADEMIC,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
    )
    target_audience = models.CharField(
        max_length=30,
        choices=TargetAudience.choices,
        default=TargetAudience.ENTIRE_COLLEGE,
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="announcements",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_announcements",
    )
    is_pinned = models.BooleanField(default=False)
    published_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    attachment_url = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-is_pinned", "-published_at"]

    def __str__(self):
        return f"[{self.category}] {self.title}"


class Notification(TenantModel):
    class NotificationType(models.TextChoices):
        ANNOUNCEMENT = "ANNOUNCEMENT", "Announcement"
        FEE_DUE = "FEE_DUE", "Fee Due"
        PAYMENT_SUCCESS = "PAYMENT_SUCCESS", "Payment Success"
        ATTENDANCE_ALERT = "ATTENDANCE_ALERT", "Attendance Alert"
        EXAM_RESULT = "EXAM_RESULT", "Exam Result"
        LEAVE_STATUS = "LEAVE_STATUS", "Leave Status Update"
        MESSAGE = "MESSAGE", "New Message"
        PRINT_STATUS = "PRINT_STATUS", "Print Order Status"
        LIBRARY_STATUS = "LIBRARY_STATUS", "Library Request Status"
        FACILITY_STATUS = "FACILITY_STATUS", "Facility Booking Status"

    recipient = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.ANNOUNCEMENT,
    )
    action_url = models.CharField(max_length=200, blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient.email} - {self.title} ({'Read' if self.is_read else 'Unread'})"



class Document(TenantModel):
    class DocumentType(models.TextChoices):
        BONAFIDE_CERTIFICATE = "BONAFIDE_CERTIFICATE", "Bonafide Certificate"
        GRADE_SHEET = "GRADE_SHEET", "Official Grade Sheet"
        FEE_RECEIPT = "FEE_RECEIPT", "Fee Receipt"
        ID_PROOF = "ID_PROOF", "Identity Document"
        TRANSFER_CERTIFICATE = "TRANSFER_CERTIFICATE", "Transfer Certificate"
        SYLLABUS_COPY = "SYLLABUS_COPY", "Course Syllabus Copy"
        LECTURE_NOTES = "LECTURE_NOTES", "Lecture Notes & Study Material"

    class VerificationStatus(models.TextChoices):
        VERIFIED = "VERIFIED", "Verified / Official"
        PENDING = "PENDING_VERIFICATION", "Pending Verification"
        REJECTED = "REJECTED", "Rejected"

    title = models.CharField(max_length=200)
    document_type = models.CharField(
        max_length=30,
        choices=DocumentType.choices,
        default=DocumentType.BONAFIDE_CERTIFICATE,
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )
    uploaded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    file_url = models.CharField(max_length=255)
    status = models.CharField(
        max_length=30,
        choices=VerificationStatus.choices,
        default=VerificationStatus.VERIFIED,
    )
    issued_date = models.DateField(default=timezone.now)

    class Meta:
        ordering = ["-issued_date", "-created_at"]

    def __str__(self):
        return f"{self.title} ({self.document_type})"
