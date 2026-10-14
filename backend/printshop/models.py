import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from common.models import TenantModel


class PrintPricing(TenantModel):
    bw_per_page = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("2.00"))
    color_per_page = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("10.00"))
    duplex_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    spiral_binding_cost = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("30.00"))
    hard_binding_cost = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("150.00"))
    lamination_per_page = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("15.00"))

    class Meta:
        verbose_name_plural = "Print Pricing"

    def __str__(self):
        return f"Pricing for {self.college.name}"


class PrintOrder(TenantModel):
    class PrintColor(models.TextChoices):
        BW = "BW", "Black & White"
        COLOR = "COLOR", "Full Color"

    class PrintSide(models.TextChoices):
        SINGLE = "SINGLE", "Single Sided"
        DUPLEX = "DUPLEX", "Double Sided (Duplex)"
        BOOKLET = "BOOKLET", "Booklet / Book Type"

    class PaperSize(models.TextChoices):
        A4 = "A4", "Standard A4"
        A3 = "A3", "Large A3"

    class BindingType(models.TextChoices):
        NONE = "NONE", "No Binding"
        STAPLE = "STAPLE", "Corner Staple (Free)"
        SPIRAL = "SPIRAL", "Spiral Coil Binding"
        HARD_BINDING = "HARD_BINDING", "Hardcover Book Binding"

    class OrderStatus(models.TextChoices):
        PENDING = "PENDING", "Order Received"
        QUEUED = "QUEUED", "In Print Queue"
        PRINTING = "PRINTING", "Printing in Progress"
        READY_FOR_PICKUP = "READY_FOR_PICKUP", "Ready for Pickup"
        COMPLETED = "COMPLETED", "Completed & Collected"
        CANCELLED = "CANCELLED", "Cancelled"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Payment Pending"
        PAID = "PAID", "Paid Online / Wallet"
        ON_PICKUP = "ON_PICKUP", "Pay Cash on Pickup"

    order_number = models.CharField(max_length=50, blank=True)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="print_orders",
    )
    document_name = models.CharField(max_length=255)
    file_url = models.CharField(max_length=255)
    page_count = models.PositiveIntegerField(default=1)
    copies = models.PositiveIntegerField(default=1)
    print_color = models.CharField(
        max_length=10,
        choices=PrintColor.choices,
        default=PrintColor.BW,
    )
    print_side = models.CharField(
        max_length=10,
        choices=PrintSide.choices,
        default=PrintSide.SINGLE,
    )
    paper_size = models.CharField(
        max_length=10,
        choices=PaperSize.choices,
        default=PaperSize.A4,
    )
    binding_type = models.CharField(
        max_length=20,
        choices=BindingType.choices,
        default=BindingType.NONE,
    )
    lamination = models.BooleanField(default=False)
    special_instructions = models.TextField(blank=True, default="")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.ON_PICKUP,
    )
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
    )
    handled_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="handled_print_jobs",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.order_number:
            date_prefix = timezone.now().strftime("%Y%m%d")
            short_id = uuid.uuid4().hex[:6].upper()
            self.order_number = f"PRT-{date_prefix}-{short_id}"
        super().save(*args, **kwargs)

    def calculate_cost(self, pricing: PrintPricing = None):
        if not pricing:
            pricing, _ = PrintPricing.objects.get_or_create(college=self.college)

        # Base rate per page
        rate_per_page = pricing.color_per_page if self.print_color == self.PrintColor.COLOR else pricing.bw_per_page

        # A3 multiplier (e.g. 1.8x)
        if self.paper_size == self.PaperSize.A3:
            rate_per_page *= Decimal("1.8")

        # Total pages across all copies
        total_pages = Decimal(self.page_count * self.copies)
        subtotal = total_pages * rate_per_page

        # Duplex discount
        if self.print_side == self.PrintSide.DUPLEX and pricing.duplex_discount_percent > 0:
            discount = subtotal * (pricing.duplex_discount_percent / Decimal("100.0"))
            subtotal -= discount

        # Binding addition
        if self.binding_type == self.BindingType.SPIRAL:
            subtotal += pricing.spiral_binding_cost * Decimal(self.copies)
        elif self.binding_type == self.BindingType.HARD_BINDING:
            subtotal += pricing.hard_binding_cost * Decimal(self.copies)

        # Lamination addition (covers only: 2 per copy)
        if self.lamination:
            subtotal += pricing.lamination_per_page * Decimal(2 * self.copies)

        return round(subtotal, 2)

    def __str__(self):
        return f"{self.order_number} — {self.document_name} ({self.status})"
