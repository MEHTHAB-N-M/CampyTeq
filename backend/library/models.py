from django.db import models
from django.utils import timezone
from common.models import TenantModel

class LibraryBooking(TenantModel):
    """
    Library space and period reservation management:
    - Requesters: FACULTY, LAB_FACULTY, HOD (in Faculty mode).
    - Single approver role: LIBRARY_FACULTY.
    """
    class BookingStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    requested_by = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='library_bookings'
    )
    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    purpose = models.CharField(max_length=255, help_text="Academic or research purpose")
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
        db_index=True
    )
    decided_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decided_library_bookings'
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ['-date', '-start_time']
        indexes = [
            models.Index(fields=['college', 'date', 'status']),
        ]

    def __str__(self):
        return f"Library Booking: {self.date} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}) [{self.status}]"
