import uuid
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember
from faculty.models import Faculty
from payroll.models import SalaryStructure, Payslip
from payroll.serializers import (
    SalaryStructureSerializer,
    PayslipSerializer,
    GeneratePayrollSerializer,
)


class SalaryStructureViewSet(viewsets.ModelViewSet):
    serializer_class = SalaryStructureSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ["PRINCIPAL", "SUPER_ADMIN"]:
            return SalaryStructure.objects.none()
        return SalaryStructure.objects.filter(
            college=user.college
        ).select_related("faculty", "faculty__user", "faculty__department")

    def perform_create(self, serializer):
        serializer.save(college=self.request.user.college)


class PayslipViewSet(viewsets.ModelViewSet):
    serializer_class = PayslipSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["month", "year", "status", "faculty"]

    def get_queryset(self):
        user = self.request.user
        qs = Payslip.objects.filter(
            college=user.college
        ).select_related("faculty", "faculty__user", "faculty__department")

        if user.role in ["FACULTY", "HOD", "MENTOR"]:
            if hasattr(user, "faculty_profile"):
                return qs.filter(faculty=user.faculty_profile)
            return Payslip.objects.none()
        elif user.role not in ["PRINCIPAL", "SUPER_ADMIN"]:
            return Payslip.objects.none()
        return qs

    def perform_create(self, serializer):
        serializer.save(college=self.request.user.college)

    @action(detail=False, methods=["post"])
    def generate_monthly(self, request):
        """Generates monthly payroll payslips for all active faculty with salary structures."""
        user = request.user
        if user.role not in ["PRINCIPAL", "SUPER_ADMIN"]:
            return Response(
                {"error": "Only institutional administrators can generate payroll"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GeneratePayrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        month = serializer.validated_data["month"]
        year = serializer.validated_data["year"]

        structures = SalaryStructure.objects.filter(
            college=user.college, faculty__status="ACTIVE"
        ).select_related("faculty")

        generated_count = 0
        updated_count = 0

        for s in structures:
            allowances = s.hra + s.da + s.special_allowance
            deductions = s.pf_deduction + s.other_deductions
            tax = s.tax_deduction

            payslip, created = Payslip.objects.get_or_create(
                college=user.college,
                faculty=s.faculty,
                month=month,
                year=year,
                defaults={
                    "basic_salary": s.basic_salary,
                    "allowances": allowances,
                    "gross_salary": s.basic_salary + allowances,
                    "deductions": deductions,
                    "tax_deducted": tax,
                    "net_salary": s.basic_salary + allowances - deductions - tax,
                    "status": "PROCESSED",
                    "working_days": 30,
                    "present_days": 30,
                    "leave_days": 0,
                },
            )
            if created:
                generated_count += 1
            else:
                payslip.basic_salary = s.basic_salary
                payslip.allowances = allowances
                payslip.deductions = deductions
                payslip.tax_deducted = tax
                payslip.save()
                updated_count += 1

        return Response({
            "message": f"Successfully processed payroll for {month:02d}/{year}",
            "generated": generated_count,
            "updated": updated_count,
            "total_faculty": structures.count(),
        })

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        """Marks a payslip as disbursed with reference number."""
        user = request.user
        if user.role not in ["PRINCIPAL", "SUPER_ADMIN"]:
            return Response({"error": "Unauthorized to disburse payroll"}, status=status.HTTP_403_FORBIDDEN)

        payslip = self.get_object()
        tx_ref = request.data.get("transaction_ref", f"SAL-TXN-{uuid.uuid4().hex[:8].upper()}")
        method = request.data.get("payment_method", "DIRECT_DEPOSIT")

        payslip.status = "PAID"
        payslip.payment_date = timezone.now().date()
        payslip.transaction_ref = tx_ref
        payslip.payment_method = method
        payslip.save()

        return Response(PayslipSerializer(payslip).data)
