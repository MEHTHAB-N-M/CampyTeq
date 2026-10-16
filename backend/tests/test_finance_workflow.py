import pytest
from decimal import Decimal
from datetime import date, timedelta
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from departments.models import Department
from academics.models import Course, Batch, Semester
from faculty.models import Faculty
from students.models import Student
from fees.models import FeeStructure, StudentInvoice, Payment, PaymentReceipt


@pytest.mark.django_db
class TestFinanceWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-FIN", slug="apex-fin", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Univ", code="BETA-FIN", slug="beta-fin", status="ACTIVE")

        # Users
        self.principal = User.objects.create_user(
            email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college, first_name="Rajesh"
        )
        self.accountant = User.objects.create_user(
            email="accountant@apex.edu", password="Password123!", role="ACCOUNTANT", college=self.college, first_name="Suresh"
        )
        self.faculty_user = User.objects.create_user(
            email="faculty@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Priya"
        )
        self.student_user = User.objects.create_user(
            email="student@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rahul"
        )
        self.other_user = User.objects.create_user(
            email="accountant@beta.edu", password="Password123!", role="ACCOUNTANT", college=self.other_college, first_name="BetaAcc"
        )

        # Structure
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.faculty = Faculty.objects.create(
            user=self.faculty_user, college=self.college, faculty_number="FAC-FIN-01", department=self.dept,
            designation="PROFESSOR", qualification="Ph.D.", joining_date=date(2020, 1, 1), status="ACTIVE"
        )
        self.course = Course.objects.create(
            college=self.college, department=self.dept, name="B.Tech CSE", code="BTECH-CSE", duration_years=4, total_semesters=8
        )
        self.batch = Batch.objects.create(
            college=self.college, course=self.course, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.semester = Semester.objects.create(
            college=self.college, batch=self.batch, semester_number=1, name="Sem 1", is_current=True
        )

        # Student
        self.student = Student.objects.create(
            user=self.student_user, college=self.college, student_number="STU-FIN-01", roll_number="CSE-FIN-01",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

    def test_fee_invoice_creation_and_payment_flow(self):
        """Student invoice creation, partial payment, balance recalculation, and receipt generation."""
        # 1. Create Invoice
        invoice = StudentInvoice.objects.create(
            college=self.college,
            student=self.student,
            title="Semester 1 Regular Tuition",
            subtotal=Decimal("50000.00"),
            discount_amount=Decimal("0.00"),
            due_date=date.today() + timedelta(days=30),
        )
        assert invoice.final_amount == Decimal("50000.00")
        assert invoice.balance_due == Decimal("50000.00")
        assert invoice.status == "PENDING"

        # 2. Student pays partial amount of ₹30,000 via UPI
        self.client.force_authenticate(user=self.student_user)
        pay_res = self.client.post(f"/api/v1/fees/invoices/{invoice.id}/pay/", {
            "amount": "30000.00",
            "payment_method": "UPI",
            "transaction_reference": "UPI-TEST-123456",
            "remarks": "First installment payment",
        })
        assert pay_res.status_code == 201, pay_res.data
        assert pay_res.data["invoice"]["status"] == "PARTIALLY_PAID"
        assert Decimal(pay_res.data["invoice"]["paid_amount"]) == Decimal("30000.00")
        assert Decimal(pay_res.data["invoice"]["balance_due"]) == Decimal("20000.00")

        # 3. Verify Payment and Receipt created
        payments = Payment.objects.filter(invoice=invoice)
        assert payments.count() == 1
        assert payments.first().amount == Decimal("30000.00")
        assert PaymentReceipt.objects.filter(invoice=invoice).count() == 1

        # 4. Settle remainder ₹20,000 to transition to PAID
        settle_res = self.client.post(f"/api/v1/fees/invoices/{invoice.id}/pay/", {
            "amount": "20000.00",
            "payment_method": "NET_BANKING",
            "transaction_reference": "NETBANK-TEST-9988",
        })
        assert settle_res.status_code == 201
        assert settle_res.data["invoice"]["status"] == "PAID"
        assert Decimal(settle_res.data["invoice"]["balance_due"]) == Decimal("0.00")
        assert Payment.objects.filter(invoice=invoice).count() == 2

    def test_fees_tenant_isolation(self):
        """Beta College user cannot access Apex College invoices or payments."""
        invoice = StudentInvoice.objects.create(
            college=self.college,
            student=self.student,
            title="Tuition Fee",
            subtotal=Decimal("40000.00"),
            due_date=date.today() + timedelta(days=15),
        )

        self.client.force_authenticate(user=self.other_user)

        # Attempt to list Apex invoices
        inv_res = self.client.get("/api/v1/fees/invoices/")
        assert inv_res.status_code == 200
        count = inv_res.data.get("count", len(inv_res.data))
        assert count == 0

        # Attempt direct lookup
        direct_res = self.client.get(f"/api/v1/fees/invoices/{invoice.id}/")
        assert direct_res.status_code == 404
