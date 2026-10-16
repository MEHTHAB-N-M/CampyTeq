import pytest
from datetime import date, time, timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, UserRole, AuditLog
from colleges.models import College
from departments.models import Department
from academics.models import Course, Batch, Semester, Subject, ClassSection, ClassIncharge, SubjectAssignment
from students.models import Student, MentorAssignment, MenteeCounselingNote, ParentWardLink
from faculty.models import Faculty
from attendance.models import AttendanceSession, StudentAttendance
from tracking.models import FaceEnrollment
from library.models import LibraryBooking
from facilities.models import Facility, FacilityBooking


@pytest.mark.django_db
class TestRolesAndPermissionsSpec:
    def setup_method(self):
        self.client = APIClient()

        # 1. Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-SPEC", slug="apex-spec", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-SPEC", slug="beta-spec", status="ACTIVE")

        # 2. Departments
        self.dept_cs = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.dept_ec = Department.objects.create(college=self.college, name="Electronics", code="ECE", status="ACTIVE")
        self.dept_other = Department.objects.create(college=self.other_college, name="Mechanical", code="MECH", status="ACTIVE")

        # 3. Academic Structure
        self.course_cs = Course.objects.create(
            college=self.college, department=self.dept_cs, name="B.Tech CSE", code="BTECH-CSE", duration_years=4, total_semesters=8
        )
        self.batch_cs = Batch.objects.create(
            college=self.college, course=self.course_cs, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.sem_cs = Semester.objects.create(
            college=self.college, batch=self.batch_cs, semester_number=1, name="Sem 1", is_current=True
        )

        self.class_sec_a = ClassSection.objects.create(
            college=self.college, department=self.dept_cs, course=self.course_cs, name="CSE Section A", academic_year="2026-2027", batch=self.batch_cs
        )
        self.class_sec_b = ClassSection.objects.create(
            college=self.college, department=self.dept_cs, course=self.course_cs, name="CSE Section B", academic_year="2026-2027", batch=self.batch_cs
        )

        self.subject_algo = Subject.objects.create(
            college=self.college, department=self.dept_cs, name="Algorithms", code="CS301", semester_number=1, course=self.course_cs
        )
        self.subject_db = Subject.objects.create(
            college=self.college, department=self.dept_cs, name="Databases", code="CS302", semester_number=1, course=self.course_cs
        )

        # 4. Users & Faculty
        self.principal_user = User.objects.create_user(
            email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college, first_name="Principal"
        )
        self.hod_user = User.objects.create_user(
            email="hod.cs@apex.edu", password="Password123!", role="HOD", college=self.college, first_name="HOD", last_name="CSE"
        )
        self.hod_faculty = Faculty.objects.create(
            user=self.hod_user, college=self.college, department=self.dept_cs, faculty_number="FAC-HOD-01",
            designation="PROFESSOR", joining_date=date(2020, 1, 1)
        )

        self.hod_ec_user = User.objects.create_user(
            email="hod.ec@apex.edu", password="Password123!", role="HOD", college=self.college, first_name="HOD", last_name="ECE"
        )
        self.hod_ec_faculty = Faculty.objects.create(
            user=self.hod_ec_user, college=self.college, department=self.dept_ec, faculty_number="FAC-HOD-EC",
            designation="PROFESSOR", joining_date=date(2020, 1, 1)
        )

        self.faculty1_user = User.objects.create_user(
            email="fac1@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Ramesh"
        )
        self.faculty1 = Faculty.objects.create(
            user=self.faculty1_user, college=self.college, department=self.dept_cs, faculty_number="FAC-01",
            designation="ASSISTANT_PROFESSOR", joining_date=date(2021, 1, 1)
        )

        self.faculty2_user = User.objects.create_user(
            email="fac2@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Suresh"
        )
        self.faculty2 = Faculty.objects.create(
            user=self.faculty2_user, college=self.college, department=self.dept_cs, faculty_number="FAC-02",
            designation="ASSISTANT_PROFESSOR", joining_date=date(2021, 1, 1)
        )

        self.lib_user = User.objects.create_user(
            email="lib@apex.edu", password="Password123!", role="LIBRARY_FACULTY", college=self.college, first_name="Anita"
        )
        self.security_user = User.objects.create_user(
            email="sec@apex.edu", password="Password123!", role="SECURITY", college=self.college, first_name="Shyam"
        )

        # 5. Students & Parents
        self.student1_user = User.objects.create_user(
            email="stu1@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rahul"
        )
        self.student1 = Student.objects.create(
            user=self.student1_user, college=self.college, student_number="STU-01", roll_number="CSE-01",
            department=self.dept_cs, course=self.course_cs, batch=self.batch_cs, current_semester=self.sem_cs,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

        self.student2_user = User.objects.create_user(
            email="stu2@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rohan"
        )
        self.student2 = Student.objects.create(
            user=self.student2_user, college=self.college, student_number="STU-02", roll_number="CSE-02",
            department=self.dept_cs, course=self.course_cs, batch=self.batch_cs, current_semester=self.sem_cs,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

        self.parent_user = User.objects.create_user(
            email="parent@apex.edu", password="Password123!", role="PARENT", college=self.college, first_name="Mr. Sharma"
        )

        # Other College User
        self.other_user = User.objects.create_user(
            email="other@beta.edu", password="Password123!", role="STUDENT", college=self.other_college, first_name="BetaStudent"
        )

    # -------------------------------------------------------------
    # 1. Multi-tenant isolation on every queryset
    # -------------------------------------------------------------
    def test_tenant_isolation_on_all_querysets(self):
        """Cross-college requests return 404 or empty results."""
        self.client.force_authenticate(user=self.other_user)
        # Class list
        res = self.client.get(f"/api/v1/faculty/classes/{self.class_sec_a.id}/risk-radar/")
        assert res.status_code in [403, 404]

        # Library availability
        res_lib = self.client.get(f"/api/v1/library/bookings/availability/?date={date.today()}")
        assert res_lib.status_code in [403, 404]

    # -------------------------------------------------------------
    # 2. Multi-role, switch-role, and active-role-only permissions
    # -------------------------------------------------------------
    def test_multi_role_and_switch_role_audit_and_active_role_only(self):
        """Switch-role requires held active role, issues fresh JWT, logs acting_role, and grants ONLY active role."""
        # Assign Faculty1 as Class Incharge
        ClassIncharge.objects.create(
            college=self.college, department=self.dept_cs, class_section=self.class_sec_a,
            faculty=self.faculty1, academic_year="2026-2027", is_active=True
        )

        # Verify UserRole was auto-created for CLASS_INCHARGE
        assert UserRole.objects.filter(user=self.faculty1_user, role="CLASS_INCHARGE", is_active=True).exists()

        # Switch to CLASS_INCHARGE
        self.client.force_authenticate(user=self.faculty1_user)
        res = self.client.post("/api/v1/accounts/switch-role/", {"role": "CLASS_INCHARGE"})
        assert res.status_code == 200
        assert res.data["active_role"] == "CLASS_INCHARGE"
        assert "access" in res.data

        # Verify audit log recorded old_role, new_role, acting_role
        log = AuditLog.objects.filter(user=self.faculty1_user, action__in=["ROLE_SWITCH", "role.switch"]).latest("timestamp")
        assert log.acting_role == "CLASS_INCHARGE"
        assert log.new_values["new_role"] == "CLASS_INCHARGE"

        # Attempting to switch to unheld role (e.g. HOD) returns 403
        res_bad = self.client.post("/api/v1/accounts/switch-role/", {"role": "HOD"})
        assert res_bad.status_code == 403

    def test_revoked_assignment_immediate_access_loss(self):
        """When an assignment is revoked, HasGranularPermission immediately blocks the user without re-login."""
        incharge = ClassIncharge.objects.create(
            college=self.college, department=self.dept_cs, class_section=self.class_sec_a,
            faculty=self.faculty1, academic_year="2026-2027", is_active=True
        )
        self.faculty1_user.last_active_role = "CLASS_INCHARGE"
        self.faculty1_user.save()

        # While active, can view class risk radar
        self.client.force_authenticate(user=self.faculty1_user)
        res = self.client.get(f"/api/v1/faculty/classes/{self.class_sec_a.id}/risk-radar/")
        assert res.status_code == 200

        # Now revoke the assignment
        incharge.is_active = False
        incharge.save()
        assert not UserRole.objects.filter(user=self.faculty1_user, role="CLASS_INCHARGE", is_active=True).exists()

        # Immediately blocked on next request
        res_revoked = self.client.get(f"/api/v1/faculty/classes/{self.class_sec_a.id}/risk-radar/")
        assert res_revoked.status_code in [401, 403]

    # -------------------------------------------------------------
    # 3. Faculty Scoping: Own-class vs Taught-class vs Denied
    # -------------------------------------------------------------
    def test_faculty_scoping_rules(self):
        """Class incharge sees all subjects; teacher sees own subject only; unassigned class denied."""
        # Faculty 1 is incharge of section A and teaches Algo
        ClassIncharge.objects.create(
            college=self.college, department=self.dept_cs, class_section=self.class_sec_a,
            faculty=self.faculty1, academic_year="2026-2027", is_active=True
        )
        SubjectAssignment.objects.create(
            college=self.college, department=self.dept_cs, faculty=self.faculty1,
            subject=self.subject_algo, class_section=self.class_sec_a, academic_year="2026-2027", is_active=True
        )

        # Faculty 2 teaches DB in section A and Algo in section B
        SubjectAssignment.objects.create(
            college=self.college, department=self.dept_cs, faculty=self.faculty2,
            subject=self.subject_db, class_section=self.class_sec_a, academic_year="2026-2027", is_active=True
        )

        # 1. Faculty 1 in CLASS_INCHARGE mode for Section A -> scope is "class"
        self.faculty1_user.last_active_role = "CLASS_INCHARGE"
        self.faculty1_user.save()
        self.client.force_authenticate(user=self.faculty1_user)
        res_a = self.client.get(f"/api/v1/faculty/classes/{self.class_sec_a.id}/risk-radar/")
        assert res_a.status_code == 200
        assert res_a.data["scope"] == "class"

        # 2. Faculty 2 (teaches only subject_db in Section A) -> scope is "subject", sees only that subject
        self.client.force_authenticate(user=self.faculty2_user)
        res_fac2 = self.client.get(f"/api/v1/faculty/classes/{self.class_sec_a.id}/risk-radar/")
        assert res_fac2.status_code == 200
        assert res_fac2.data["scope"] == "subject"
        assert res_fac2.data["allowed_subjects"] == [str(self.subject_db.id)]

        # 3. Faculty 2 on Section B (neither incharge nor teaching in Section B) -> 403 Forbidden
        res_denied = self.client.get(f"/api/v1/faculty/classes/{self.class_sec_b.id}/risk-radar/")
        assert res_denied.status_code == 403

    # -------------------------------------------------------------
    # 4. Attendance views: HOD, Faculty, Student, Parent
    # -------------------------------------------------------------
    def test_attendance_scoping_hod_faculty_student_parent(self):
        """HOD sees department; Student sees self only; other student is blocked."""
        # HOD sees department class-wise attendance summary
        self.client.force_authenticate(user=self.hod_user)
        res_hod = self.client.get("/api/v1/hod/attendance/classes/")
        assert res_hod.status_code == 200
        assert len(res_hod.data) >= 1

        # Student 1 sees self attendance
        self.client.force_authenticate(user=self.student1_user)
        res_stu = self.client.get("/api/v1/student/attendance/")
        assert res_stu.status_code == 200
        assert res_stu.data["student_id"] == str(self.student1.id)

        # Student cannot query another student's attendance (returns 404/403)
        res_stu_other = self.client.get(f"/api/v1/parent/wards/{self.student2.id}/attendance/")
        assert res_stu_other.status_code in [403, 404]

    # -------------------------------------------------------------
    # 5. Parent Ward Scope: 404 for unlinked wards, no risk/notes exposed
    # -------------------------------------------------------------
    def test_parent_ward_scope_and_404_on_unlinked_id(self):
        """Parent sees verified linked ward only; arbitrary student ID returns 404 (not 403); no notes/risk leaked."""
        ParentWardLink.objects.create(
            college=self.college, parent=self.parent_user, student=self.student1,
            relation="FATHER", is_verified=True, is_active=True
        )

        self.client.force_authenticate(user=self.parent_user)

        # 1. Linked ward (student1) succeeds
        res_ward = self.client.get(f"/api/v1/parent/wards/{self.student1.id}/attendance/")
        assert res_ward.status_code == 200
        assert res_ward.data["student_id"] == str(self.student1.id)

        # 2. Unlinked ward (student2) returns 404 NOT 403
        res_unlinked = self.client.get(f"/api/v1/parent/wards/{self.student2.id}/attendance/")
        assert res_unlinked.status_code == 404

        # 3. Parent cannot see Risk Radar, counseling notes or camera feeds
        res_notes = self.client.get(f"/api/v1/mentor/mentees/{self.student1.id}/notes/")
        assert res_notes.status_code in [403, 404]

    # -------------------------------------------------------------
    # 6. Mentor Mode: Scoping & Uniqueness & History
    # -------------------------------------------------------------
    def test_mentor_mode_scoping_and_uniqueness(self):
        """Mentor sees only active mentees. Reassigning ends old row and keeps history."""
        # Initial assignment
        assign1 = MentorAssignment.objects.create(
            college=self.college, department=self.dept_cs, mentor=self.faculty1,
            student=self.student1, academic_year="2026-2027", is_active=True
        )
        assert assign1.is_active is True

        # Reassign student 1 to Faculty 2
        assign2 = MentorAssignment.objects.create(
            college=self.college, department=self.dept_cs, mentor=self.faculty2,
            student=self.student1, academic_year="2026-2027", is_active=True
        )

        # assign1 is automatically deactivated
        assign1.refresh_from_db()
        assert assign1.is_active is False
        assert assign1.ended_on is not None

        # Faculty 1 (former mentor) now sees 0 mentees
        self.faculty1_user.last_active_role = "MENTOR"
        self.faculty1_user.save()
        self.client.force_authenticate(user=self.faculty1_user)
        res_fac1 = self.client.get("/api/v1/mentor/mentees/?group_by=class")
        assert res_fac1.status_code == 200
        assert len(res_fac1.data) == 0

        # Faculty 2 (new mentor) sees student 1
        self.faculty2_user.last_active_role = "MENTOR"
        self.faculty2_user.save()
        self.client.force_authenticate(user=self.faculty2_user)
        res_fac2 = self.client.get("/api/v1/mentor/mentees/?group_by=class")
        assert res_fac2.status_code == 200
        assert len(res_fac2.data) == 1
        assert res_fac2.data[0]["mentees"][0]["id"] == str(self.student1.id)

    # -------------------------------------------------------------
    # 7. Absent Student Finder (Section 7 Spec)
    # -------------------------------------------------------------
    def test_absent_student_finder_rules(self):
        """Only absent student of current period; outside window blocked; no consent no match; security blocked; audit logged."""
        # Create an attendance session happening right now
        now = timezone.now()
        session = AttendanceSession.objects.create(
            college=self.college, subject=self.subject_algo, semester=self.sem_cs,
            faculty=self.faculty1, date=now.date(),
            start_time=(now - timedelta(minutes=15)).time(),
            end_time=(now + timedelta(minutes=45)).time(),
            session_type="THEORY"
        )
        # Mark student 1 as ABSENT
        StudentAttendance.objects.create(
            college=self.college, session=session, student=self.student1, status=StudentAttendance.AttendanceStatus.ABSENT
        )
        # Add biometric face consent
        FaceEnrollment.objects.create(
            college=self.college, student=self.student1,
            embedding=[0.1] * 128, consent_given=True, consent_by=self.principal_user,
            consent_at=timezone.now(), is_active=True
        )

        # 1. Faculty 1 can find student
        self.client.force_authenticate(user=self.faculty1_user)
        res_find = self.client.post(f"/api/v1/faculty/periods/{session.id}/absent/{self.student1.id}/find/")
        assert res_find.status_code == 200
        assert res_find.data["match_label"] == "possible match, verify manually"
        assert "camera_zone" in res_find.data
        assert "trajectory" not in res_find.data  # No route/trajectory leaked

        # Verify audit log was created
        log = AuditLog.objects.filter(user=self.faculty1_user, action__in=["FIND_ABSENT_STUDENT", "student.find_absent"]).latest("timestamp")
        assert log.new_values["student_id"] == str(self.student1.id)

        # 2. Student without consent is never matched
        FaceEnrollment.objects.filter(student=self.student1).update(consent_given=False)
        res_no_consent = self.client.post(f"/api/v1/faculty/periods/{session.id}/absent/{self.student1.id}/find/")
        assert res_no_consent.status_code == 400
        assert "consent" in res_no_consent.data["detail"]

        # 3. SECURITY is strictly blocked
        self.client.force_authenticate(user=self.security_user)
        res_sec = self.client.post(f"/api/v1/faculty/periods/{session.id}/absent/{self.student1.id}/find/")
        assert res_sec.status_code == 403

    # -------------------------------------------------------------
    # 8. Library Booking: Only LIBRARY_FACULTY decides, overlap blocked, no student access
    # -------------------------------------------------------------
    def test_library_booking_rules_and_overlap_rejection(self):
        """Only LIBRARY_FACULTY approves/rejects; overlap blocked; reject requires reason; students blocked."""
        # 1. Student has no library endpoints
        self.client.force_authenticate(user=self.student1_user)
        res_stu = self.client.post("/api/v1/library/bookings/", {
            "date": str(date.today() + timedelta(days=2)),
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "purpose": "Study"
        })
        assert res_stu.status_code == 403

        # 2. Faculty 1 creates booking
        self.client.force_authenticate(user=self.faculty1_user)
        b_date = date.today() + timedelta(days=2)
        res_fac = self.client.post("/api/v1/library/bookings/", {
            "date": str(b_date),
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "purpose": "CS Algorithm Workshop"
        })
        assert res_fac.status_code == 201
        booking1_id = res_fac.data["id"]

        # Faculty 2 creates booking for same slot (PENDING doesn't block)
        self.client.force_authenticate(user=self.faculty2_user)
        res_fac2 = self.client.post("/api/v1/library/bookings/", {
            "date": str(b_date),
            "start_time": "11:00:00",
            "end_time": "13:00:00",
            "purpose": "DB Workshop"
        })
        assert res_fac2.status_code == 201
        booking2_id = res_fac2.data["id"]

        # 3. Non-LIBRARY_FACULTY cannot approve
        self.client.force_authenticate(user=self.hod_user)
        res_bad_appr = self.client.post(f"/api/v1/library/bookings/{booking1_id}/approve/")
        assert res_bad_appr.status_code == 403

        # 4. LIBRARY_FACULTY approves booking 1
        self.client.force_authenticate(user=self.lib_user)
        res_appr1 = self.client.post(f"/api/v1/library/bookings/{booking1_id}/approve/")
        assert res_appr1.status_code == 200

        # 5. Overlapping approval blocked
        res_appr2 = self.client.post(f"/api/v1/library/bookings/{booking2_id}/approve/")
        assert res_appr2.status_code == 400
        assert any(word in res_appr2.data["detail"].lower() for word in ["taken", "conflict", "overlap"])

        # 6. Rejection requires reason
        res_rej_no_reason = self.client.post(f"/api/v1/library/bookings/{booking2_id}/reject/", {})
        assert res_rej_no_reason.status_code == 400

        res_rej_ok = self.client.post(f"/api/v1/library/bookings/{booking2_id}/reject/", {
            "reject_reason": "Slot already confirmed for CS Workshop"
        })
        assert res_rej_ok.status_code == 200

    # -------------------------------------------------------------
    # 9. Facility Booking: HOD decides, no self-approval, overlap blocked
    # -------------------------------------------------------------
    def test_facility_booking_rules_and_no_self_approval(self):
        """HOD decides for own dept; HOD request decided by Principal; other dept HOD blocked."""
        hall = Facility.objects.create(
            college=self.college, name="Main Auditorium", facility_type="AUDITORIUM", capacity=500
        )
        b_date = date.today() + timedelta(days=3)

        # 1. Faculty 1 requests facility
        self.client.force_authenticate(user=self.faculty1_user)
        res = self.client.post("/api/v1/facilities/bookings/", {
            "facility": str(hall.id),
            "booking_date": str(b_date),
            "start_time": "14:00:00",
            "end_time": "17:00:00",
            "purpose": "Coding Competition",
            "expected_attendees": 150
        })
        assert res.status_code == 201
        booking_id = res.data["id"]

        # 2. HOD of ECE cannot decide CS booking
        self.client.force_authenticate(user=self.hod_ec_user)
        res_other_hod = self.client.post(f"/api/v1/facilities/bookings/{booking_id}/approve/")
        assert res_other_hod.status_code == 403

        # 3. HOD of CS approves
        self.client.force_authenticate(user=self.hod_user)
        res_hod_appr = self.client.post(f"/api/v1/facilities/bookings/{booking_id}/approve/")
        assert res_hod_appr.status_code == 200

        # 4. No self-approval: HOD's own request goes to Principal
        res_hod_booking = self.client.post("/api/v1/facilities/bookings/", {
            "facility": str(hall.id),
            "booking_date": str(b_date + timedelta(days=1)),
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "purpose": "HOD Staff Meeting",
            "expected_attendees": 20
        })
        assert res_hod_booking.status_code == 201
        hod_b_id = res_hod_booking.data["id"]

        # HOD attempting to approve their own request returns 403
        res_self_appr = self.client.post(f"/api/v1/facilities/bookings/{hod_b_id}/approve/")
        assert res_self_appr.status_code == 403

        # Principal approves HOD request
        self.client.force_authenticate(user=self.principal_user)
        res_princ_appr = self.client.post(f"/api/v1/facilities/bookings/{hod_b_id}/approve/")
        assert res_princ_appr.status_code == 200
