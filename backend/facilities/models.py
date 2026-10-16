from django.db import models
from django.utils import timezone
from common.models import TenantModel


class Facility(TenantModel):
    class FacilityType(models.TextChoices):
        GYM = "GYM", "Gymnasium"
        TURF = "TURF", "Sports Turf"
        SEMINAR_HALL = "SEMINAR_HALL", "Seminar Hall"
        AUDITORIUM = "AUDITORIUM", "Auditorium"
        PROJECT_ROOM = "PROJECT_ROOM", "Project Room"
        CONFERENCE_ROOM = "CONFERENCE_ROOM", "Conference Room"

    name = models.CharField(max_length=200, help_text="e.g. Central Seminar Hall, APEX Sports Turf")
    facility_type = models.CharField(
        max_length=30,
        choices=FacilityType.choices,
        default=FacilityType.SEMINAR_HALL,
    )
    capacity = models.PositiveIntegerField(default=100)
    location = models.CharField(max_length=200, blank=True, default="", help_text="e.g. Academic Block A, Sports Complex")
    description = models.TextField(blank=True, default="")
    amenities = models.TextField(blank=True, default="Audio/Visual, Air Conditioned, Stage Lights")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Facilities"

    def __str__(self):
        return f"{self.name} ({self.get_facility_type_display()})"


class FacilityBooking(TenantModel):
    class BookingStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    facility = models.ForeignKey(
        Facility,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    requested_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="facility_bookings",
        help_text="Faculty instructor, mentor, or HOD who raised the booking.",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="facility_bookings",
    )
    booking_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    purpose = models.CharField(max_length=255, help_text="Academic, sports, or cultural event purpose")
    expected_attendees = models.PositiveIntegerField(default=50)
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
        db_index=True
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_facility_bookings",
        help_text="HOD or Principal who approved/rejected the booking.",
    )
    review_remarks = models.TextField(blank=True, default="")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-booking_date", "-start_time"]
        indexes = [
            models.Index(fields=['college', 'facility', 'booking_date', 'status']),
        ]

    @property
    def date(self):
        return self.booking_date

    @property
    def decided_by(self):
        return self.reviewed_by

    @property
    def decided_at(self):
        return self.reviewed_at

    @property
    def reject_reason(self):
        return self.review_remarks

    def __str__(self):
        return f"{self.facility.name} - {self.booking_date} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}) [{self.status}]"
