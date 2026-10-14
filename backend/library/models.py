from decimal import Decimal
from datetime import date, timedelta
from django.db import models
from django.utils import timezone
from common.models import TenantModel


class Book(TenantModel):
    class Category(models.TextChoices):
        COMPUTER_SCIENCE = "COMPUTER_SCIENCE", "Computer Science & AI"
        ELECTRONICS = "ELECTRONICS", "Electronics & VLSI"
        MECHANICAL = "MECHANICAL", "Mechanical & Robotics"
        MATHEMATICS = "MATHEMATICS", "Mathematics & Computing"
        PHYSICS = "PHYSICS", "Physics & Quantum"
        MANAGEMENT = "MANAGEMENT", "Management & Economics"
        HUMANITIES = "HUMANITIES", "Humanities & Languages"
        GENERAL = "GENERAL", "General Reference"

    title = models.CharField(max_length=255)
    isbn = models.CharField(max_length=30, blank=True, default="")
    author = models.CharField(max_length=255)
    publisher = models.CharField(max_length=255, blank=True, default="")
    edition = models.CharField(max_length=50, blank=True, default="")
    publication_year = models.PositiveIntegerField(null=True, blank=True)
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.COMPUTER_SCIENCE,
    )
    shelf_location = models.CharField(max_length=50, blank=True, default="Main Stacks")
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True, default="")
    cover_image_url = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["title"]
        unique_together = ["college", "isbn"]

    @property
    def is_available(self):
        return self.available_copies > 0

    def __str__(self):
        return f"{self.title} by {self.author} ({self.available_copies}/{self.total_copies} avail)"


class BookIssue(TenantModel):
    class IssueStatus(models.TextChoices):
        ISSUED = "ISSUED", "Currently Borrowed"
        RETURNED = "RETURNED", "Returned"
        OVERDUE = "OVERDUE", "Overdue"
        LOST = "LOST", "Lost"

    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name="issues",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="borrowed_books",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="borrowed_books",
    )
    issued_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_books",
    )
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=IssueStatus.choices,
        default=IssueStatus.ISSUED,
    )
    fine_amount = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    fine_paid = models.BooleanField(default=False)
    remarks = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-issue_date"]

    def save(self, *args, **kwargs):
        if not self.due_date and self.issue_date:
            self.due_date = self.issue_date + timedelta(days=14)
        super().save(*args, **kwargs)

    def calculate_overdue_fine(self, rate_per_day: Decimal = Decimal("5.00")):
        """Calculates overdue fine if return_date (or today) is past due_date."""
        effective_return = self.return_date or date.today()
        if effective_return > self.due_date:
            overdue_days = (effective_return - self.due_date).days
            return Decimal(overdue_days) * rate_per_day
        return Decimal("0.00")

    def __str__(self):
        return f"{self.book.title} -> {self.user.get_full_name()} ({self.status})"


class LibraryRequest(TenantModel):
    class RequestType(models.TextChoices):
        BORROW = "BORROW", "Borrow / Issue Request"
        RESERVATION = "RESERVATION", "Book Reservation"
        PROCUREMENT = "PROCUREMENT", "New Title Acquisition"
        CLASS_PERIOD = "CLASS_PERIOD", "Class Library Period Booking"

    class RequestStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        FULFILLED = "FULFILLED", "Fulfilled / Issued"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="library_requests",
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name="mentor_requests",
        null=True,
        blank=True,
    )
    suggested_title = models.CharField(max_length=255, blank=True, default="")
    request_type = models.CharField(
        max_length=20,
        choices=RequestType.choices,
        default=RequestType.BORROW,
    )
    status = models.CharField(
        max_length=20,
        choices=RequestStatus.choices,
        default=RequestStatus.PENDING,
    )
    notes = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_library_requests",
    )
    reviewer_remarks = models.TextField(blank=True, default="")
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        title = self.book.title if self.book else self.suggested_title
        return f"{self.user.get_full_name()} -> {title} ({self.status})"
