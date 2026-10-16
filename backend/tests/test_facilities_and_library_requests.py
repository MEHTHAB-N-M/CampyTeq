import pytest
from datetime import date, time, timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from colleges.models import College
from departments.models import Department
from facilities.models import Facility, FacilityBooking
from library.models import LibraryBooking


from faculty.models import Faculty


@pytest.mark.django_db
class TestFacilitiesAndLibraryWorkflow:
    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Tech", code="APEX-FAC", slug="apex-fac", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Univ", code="BETA-FAC", slug="beta-fac", status="ACTIVE")

        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")

        self.principal = User.objects.create_user(
            email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college, first_name="Rajesh"
        )
        self.hod = User.objects.create_user(
            email="hod@apex.edu", password="Password123!", role="HOD", college=self.college, first_name="HOD CSE"
        )
        self.hod_profile = Faculty.objects.create(
            user=self.hod, college=self.college, department=self.dept, faculty_number="FAC-HOD", designation="PROFESSOR", joining_date=date(2025, 1, 1)
        )

        self.faculty = User.objects.create_user(
            email="faculty@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Faculty John"
        )
        self.faculty_profile = Faculty.objects.create(
            user=self.faculty, college=self.college, department=self.dept, faculty_number="FAC-01", designation="ASSISTANT_PROFESSOR", joining_date=date(2025, 1, 1)
        )

        self.student = User.objects.create_user(
            email="student@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Student Bob"
        )
        self.lib_faculty = User.objects.create_user(
            email="lib@apex.edu", password="Password123!", role="LIBRARY_FACULTY", college=self.college, first_name="Lib Fac"
        )

        self.hall = Facility.objects.create(
            college=self.college,
            name="Main Seminar Hall",
            facility_type="SEMINAR_HALL",
            capacity=300,
            location="Block A, 3rd Floor",
        )

    def test_facility_booking_workflow(self):
        """Faculty requests facility, HOD approves it, students are blocked."""
        # 1. Student blocked
        self.client.force_authenticate(user=self.student)
        res_stu = self.client.post("/api/v1/facilities/bookings/", {
            "facility": str(self.hall.id),
            "purpose": "Student Hackathon",
            "booking_date": str(date.today() + timedelta(days=5)),
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "expected_attendees": 100,
        })
        assert res_stu.status_code == 403

        # 2. Faculty creates booking
        self.client.force_authenticate(user=self.faculty)
        res_fac = self.client.post("/api/v1/facilities/bookings/", {
            "facility": str(self.hall.id),
            "purpose": "Hands-on Workshop",
            "booking_date": str(date.today() + timedelta(days=5)),
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "expected_attendees": 100,
        })
        assert res_fac.status_code == 201
        booking_id = res_fac.data["id"]
        assert res_fac.data["status"] == "PENDING"

        # 3. HOD approves booking
        self.client.force_authenticate(user=self.hod)
        appr_res = self.client.post(f"/api/v1/facilities/bookings/{booking_id}/approve/")
        assert appr_res.status_code == 200
        assert appr_res.data["status"] == "APPROVED"

    def test_library_booking_workflow(self):
        """Faculty requests library slot, LIBRARY_FACULTY approves it, students are blocked."""
        # 1. Student has no library access
        self.client.force_authenticate(user=self.student)
        res_stu = self.client.post("/api/v1/library/bookings/", {
            "date": str(date.today() + timedelta(days=2)),
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "purpose": "Study Session",
        })
        assert res_stu.status_code == 403

        # 2. Faculty requests booking
        self.client.force_authenticate(user=self.faculty)
        req_res = self.client.post("/api/v1/library/bookings/", {
            "date": str(date.today() + timedelta(days=2)),
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "purpose": "Digital Library Research",
        })
        assert req_res.status_code == 201
        booking_id = req_res.data["id"]
        assert req_res.data["status"] == "PENDING"

        # 3. LIBRARY_FACULTY approves booking
        self.client.force_authenticate(user=self.lib_faculty)
        act_res = self.client.post(f"/api/v1/library/bookings/{booking_id}/approve/")
        assert act_res.status_code == 200
        assert act_res.data["status"] == "APPROVED"
