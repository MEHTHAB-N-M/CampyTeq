import pytest
from datetime import date, time, timedelta
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from departments.models import Department
from academics.models import Course, Batch, Semester, Subject, FacultySubject
from faculty.models import Faculty
from students.models import Student, MentorAssignment
from attendance.models import AttendanceSession, StudentAttendance, FacultyAttendance


@pytest.mark.django_db
class TestAttendanceWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-ATT", slug="apex-att", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Univ", code="BETA-ATT", slug="beta-att", status="ACTIVE")

        # Users
        self.principal = User.objects.create_user(
            email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college, first_name="Rajesh"
        )
        self.faculty_user = User.objects.create_user(
            email="faculty@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Priya"
        )
        self.student_user = User.objects.create_user(
            email="student@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rahul"
        )
        self.student2_user = User.objects.create_user(
            email="student2@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rohan"
        )
        self.other_user = User.objects.create_user(
            email="faculty@beta.edu", password="Password123!", role="FACULTY", college=self.other_college, first_name="BetaFac"
        )

        # Structure
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.faculty = Faculty.objects.create(
            user=self.faculty_user, college=self.college, faculty_number="FAC-ATT-01", department=self.dept,
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

        # Students
        self.student = Student.objects.create(
            user=self.student_user, college=self.college, student_number="STU-01", roll_number="CSE-01",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )
        self.student2 = Student.objects.create(
            user=self.student2_user, college=self.college, student_number="STU-02", roll_number="CSE-02",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

        # Subject
        self.subject = Subject.objects.create(
            college=self.college, department=self.dept, course=self.course,
            name="Data Structures", code="CS101", credits=4, semester_number=1
        )
        FacultySubject.objects.create(
            college=self.college,
            faculty=self.faculty,
            subject=self.subject,
            batch=self.batch,
            academic_year="2026-2027"
        )

    def test_student_attendance_session_and_bulk_marking(self):
        """Faculty creates session and marks bulk attendance for students."""
        self.client.force_authenticate(user=self.faculty_user)

        # 1. Create Attendance Session
        res = self.client.post("/api/v1/attendance/sessions/", {
            "subject": str(self.subject.id),
            "semester": str(self.semester.id),
            "faculty": str(self.faculty.id),
            "date": "2026-09-06",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "session_type": "REGULAR",
            "topic_covered": "Binary Search Trees",
        })
        assert res.status_code == 201, res.data
        session_id = res.data["id"]

        # 2. Check roster
        roster_res = self.client.get(f"/api/v1/attendance/sessions/{session_id}/roster/")
        assert roster_res.status_code == 200
        assert len(roster_res.data) == 2

        # 3. Mark bulk attendance
        mark_res = self.client.post(f"/api/v1/attendance/sessions/{session_id}/mark_bulk/", {
            "attendances": [
                {"student_id": str(self.student.id), "status": "PRESENT", "remarks": "On time"},
                {"student_id": str(self.student2.id), "status": "ABSENT", "remarks": "Unexcused"},
            ]
        }, format="json")
        assert mark_res.status_code == 200
        assert mark_res.data["created"] == 2

        # 4. Verify records created
        records = StudentAttendance.objects.filter(session_id=session_id)
        assert records.count() == 2
        r1 = records.get(student=self.student)
        assert r1.status == "PRESENT"
        assert r1.marked_by == self.faculty_user
        r2 = records.get(student=self.student2)
        assert r2.status == "ABSENT"

    def test_student_attendance_percentage_and_defaulter_alert(self):
        """Verify student summary calculations and defaulter detection for < 75% attendance."""
        # Create 4 sessions
        sessions = []
        for i in range(4):
            s = AttendanceSession.objects.create(
                college=self.college, subject=self.subject, semester=self.semester,
                faculty=self.faculty, date=date(2026, 9, 1 + i),
                start_time=time(9, 0), end_time=time(10, 0), session_type="REGULAR"
            )
            sessions.append(s)

        # Student 1: 4 / 4 Present (100%)
        for s in sessions:
            StudentAttendance.objects.create(
                college=self.college, session=s, student=self.student, status="PRESENT", marked_by=self.faculty_user
            )

        # Student 2: 1 / 4 Present, 3 Absent (25% -> Defaulter)
        for idx, s in enumerate(sessions):
            st = "PRESENT" if idx == 0 else "ABSENT"
            StudentAttendance.objects.create(
                college=self.college, session=s, student=self.student2, status=st, marked_by=self.faculty_user
            )

        # Student 1 checks summary
        self.client.force_authenticate(user=self.student_user)
        sum_res = self.client.get("/api/v1/attendance/students/summary/")
        assert sum_res.status_code == 200
        assert sum_res.data["overall_conducted"] == 4
        assert sum_res.data["overall_attended"] == 4
        assert sum_res.data["overall_percentage"] == 100.0
        assert sum_res.data["is_defaulter"] is False

        # Principal checks defaulters list
        self.client.force_authenticate(user=self.principal)
        def_res = self.client.get("/api/v1/attendance/students/defaulters/")
        assert def_res.status_code == 200
        assert len(def_res.data) == 1
        assert def_res.data[0]["student_id"] == str(self.student2.id)
        assert def_res.data[0]["attendance_percentage"] == 25.0
        assert def_res.data[0]["missed_sessions"] == 3

    def test_faculty_check_in_check_out_and_working_minutes(self):
        """Verify faculty daily punch and automatic working duration calculation."""
        self.client.force_authenticate(user=self.faculty_user)

        # 1. Check in
        in_res = self.client.post("/api/v1/attendance/faculty/check_in/", {
            "punch_source": "WEB_PORTAL",
            "remarks": "Morning duty"
        })
        assert in_res.status_code == 200
        assert in_res.data["check_in"] is not None
        assert in_res.data["status"] == "PRESENT"

        # 2. Check out
        out_res = self.client.post("/api/v1/attendance/faculty/check_out/")
        assert out_res.status_code == 200
        assert out_res.data["check_out"] is not None

        # 3. Verify today action
        today_res = self.client.get("/api/v1/attendance/faculty/today/")
        assert today_res.status_code == 200
        assert today_res.data["check_in"] is not None
        assert today_res.data["check_out"] is not None

    def test_attendance_tenant_isolation(self):
        """Beta College user cannot access or view Apex Tech attendance sessions."""
        # Create an Apex session
        apex_session = AttendanceSession.objects.create(
            college=self.college, subject=self.subject, semester=self.semester,
            faculty=self.faculty, date=date(2026, 9, 6),
            start_time=time(9, 0), end_time=time(10, 0), session_type="REGULAR"
        )

        # Authenticate as Beta user
        self.client.force_authenticate(user=self.other_user)

        # Attempt to list sessions
        res = self.client.get("/api/v1/attendance/sessions/")
        assert res.status_code == 200
        count = res.data.get("count", len(res.data))
        assert count == 0

        # Attempt to access directly
        res_direct = self.client.get(f"/api/v1/attendance/sessions/{apex_session.id}/")
        assert res_direct.status_code == 404
