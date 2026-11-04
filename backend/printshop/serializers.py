from decimal import Decimal
from rest_framework import serializers
from printshop.models import PrintPricing, PrintOrder


class PrintPricingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintPricing
        fields = [
            "id",
            "bw_per_page",
            "color_per_page",
            "duplex_discount_percent",
            "spiral_binding_cost",
            "hard_binding_cost",
            "lamination_per_page",
        ]


class PrintOrderSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_role = serializers.CharField(source="user.role", read_only=True)
    handled_by_name = serializers.CharField(source="handled_by.get_full_name", read_only=True)

    class Meta:
        model = PrintOrder
        fields = [
            "id",
            "order_number",
            "user",
            "user_name",
            "user_email",
            "user_role",
            "document_name",
            "file_url",
            "page_count",
            "copies",
            "print_color",
            "print_side",
            "paper_size",
            "binding_type",
            "lamination",
            "special_instructions",
            "total_amount",
            "payment_status",
            "status",
            "handled_by",
            "handled_by_name",
            "pickup_pin",
            "failed_pin_attempts",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["id", "order_number", "user", "handled_by", "pickup_pin", "failed_pin_attempts", "created_at", "completed_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and request.user.id != instance.user_id and getattr(request.user, "active_role", None) != "SUPER_ADMIN":
            data.pop("pickup_pin", None)
        return data


class PrintOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintOrder
        fields = [
            "id",
            "order_number",
            "document_name",
            "file_url",
            "page_count",
            "copies",
            "print_color",
            "print_side",
            "paper_size",
            "binding_type",
            "lamination",
            "special_instructions",
            "payment_status",
            "total_amount",
            "status",
            "pickup_pin",
            "failed_pin_attempts",
            "created_at",
        ]
        read_only_fields = ["id", "order_number", "total_amount", "status", "pickup_pin", "failed_pin_attempts", "created_at"]

    def create(self, validated_data):
        user = validated_data.pop("user", None) or self.context["request"].user
        college = validated_data.pop("college", None) or user.college

        # Instance to calculate price
        order = PrintOrder(
            college=college,
            user=user,
            **validated_data,
        )
        pricing, _ = PrintPricing.objects.get_or_create(college=college)
        order.total_amount = order.calculate_cost(pricing)
        order.status = PrintOrder.OrderStatus.QUEUED
        order.save()
        return order


class PrintStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=PrintOrder.OrderStatus.choices)
