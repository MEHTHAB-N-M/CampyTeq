from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog
from printshop.models import PrintPricing, PrintOrder
from printshop.serializers import (
    PrintPricingSerializer,
    PrintOrderSerializer,
    PrintOrderCreateSerializer,
    PrintStatusUpdateSerializer,
)
from communication.models import Notification


class PrintPricingViewSet(viewsets.ModelViewSet):
    serializer_class = PrintPricingSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        return PrintPricing.objects.filter(college=self.request.user.college)

    def list(self, request, *args, **kwargs):
        pricing, _ = PrintPricing.objects.get_or_create(college=request.user.college)
        serializer = self.get_serializer(pricing)
        return Response(serializer.data)


class PrintOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["status", "payment_status", "print_color"]
    search_fields = ["order_number", "document_name", "user__first_name", "user__last_name"]

    def get_serializer_class(self):
        if self.action == "create":
            return PrintOrderCreateSerializer
        return PrintOrderSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return PrintOrder.objects.none()

        acting_role = get_acting_role(self.request)
        qs = PrintOrder.objects.filter(college=user.college).select_related(
            "user", "handled_by"
        )
        if acting_role in ["PRINT_STAFF", "PRINCIPAL"]:
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(college=user.college, user=user)

    @action(detail=False, methods=["post"])
    def calculate_price(self, request):
        """Estimate price for given options before ordering."""
        pricing, _ = PrintPricing.objects.get_or_create(college=request.user.college)

        page_count = int(request.data.get("page_count", 1))
        copies = int(request.data.get("copies", 1))
        print_color = request.data.get("print_color", "BW")
        print_side = request.data.get("print_side", "SINGLE")
        paper_size = request.data.get("paper_size", "A4")
        binding_type = request.data.get("binding_type", "NONE")
        lamination = bool(request.data.get("lamination", False))

        dummy_order = PrintOrder(
            college=request.user.college,
            user=request.user,
            page_count=page_count,
            copies=copies,
            print_color=print_color,
            print_side=print_side,
            paper_size=paper_size,
            binding_type=binding_type,
            lamination=lamination,
        )
        cost = dummy_order.calculate_cost(pricing)
        return Response({"estimated_amount": str(cost)})

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        acting_role = get_acting_role(request)
        if acting_role not in ["PRINT_STAFF", "PRINCIPAL"]:
            return Response({
                "success": False,
                "message": "Only Print Staff or Principal can update order statuses.",
                "code": "PERMISSION_DENIED"
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        serializer = PrintStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        order.status = new_status
        order.handled_by = request.user

        if new_status == PrintOrder.OrderStatus.COMPLETED:
            order.completed_at = timezone.now()
            order.payment_status = PrintOrder.PaymentStatus.PAID

        order.save()

        # Send notification on status update to ordering user
        status_label = dict(PrintOrder.OrderStatus.choices).get(new_status, new_status)
        if new_status == PrintOrder.OrderStatus.READY_FOR_PICKUP:
            notif_title = "Print Order Ready for Pickup"
        else:
            notif_title = f"Print Order Status: {status_label}"

        Notification.objects.create(
            college=order.college,
            recipient=order.user,
            title=notif_title,
            message=f"Order {order.order_number} ({order.document_name}) is now '{status_label}'.",
            notification_type="SYSTEM",
            action_url="/dashboard/printshop",
        )

        return Response(PrintOrderSerializer(order).data)

    @action(detail=True, methods=["post"], url_path="verify-pin")
    def verify_pin(self, request, pk=None):
        """
        POST /api/v1/printshop/{id}/verify-pin/
        Print Staff verifies the 4-digit pickup PIN provided in person by the student.
        Wrong PIN is rejected and counted.
        """
        acting_role = get_acting_role(request)
        if acting_role not in ["PRINT_STAFF", "PRINCIPAL"]:
            return Response({
                "detail": "Only Print Staff or Principal can verify pickup PINs."
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        submitted_pin = str(request.data.get("pin") or request.data.get("pickup_pin", "")).strip()

        if not submitted_pin:
            return Response({"detail": "4-digit pickup PIN is required."}, status=status.HTTP_400_BAD_REQUEST)

        if submitted_pin != str(order.pickup_pin):
            order.failed_pin_attempts += 1
            order.save(update_fields=["failed_pin_attempts"])
            return Response({
                "detail": f"Incorrect pickup PIN. Total failed attempts: {order.failed_pin_attempts}."
            }, status=status.HTTP_400_BAD_REQUEST)

        order.status = PrintOrder.OrderStatus.COMPLETED
        order.completed_at = timezone.now()
        order.handled_by = request.user
        order.payment_status = PrintOrder.PaymentStatus.PAID
        order.save()

        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=order.college,
            user=request.user,
            acting_role=acting_role,
            action='PRINT_ORDER_PICKUP_VERIFIED',
            resource_type='PrintOrder',
            resource_id=str(order.id),
            ip_address=ip_addr,
            new_values={
                'order_number': order.order_number,
                'status': order.status,
                'failed_pin_attempts': order.failed_pin_attempts,
            }
        )

        return Response(PrintOrderSerializer(order).data, status=status.HTTP_200_OK)
