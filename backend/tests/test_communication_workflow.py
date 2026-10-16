import pytest
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from departments.models import Department
from academics.models import Course, Batch, Semester
from faculty.models import Faculty
from students.models import Student, MentorAssignment
from communication.models import (
    Announcement,
    Notification,
    Document,
)
from leave.models import LeaveRequest


@pytest.mark.django_db
class TestCommunicationWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-COMM", slug="apex-comm", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-COMM", slug="beta-comm", status="ACTIVE")

        # Users
        self.principal = User.objects.create_user(
            email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college, first_name="Rajesh"
        )
        self.hod_user = User.objects.create_user(
            email="hod@apex.edu", password="Password123!", role="HOD", college=self.college, first_name="Aruna"
        )
        self.mentor_user = User.objects.create_user(
            email="mentor@apex.edu", password="Password123!", role="MENTOR", college=self.college, first_name="Anil"
        )
        self.faculty_user = User.objects.create_user(
            email="faculty@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Priya"
        )
        self.student_user = User.objects.create_user(
            email="student@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rahul"
        )
        self.student_user_2 = User.objects.create_user(
            email="student2@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Ananya"
        )
        self.other_user = User.objects.create_user(
            email="user@beta.edu", password="Password123!", role="STUDENT", college=self.other_college, first_name="BetaUser"
        )

        # Department & Faculty profiles
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.faculty_priya = Faculty.objects.create(
            user=self.faculty_user, college=self.college, faculty_number="FAC-COMM-01", department=self.dept,
            designation="ASSISTANT_PROFESSOR", qualification="M.Tech", joining_date=date(2021, 1, 1), status="ACTIVE"
        )
        self.faculty_mentor = Faculty.objects.create(
            user=self.mentor_user, college=self.college, faculty_number="FAC-COMM-02", department=self.dept,
            designation="ASSOCIATE_PROFESSOR", qualification="Ph.D.", joining_date=date(2019, 1, 1), status="ACTIVE"
        )
        self.faculty_hod = Faculty.objects.create(
            user=self.hod_user, college=self.college, faculty_number="FAC-COMM-03", department=self.dept,
            designation="PROFESSOR", qualification="Ph.D.", joining_date=date(2018, 1, 1), status="ACTIVE"
        )

        # Academic hierarchy
        self.course = Course.objects.create(
            college=self.college, department=self.dept, name="B.Tech CSE", code="BTECH-COMM", duration_years=4, total_semesters=8
        )
        self.batch = Batch.objects.create(
            college=self.college, course=self.course, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.semester = Semester.objects.create(
            college=self.college, batch=self.batch, semester_number=1, name="Sem 1", is_current=True
        )

        # Students
        self.student = Student.objects.create(
            user=self.student_user, college=self.college, student_number="STU-COMM-01", roll_number="CSE-COMM-01",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            mentor=self.faculty_mentor, admission_date=date(2026, 8, 1), status="ACTIVE"
        )
        self.student_2 = Student.objects.create(
            user=self.student_user_2, college=self.college, student_number="STU-COMM-02", roll_number="CSE-COMM-02",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

        # Mentor Assignment
        MentorAssignment.objects.create(
            college=self.college, mentor=self.faculty_mentor, student=self.student,
            assigned_on=timezone.now(), is_active=True
        )

    def test_announcements_audience_scoping_and_tenancy(self):
        # 1. Create announcements with different audiences
        Announcement.objects.create(
            college=self.college, title="College Fest", content="Fun times",
            target_audience="ENTIRE_COLLEGE", created_by=self.principal
        )
        Announcement.objects.create(
            college=self.college, title="Exam Circular", content="Read hall tickets",
            target_audience="STUDENTS_ONLY", created_by=self.principal
        )
        Announcement.objects.create(
            college=self.college, title="Faculty Meeting", content="Staff room meeting",
            target_audience="FACULTY_ONLY", created_by=self.principal
        )
        # Beta college announcement
        Announcement.objects.create(
            college=self.other_college, title="Beta Secret", content="Beta only",
            target_audience="ENTIRE_COLLEGE", created_by=self.other_user
        )

        # Student checks announcements: Should see ENTIRE_COLLEGE & STUDENTS_ONLY (2), but NOT FACULTY_ONLY and NOT Beta
        self.client.force_authenticate(user=self.student_user)
        res = self.client.get("/api/v1/communication/announcements/")
        assert res.status_code == 200
        titles = [item["title"] for item in res.data["results"] if "results" in res.data] or [item["title"] for item in res.data]
        assert "College Fest" in titles
        assert "Exam Circular" in titles
        assert "Faculty Meeting" not in titles
        assert "Beta Secret" not in titles

        # Faculty checks announcements: Should see ENTIRE_COLLEGE & FACULTY_ONLY (2), but NOT STUDENTS_ONLY
        self.client.force_authenticate(user=self.faculty_user)
        res = self.client.get("/api/v1/communication/announcements/")
        assert res.status_code == 200
        titles = [item["title"] for item in res.data["results"] if "results" in res.data] or [item["title"] for item in res.data]
        assert "College Fest" in titles
        assert "Faculty Meeting" in titles
        assert "Exam Circular" not in titles
        assert "Beta Secret" not in titles

    def test_notifications_lifecycle(self):
        n1 = Notification.objects.create(
            college=self.college, recipient=self.student_user, title="Alert 1",
            message="Msg 1", notification_type="ACADEMIC", is_read=False
        )
        n2 = Notification.objects.create(
            college=self.college, recipient=self.student_user, title="Alert 2",
            message="Msg 2", notification_type="FEE_DUE", is_read=False
        )
        # Notification for faculty
        Notification.objects.create(
            college=self.college, recipient=self.faculty_user, title="Fac Alert",
            message="Staff msg", notification_type="ANNOUNCEMENT", is_read=False
        )

        self.client.force_authenticate(user=self.student_user)

        # Unread count
        res = self.client.get("/api/v1/communication/notifications/unread_count/")
        assert res.status_code == 200
        assert res.data["unread_count"] == 2

        # Mark single read
        res = self.client.post(f"/api/v1/communication/notifications/{n1.id}/mark_read/")
        assert res.status_code == 200
        n1.refresh_from_db()
        assert n1.is_read is True

        # Unread count should now be 1
        res = self.client.get("/api/v1/communication/notifications/unread_count/")
        assert res.data["unread_count"] == 1

        # Mark all read
        res = self.client.post("/api/v1/communication/notifications/mark_all_read/")
        assert res.status_code == 200
        n2.refresh_from_db()
        assert n2.is_read is True

        res = self.client.get("/api/v1/communication/notifications/unread_count/")
        assert res.data["unread_count"] == 0


    def test_documents_repository_and_scoping(self):
        # Doc 1: Student 1 private certificate
        doc1 = Document.objects.create(
            college=self.college, title="Rahul Bonafide",
            document_type="BONAFIDE_CERTIFICATE", student=self.student,
            file_url="/docs/rahul.pdf", status="VERIFIED"
        )
        # Doc 2: Student 2 private certificate
        doc2 = Document.objects.create(
            college=self.college, title="Ananya Grade Sheet",
            document_type="GRADE_SHEET", student=self.student_2,
            file_url="/docs/ananya.pdf", status="VERIFIED"
        )
        # Doc 3: Public syllabus (student=None)
        doc3 = Document.objects.create(
            college=self.college, title="B.Tech Syllabus",
            document_type="SYLLABUS_COPY", student=None,
            file_url="/docs/syllabus.pdf", status="VERIFIED"
        )

        # Student 1 logs in
        self.client.force_authenticate(user=self.student_user)
        res = self.client.get("/api/v1/communication/documents/")
        assert res.status_code == 200
        doc_ids = [str(d["id"]) for d in (res.data.get("results") or res.data)]
        assert str(doc1.id) in doc_ids
        assert str(doc3.id) in doc_ids
        assert str(doc2.id) not in doc_ids  # Should NOT see Student 2's doc!

        # Faculty logs in: can see all documents in college
        self.client.force_authenticate(user=self.faculty_user)
        res = self.client.get("/api/v1/communication/documents/")
        assert res.status_code == 200
        doc_ids = [str(d["id"]) for d in (res.data.get("results") or res.data)]
        assert str(doc1.id) in doc_ids
        assert str(doc2.id) in doc_ids
        assert str(doc3.id) in doc_ids

    def test_leave_request_approval_workflow_and_isolation(self):
        # Student applies for leave
        self.client.force_authenticate(user=self.student_user)
        leave_data = {
            "leave_type": "CASUAL",
            "from_date": str(date.today() + timedelta(days=5)),
            "to_date": str(date.today() + timedelta(days=6)),
            "reason": "Family function",
        }
        res = self.client.post("/api/v1/leave/requests/", leave_data)
        assert res.status_code == 201
        leave_id = res.data["id"]

        leave_obj = LeaveRequest.objects.get(id=leave_id)
        assert leave_obj.status == "PENDING"
        assert leave_obj.days_count == 2

        # Mentor checks leave requests: Should see Rahul's request because Rahul is assigned cohort
        self.client.force_authenticate(user=self.mentor_user)
        res = self.client.get("/api/v1/leave/requests/")
        assert res.status_code == 200
        req_ids = [str(r["id"]) for r in (res.data.get("results") or res.data)]
        assert str(leave_id) in req_ids

        # Mentor approves the leave
        res = self.client.post(f"/api/v1/leave/requests/{leave_id}/approve/", {
            "approval_remarks": "Approved by mentor."
        })
        assert res.status_code == 200
        assert res.data["status"] == "APPROVED"

        leave_obj.refresh_from_db()
        assert leave_obj.status == "APPROVED"
        assert leave_obj.approved_by == self.mentor_user
        assert leave_obj.approval_remarks == "Approved by mentor."

        # Student should have received approval notification
        assert Notification.objects.filter(
            recipient=self.student_user, notification_type="LEAVE_STATUS"
        ).exists()

        # Beta user cannot view or access this leave
        self.client.force_authenticate(user=self.other_user)
        res = self.client.get(f"/api/v1/leave/requests/{leave_id}/")
        assert res.status_code in [403, 404]
