import pytest
from decimal import Decimal
from datetime import date, timedelta
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from students.models import Student
from departments.models import Department
from academics.models import Course, Batch, Semester
from printshop.models import PrintPricing, PrintOrder
from communication.models import Notification


@pytest.mark.django_db
class TestPrintShopAndLibraryWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-PL", slug="apex-pl", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-PL", slug="beta-pl", status="ACTIVE")

        # Users
        self.student_user = User.objects.create_user(
            email="student@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rahul"
        )
        self.student_user_2 = User.objects.create_user(
            email="student2@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Ananya"
        )
        self.print_staff = User.objects.create_user(
            email="printstaff@apex.edu", password="Password123!", role="PRINT_STAFF", college=self.college, first_name="Dev"
        )
        self.library_staff = User.objects.create_user(
            email="librarystaff@apex.edu", password="Password123!", role="LIBRARY_STAFF", college=self.college, first_name="Anita"
        )
        self.other_user = User.objects.create_user(
            email="user@beta.edu", password="Password123!", role="STUDENT", college=self.other_college, first_name="BetaUser"
        )

        # Department & Student Profile
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.course = Course.objects.create(
            college=self.college, department=self.dept, name="B.Tech CSE", code="BTECH-PL", duration_years=4, total_semesters=8
        )
        self.batch = Batch.objects.create(
            college=self.college, course=self.course, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.semester = Semester.objects.create(
            college=self.college, batch=self.batch, semester_number=1, name="Sem 1", is_current=True
        )
        self.student = Student.objects.create(
            user=self.student_user, college=self.college, student_number="STU-PL-01", roll_number="CSE-PL-01",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

        # Print Pricing
        self.pricing = PrintPricing.objects.create(
            college=self.college,
            bw_per_page=Decimal("2.00"),
            color_per_page=Decimal("10.00"),
            duplex_discount_percent=Decimal("10.00"),
            spiral_binding_cost=Decimal("30.00"),
            hard_binding_cost=Decimal("150.00"),
            lamination_per_page=Decimal("15.00"),
        )

    def test_print_pricing_and_order_cost_calculation(self):
        # 1. Quote endpoint check
        self.client.force_authenticate(user=self.student_user)
        res = self.client.post("/api/v1/printshop/orders/calculate_price/", {
            "page_count": 10,
            "copies": 1,
            "print_color": "BW",
            "print_side": "DUPLEX",
            "binding_type": "SPIRAL",
        })
        assert res.status_code == 200
        # 10 pages * 2.00 = 20.00 - 10% = 18.00 + 30.00 spiral = 48.00
        assert Decimal(res.data["estimated_amount"]) == Decimal("48.00")

        # 2. Submit print order
        order_data = {
            "document_name": "Project_Report.pdf",
            "file_url": "/docs/project_report.pdf",
            "page_count": 10,
            "copies": 1,
            "print_color": "BW",
            "print_side": "DUPLEX",
            "paper_size": "A4",
            "binding_type": "SPIRAL",
            "payment_status": "ON_PICKUP",
        }
        res = self.client.post("/api/v1/printshop/orders/", order_data)
        assert res.status_code == 201
        order_id = res.data["id"]

        order = PrintOrder.objects.get(id=order_id)
        assert order.status == PrintOrder.OrderStatus.QUEUED
        assert order.total_amount == Decimal("48.00")
        assert order.order_number.startswith("PRT-")

    def test_print_order_status_transitions_and_notifications(self):
        order = PrintOrder.objects.create(
            college=self.college,
            user=self.student_user,
            document_name="Lab_Manual.pdf",
            file_url="/docs/manual.pdf",
            page_count=20,
            copies=1,
            total_amount=Decimal("40.00"),
            status=PrintOrder.OrderStatus.QUEUED,
        )

        # Print staff logs in and starts printing
        self.client.force_authenticate(user=self.print_staff)
        res = self.client.post(f"/api/v1/printshop/orders/{order.id}/update_status/", {
            "status": "PRINTING"
        })
        assert res.status_code == 200
        order.refresh_from_db()
        assert order.status == PrintOrder.OrderStatus.PRINTING
        assert order.handled_by == self.print_staff

        # Print staff marks READY_FOR_PICKUP
        res = self.client.post(f"/api/v1/printshop/orders/{order.id}/update_status/", {
            "status": "READY_FOR_PICKUP"
        })
        assert res.status_code == 200
        order.refresh_from_db()
        assert order.status == PrintOrder.OrderStatus.READY_FOR_PICKUP

        # Notification should have been delivered to student
        assert Notification.objects.filter(
            recipient=self.student_user,
            title__contains="Print Order Ready",
        ).exists()

        # Print staff marks COMPLETED
        res = self.client.post(f"/api/v1/printshop/orders/{order.id}/update_status/", {
            "status": "COMPLETED"
        })
        assert res.status_code == 200
        order.refresh_from_db()
        assert order.status == PrintOrder.OrderStatus.COMPLETED
        assert order.completed_at is not None
        assert order.payment_status == PrintOrder.PaymentStatus.PAID

    def test_print_order_tenant_isolation_and_scoping(self):
        order = PrintOrder.objects.create(
            college=self.college,
            user=self.student_user,
            document_name="Confidential.pdf",
            file_url="/docs/confidential.pdf",
            total_amount=Decimal("20.00"),
        )

        # Student 2 from same college cannot see Student 1's order
        self.client.force_authenticate(user=self.student_user_2)
        res = self.client.get("/api/v1/printshop/orders/")
        assert res.status_code == 200
        order_ids = [str(o["id"]) for o in (res.data.get("results") if isinstance(res.data, dict) and "results" in res.data else res.data)]
        assert str(order.id) not in order_ids

        # College B user gets 404
        self.client.force_authenticate(user=self.other_user)
        res = self.client.get(f"/api/v1/printshop/orders/{order.id}/")
        assert res.status_code in [403, 404]
