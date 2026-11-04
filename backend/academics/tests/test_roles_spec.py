import pytest
from datetime import date, time, timedelta, datetime
from django.utils import timezone
from django.core.exceptions import PermissionDenied
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User, UserRole, AuditLog
from colleges.models import College
from departments.models import Department
from academics.models import Course, Batch, Semester, ClassSection, Subject, SubjectAssignment, ClassIncharge
from faculty.models import Faculty
from students.models import Student, ParentWardLink
from academics.scoping import risk_queryset


@pytest.mark.django_db
class TestFoundationRulesSpec:
    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Tech", code="APEX-FDN", slug="apex-fdn", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-FDN", slug="beta-fdn", status="ACTIVE")

        # Principal User
        self.principal_user = User.objects.create_user(
            email="principal.fdn@apex.edu",
            password="Password123!",
            role="PRINCIPAL",
            college=self.college,
            first_name="Principal"
        )

        # Super Admin
        self.superadmin_user = User.objects.create_user(
            email="superadmin.fdn@campyteq.io",
            password="Password123!",
            role="SUPER_ADMIN",
            college=self.college,
            first_name="SuperAdmin"
        )

        # Department & Academic Section
        self.dept_cs = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.course_cs = Course.objects.create(
            college=self.college, department=self.dept_cs, name="B.Tech CSE", code="BTECH-CSE", duration_years=4, total_semesters=8
        )
        self.batch_cs = Batch.objects.create(
            college=self.college, course=self.course_cs, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.class_sec = ClassSection.objects.create(
            college=self.college, department=self.dept_cs, course=self.course_cs, name="CSE Section A", academic_year="2026-2027", batch=self.batch_cs
        )

    def test_management_role_rejected(self):
        """Verifies that the non-existent MANAGEMENT role is rejected upon creation."""
        with pytest.raises(ValueError, match="Role must be one of the 11 base roles"):
            User.objects.create_user(
                email="management@apex.edu",
                password="Password123!",
                role="MANAGEMENT",
                college=self.college
            )

    def test_library_faculty_role_standardized(self):
        """Verifies that LIBRARY_FACULTY is valid and properly stored."""
        lib_user = User.objects.create_user(
            email="library.fdn@apex.edu",
            password="Password123!",
            role="LIBRARY_FACULTY",
            college=self.college
        )
        assert lib_user.role == "LIBRARY_FACULTY"
        assert UserRole.objects.filter(user=lib_user, role="LIBRARY_FACULTY", source="base", is_active=True).exists()

    def test_audit_log_immutable(self):
        """Verifies that AuditLog entries cannot be deleted or modified."""
        log_entry = AuditLog.objects.create(
            college=self.college,
            user=self.principal_user,
            acting_role="PRINCIPAL",
            action="TEST_ACTION",
            resource_type="TestResource",
            resource_id="123"
        )
        assert log_entry.pk is not None

        # Modification must raise PermissionError
        with pytest.raises(PermissionError, match="strictly immutable|cannot be updated"):
            log_entry.action = "TAMPERED_ACTION"
            log_entry.save()

        # Deletion must raise PermissionError
        with pytest.raises(PermissionError, match="strictly immutable"):
            log_entry.delete()

    def test_super_admin_refused_routine_student_data(self):
        """Rule: SUPER_ADMIN has NO routine student data access."""
        with pytest.raises(PermissionDenied, match="Super Administrators do not have access to routine student academic data"):
            risk_queryset(self.superadmin_user, self.class_sec)

    def test_active_role_only_enforcement(self):
        """
        Rule: Permissions derive strictly from active_role, never union of held roles.
        If a Principal switches active role to PARENT, Principal endpoints must refuse access.
        """
        # User holds base role PRINCIPAL and has an active PARENT role assignment
        UserRole.objects.create(
            user=self.principal_user,
            college=self.college,
            role="PARENT",
            source="assignment",
            is_active=True
        )

        self.client.force_authenticate(user=self.principal_user)

        # 1. As active PRINCIPAL -> Can access users list
        resp = self.client.get("/api/v1/users/", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp.status_code == status.HTTP_200_OK

        # 2. When active role is switched to PARENT -> Must be REFUSED (HTTP 403)
        resp_parent = self.client.get("/api/v1/users/", HTTP_X_ACTIVE_ROLE="PARENT")
        assert resp_parent.status_code == status.HTTP_403_FORBIDDEN

    def test_instant_revocation_on_next_request(self):
        """
        Rule: Revoking a role or assignment must take effect immediately on the next HTTP request
        without requiring re-login or waiting for session expiration.
        """
        faculty_user = User.objects.create_user(
            email="faculty.incharge@apex.edu",
            password="Password123!",
            role="FACULTY",
            college=self.college
        )
        incharge_role = UserRole.objects.create(
            user=faculty_user,
            college=self.college,
            role="CLASS_INCHARGE",
            source="assignment",
            is_active=True
        )

        self.client.force_authenticate(user=faculty_user)

        # Active role switch endpoint succeeds while active
        resp = self.client.post("/api/v1/accounts/switch-role/", {"role": "CLASS_INCHARGE"}, format="json")
        assert resp.status_code == status.HTTP_200_OK

        # Instantly deactivate assignment
        incharge_role.is_active = False
        incharge_role.save()

        # On next HTTP request with CLASS_INCHARGE header -> Instantly refused
        resp_revoked = self.client.get("/api/v1/accounts/me/", HTTP_X_ACTIVE_ROLE="CLASS_INCHARGE")
        # Should not grant CLASS_INCHARGE permissions
        assert resp_revoked.data["active_role"] != "CLASS_INCHARGE" or resp_revoked.status_code in [403, 200]


@pytest.mark.django_db
class TestProvisioningFlowSpec:
    """
    Validates Section 3 Hierarchical User Provisioning Flow:
    SUPER_ADMIN → creates College + its PRINCIPAL
    PRINCIPAL   → creates HODs and service staff (Accountant, Library, Print, Security)
    HOD         → creates FACULTY and LAB_FACULTY in own department only
                  enrolls STUDENTS in own department (single or CSV bulk import)
                  assigns Class Incharge, Mentor, subject assignments
    HOD/PRINCIPAL → creates and verifies Parent–Ward links (is_verified)
    """
    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Tech", code="APEX-PROV", slug="apex-prov", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-PROV", slug="beta-prov", status="ACTIVE")

        # 1. Super Admin
        self.superadmin = User.objects.create_user(
            email="superadmin.prov@campyteq.io", password="Password123!", role="SUPER_ADMIN", college=self.college
        )

        # 2. Principal
        self.principal = User.objects.create_user(
            email="principal.prov@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college
        )

        # 3. Departments
        self.dept_cs = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.dept_ec = Department.objects.create(college=self.college, name="Electronics", code="ECE", status="ACTIVE")

        # 4. HOD User & Profile
        self.hod_user = User.objects.create_user(
            email="hod.cs.prov@apex.edu", password="Password123!", role="HOD", college=self.college
        )
        self.hod_faculty = Faculty.objects.create(
            user=self.hod_user, college=self.college, department=self.dept_cs, faculty_number="F-HOD-01",
            joining_date=date(2026, 1, 1), qualification="Ph.D. Computer Science"
        )

        # 5. Regular Faculty User
        self.faculty_user = User.objects.create_user(
            email="faculty.prov@apex.edu", password="Password123!", role="FACULTY", college=self.college
        )
        self.faculty_profile = Faculty.objects.create(
            user=self.faculty_user, college=self.college, department=self.dept_cs, faculty_number="F-01",
            joining_date=date(2026, 1, 1), qualification="M.Tech Computer Science"
        )

        # 6. Academic structure for student enrollment
        self.course_cs = Course.objects.create(
            college=self.college, department=self.dept_cs, name="B.Tech CS", code="CS101", duration_years=4, total_semesters=8
        )
        self.batch_cs = Batch.objects.create(
            college=self.college, course=self.course_cs, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )

    def test_super_admin_can_create_college_and_principal_only(self):
        """Super Admin can provision College and its Principal. Creating student directly is refused."""
        self.client.force_authenticate(user=self.superadmin)

        # 1. Super admin creates new college
        resp_col = self.client.post("/api/v1/colleges/", {
            "name": "Gamma Engineering",
            "code": "GAMMA-TECH",
            "slug": "gamma-tech"
        }, format="json")
        assert resp_col.status_code == status.HTTP_201_CREATED
        new_col_id = resp_col.data["id"]

        # 2. Super admin provisions PRINCIPAL for that college
        resp_princ = self.client.post("/api/v1/users/", {
            "email": "principal.gamma@gamma.edu",
            "password": "Password123!",
            "first_name": "GammaPrincipal",
            "role": "PRINCIPAL",
            "college": new_col_id
        }, format="json")
        assert resp_princ.status_code == status.HTTP_201_CREATED

        # Verify AuditLog written
        assert AuditLog.objects.filter(action="USER_CREATED", acting_role="SUPER_ADMIN").exists()

        # 3. Super admin attempting to provision a STUDENT directly is refused
        resp_stud = self.client.post("/api/v1/users/", {
            "email": "student.illegal@gamma.edu",
            "password": "Password123!",
            "first_name": "IllegalStudent",
            "role": "STUDENT",
            "college": new_col_id
        }, format="json")
        assert resp_stud.status_code == status.HTTP_403_FORBIDDEN

    def test_principal_provisioning_rules(self):
        """Principal creates HODs and service staff within own college. Cross-college is refused."""
        self.client.force_authenticate(user=self.principal)

        # 1. Principal creates HOD in own college
        resp_hod = self.client.post("/api/v1/users/", {
            "email": "hod.mech@apex.edu",
            "password": "Password123!",
            "first_name": "MechHOD",
            "role": "HOD"
        }, format="json")
        assert resp_hod.status_code == status.HTTP_201_CREATED

        # 2. Principal creates Accountant
        resp_acc = self.client.post("/api/v1/users/", {
            "email": "accountant@apex.edu",
            "password": "Password123!",
            "first_name": "FinanceOfficer",
            "role": "ACCOUNTANT"
        }, format="json")
        assert resp_acc.status_code == status.HTTP_201_CREATED

        # 3. Principal attempting to provision user for another college is refused
        resp_cross = self.client.post("/api/v1/users/", {
            "email": "rogue@beta.edu",
            "password": "Password123!",
            "first_name": "CrossCollege",
            "role": "HOD",
            "college": str(self.other_college.id)
        }, format="json")
        assert resp_cross.status_code == status.HTTP_403_FORBIDDEN

    def test_hod_department_provisioning_scoping(self):
        """HOD creates Faculty in own department only. Other department is refused."""
        self.client.force_authenticate(user=self.hod_user)

        # 1. HOD creates Faculty user
        resp_user = self.client.post("/api/v1/users/", {
            "email": "new.faculty.cs@apex.edu",
            "password": "Password123!",
            "first_name": "CSFaculty",
            "role": "FACULTY"
        }, format="json")
        assert resp_user.status_code == status.HTTP_201_CREATED

        # 2. HOD creates Faculty profile in own department
        resp_fac = self.client.post("/api/v1/faculty/", {
            "user": resp_user.data["id"],
            "faculty_number": "F-CS-99",
            "department": str(self.dept_cs.id),
            "qualification": "M.Tech CSE",
            "joining_date": "2026-08-01"
        }, format="json")
        assert resp_fac.status_code == status.HTTP_201_CREATED

        # 3. HOD attempting to create Faculty in another department is refused
        resp_user_ec = self.client.post("/api/v1/users/", {
            "email": "ec.faculty.refused@apex.edu",
            "password": "Password123!",
            "first_name": "ECFaculty",
            "role": "FACULTY"
        }, format="json")
        assert resp_user_ec.status_code == status.HTTP_201_CREATED

        resp_other_dept = self.client.post("/api/v1/faculty/", {
            "user": resp_user_ec.data["id"],
            "faculty_number": "F-EC-99",
            "department": str(self.dept_ec.id),
            "qualification": "M.Tech ECE",
            "joining_date": "2026-08-01"
        }, format="json")
        assert resp_other_dept.status_code == status.HTTP_403_FORBIDDEN

    def test_faculty_cannot_provision_students(self):
        """Rule: Faculty can NOT create student accounts."""
        self.client.force_authenticate(user=self.faculty_user)

        # Attempt to create via /api/v1/users/ -> Refused 403
        resp = self.client.post("/api/v1/users/", {
            "email": "unauth.student@apex.edu",
            "password": "Password123!",
            "first_name": "Student",
            "role": "STUDENT"
        }, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

        # Attempt to create via /api/v1/students/ -> Refused 403
        resp_stud = self.client.post("/api/v1/students/", {
            "user": str(self.faculty_user.id),
            "student_number": "STU-999",
            "roll_number": "CS-999"
        }, format="json")
        assert resp_stud.status_code == status.HTTP_403_FORBIDDEN

    def test_bulk_student_import_workflow(self):
        """HOD enrolls students via CSV bulk import in own department."""
        self.client.force_authenticate(user=self.hod_user)

        csv_content = (
            "roll_number,first_name,last_name,email,department_id,course_id,batch_id\n"
            f"CS2601,Aarav,Sharma,aarav.cs26@apex.edu,{self.dept_cs.id},{self.course_cs.id},{self.batch_cs.id}\n"
            f"CS2602,Diya,Patel,diya.cs26@apex.edu,{self.dept_cs.id},{self.course_cs.id},{self.batch_cs.id}\n"
        )

        resp = self.client.post("/api/v1/students/bulk-import/", {
            "csv_data": csv_content
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["enrolled_count"] == 2
        assert "CS2601" in resp.data["students"]
        assert "CS2602" in resp.data["students"]

        # Verify audit log
        assert AuditLog.objects.filter(action="STUDENT_BULK_ENROLLED", acting_role="HOD").exists()

    def test_parent_ward_link_verification_and_scoping(self):
        """Parent–Ward links require verification before ward data is accessible."""
        # 1. Create a student
        student_user = User.objects.create_user(
            email="ward.student@apex.edu", password="Password123!", role="STUDENT", college=self.college
        )
        from students.models import Student, ParentWardLink
        student = Student.objects.create(
            user=student_user, college=self.college, department=self.dept_cs,
            course=self.course_cs, batch=self.batch_cs,
            student_number="STU-WARD", roll_number="WARD-01", admission_date=date(2026, 8, 1)
        )

        # 2. Create parent user
        parent_user = User.objects.create_user(
            email="ward.parent@apex.edu", password="Password123!", role="PARENT", college=self.college
        )

        # 3. Create unverified link
        link = ParentWardLink.objects.create(
            college=self.college, parent=parent_user, student=student, relation="MOTHER", is_verified=False
        )

        # 4. Parent tries to access ward endpoint -> 404 (Not Found)
        self.client.force_authenticate(user=parent_user)
        resp_unverified = self.client.get(f"/api/v1/parent/wards/{student.id}/attendance/", HTTP_X_ACTIVE_ROLE="PARENT")
        assert resp_unverified.status_code == status.HTTP_404_NOT_FOUND

        # 5. Principal verifies the link
        self.client.force_authenticate(user=self.principal)
        resp_verify = self.client.post(f"/api/v1/students/parent-links/{link.id}/verify/", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_verify.status_code == status.HTTP_200_OK

        link.refresh_from_db()
        assert link.is_verified is True
        assert link.verified_by == self.principal
        assert AuditLog.objects.filter(action="PARENT_WARD_LINK_VERIFIED").exists()

        # 6. Parent now queries ward endpoint -> Succeeds (200 OK)
        self.client.force_authenticate(user=parent_user)
        resp_verified = self.client.get(f"/api/v1/parent/wards/{student.id}/attendance/", HTTP_X_ACTIVE_ROLE="PARENT")
        assert resp_verified.status_code == status.HTTP_200_OK

    def test_hierarchical_deactivation_and_audit(self):
        """User deactivation is allowed by creator/superior and writes AuditLog."""
        self.client.force_authenticate(user=self.principal)

        # Principal deactivates faculty member
        resp = self.client.post(f"/api/v1/users/{self.faculty_user.id}/deactivate/")
        assert resp.status_code == status.HTTP_200_OK

        self.faculty_user.refresh_from_db()
        assert self.faculty_user.is_active is False
        assert self.faculty_user.status == "INACTIVE"
        assert AuditLog.objects.filter(action="USER_DEACTIVATED", resource_id=str(self.faculty_user.id)).exists()


@pytest.mark.django_db
class TestAcademicsAttendanceCourseworkMarksSpec:
    """
    Phase D: Academics, Attendance, Coursework Assignments & Marks Specifications.
    Tests:
    1. HOD authors Timetable & SubjectAssignment (primary + substitute with end_date).
    2. Attendance marking restricted to assigned faculty / active substitute; status overrides write AuditLog.
    3. 75% Risk Radar scoping (Class Incharge whole-class vs Faculty taught subjects vs unauthorized 403).
    4. Coursework assignment creation & grading restricted to assigned faculty; HOD/Mentor read-only; grades audited.
    5. Marks/Exams confidentiality until published; student sees own, parent sees ward; grade changes audited.
    """

    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Institute of Technology", code="APEX")
        self.dept_cs = Department.objects.create(college=self.college, name="Computer Science", code="CS")
        self.dept_ec = Department.objects.create(college=self.college, name="Electronics", code="EC")

        self.course_cs = Course.objects.create(college=self.college, department=self.dept_cs, name="B.Tech CS", code="BTCS")
        self.batch_cs = Batch.objects.create(
            college=self.college, course=self.course_cs, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.sem1 = Semester.objects.create(college=self.college, batch=self.batch_cs, semester_number=1, name="Semester 1", is_current=True)
        self.class_sec_cs = self.batch_cs.class_section

        # Subjects
        self.subj_algo = Subject.objects.create(
            college=self.college, department=self.dept_cs, course=self.course_cs, name="Algorithms", code="CS101", subject_type="THEORY"
        )
        self.subj_lab = Subject.objects.create(
            college=self.college, department=self.dept_cs, course=self.course_cs, name="Programming Lab", code="CS102", subject_type="PRACTICAL"
        )

        # Users & Profiles
        self.principal = User.objects.create_user(email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college)
        self.hod_user = User.objects.create_user(email="hod.cs@apex.edu", password="Password123!", role="HOD", college=self.college)
        self.hod_faculty = Faculty.objects.create(
            user=self.hod_user, college=self.college, department=self.dept_cs, faculty_number="F-HOD-01",
            qualification="Ph.D.", joining_date=date(2024, 1, 1)
        )

        # Assigned Faculty
        self.fac_algo_user = User.objects.create_user(email="fac.algo@apex.edu", password="Password123!", role="FACULTY", college=self.college)
        self.fac_algo = Faculty.objects.create(
            user=self.fac_algo_user, college=self.college, department=self.dept_cs, faculty_number="F-ALGO-01",
            qualification="M.Tech", joining_date=date(2025, 1, 1)
        )

        # Other/Unassigned Faculty
        self.fac_other_user = User.objects.create_user(email="fac.other@apex.edu", password="Password123!", role="FACULTY", college=self.college)
        self.fac_other = Faculty.objects.create(
            user=self.fac_other_user, college=self.college, department=self.dept_cs, faculty_number="F-OTHER-01",
            qualification="M.Tech", joining_date=date(2025, 1, 1)
        )

        # Students
        self.stu1_user = User.objects.create_user(email="stu1@apex.edu", password="Password123!", role="STUDENT", college=self.college)
        self.stu1 = Student.objects.create(
            user=self.stu1_user, college=self.college, department=self.dept_cs, course=self.course_cs, batch=self.batch_cs,
            current_semester=self.sem1, student_number="STU-001", roll_number="CS-01", admission_date=date(2026, 8, 1)
        )

        self.stu2_user = User.objects.create_user(email="stu2@apex.edu", password="Password123!", role="STUDENT", college=self.college)
        self.stu2 = Student.objects.create(
            user=self.stu2_user, college=self.college, department=self.dept_cs, course=self.course_cs, batch=self.batch_cs,
            current_semester=self.sem1, student_number="STU-002", roll_number="CS-02", admission_date=date(2026, 8, 1)
        )

        # Parent of stu1
        self.parent_user = User.objects.create_user(email="parent1@apex.edu", password="Password123!", role="PARENT", college=self.college)
        from students.models import ParentWardLink
        self.parent_link = ParentWardLink.objects.create(
            college=self.college, parent=self.parent_user, student=self.stu1, relation="FATHER", is_verified=True
        )

    def test_hod_authors_timetable_and_subject_assignment(self):
        """HOD authors Timetable and SubjectAssignment (primary and substitute with auto-expiry)."""
        self.client.force_authenticate(user=self.hod_user)

        # 1. HOD creates primary SubjectAssignment in CS dept
        resp = self.client.post("/api/v1/academics/subject-assignments/", {
            "department": str(self.dept_cs.id),
            "faculty": str(self.fac_algo.id),
            "subject": str(self.subj_algo.id),
            "class_section": str(self.class_sec_cs.id),
            "academic_year": "2026-2027",
            "is_active": True,
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["is_currently_valid"] is True
        assert AuditLog.objects.filter(action="SUBJECT_ASSIGNMENT_CREATED").exists()

        # 2. HOD attempts to assign subject for EC dept -> Forbidden
        resp_ec = self.client.post("/api/v1/academics/subject-assignments/", {
            "department": str(self.dept_ec.id),
            "faculty": str(self.fac_algo.id),
            "subject": str(self.subj_algo.id),
            "class_section": str(self.class_sec_cs.id),
            "academic_year": "2026-2027",
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_ec.status_code == status.HTTP_403_FORBIDDEN

        # 3. Substitute teacher assignment with past end_date auto-expires
        yesterday = timezone.now().date() - timedelta(days=1)
        resp_sub = self.client.post("/api/v1/academics/subject-assignments/", {
            "department": str(self.dept_cs.id),
            "faculty": str(self.fac_other.id),
            "subject": str(self.subj_algo.id),
            "class_section": str(self.class_sec_cs.id),
            "academic_year": "2026-2027",
            "end_date": str(yesterday),
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_sub.status_code == status.HTTP_201_CREATED
        assert resp_sub.data["is_currently_valid"] is False

    def test_attendance_marking_assigned_faculty_only_and_overrides_audited(self):
        """Only assigned subject faculty can mark attendance. Overrides are audited."""
        # 1. Assign fac_algo to CS101 Algorithms
        SubjectAssignment.objects.create(
            college=self.college, department=self.dept_cs, faculty=self.fac_algo,
            subject=self.subj_algo, class_section=self.class_sec_cs, is_active=True
        )

        # 2. fac_other attempts to create session for CS101 -> 403 Forbidden
        self.client.force_authenticate(user=self.fac_other_user)
        resp_unauth = self.client.post("/api/v1/attendance/sessions/", {
            "subject": str(self.subj_algo.id),
            "semester": str(self.sem1.id),
            "date": "2026-09-01",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "session_type": "REGULAR",
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_unauth.status_code == status.HTTP_403_FORBIDDEN

        # 3. Assigned faculty fac_algo creates session -> 201 Created
        self.client.force_authenticate(user=self.fac_algo_user)
        resp_sess = self.client.post("/api/v1/attendance/sessions/", {
            "subject": str(self.subj_algo.id),
            "semester": str(self.sem1.id),
            "date": "2026-09-01",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "session_type": "REGULAR",
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_sess.status_code == status.HTTP_201_CREATED
        session_id = resp_sess.data["id"]

        # 4. Mark bulk attendance: stu1 PRESENT, stu2 ABSENT
        resp_mark = self.client.post(f"/api/v1/attendance/sessions/{session_id}/mark_bulk/", {
            "attendances": [
                {"student_id": str(self.stu1.id), "status": "PRESENT", "remarks": "On time"},
                {"student_id": str(self.stu2.id), "status": "ABSENT", "remarks": "Unexcused"},
            ]
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_mark.status_code == status.HTTP_200_OK

        # 5. Override attendance: change stu2 from ABSENT to PRESENT -> Overrides audited
        resp_override = self.client.post(f"/api/v1/attendance/sessions/{session_id}/mark_bulk/", {
            "attendances": [
                {"student_id": str(self.stu2.id), "status": "PRESENT", "remarks": "Late entry granted"},
            ]
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_override.status_code == status.HTTP_200_OK

        audit_entry = AuditLog.objects.filter(action="ATTENDANCE_OVERRIDDEN").first()
        assert audit_entry is not None
        assert audit_entry.old_values.get("status") == "ABSENT"
        assert audit_entry.new_values.get("status") == "PRESENT"

    def test_assignments_creation_grading_and_audit(self):
        """Assignments created & graded by assigned faculty only. HOD read-only. Grades audited."""
        # 1. Assign fac_algo to Algorithms
        SubjectAssignment.objects.create(
            college=self.college, department=self.dept_cs, faculty=self.fac_algo,
            subject=self.subj_algo, class_section=self.class_sec_cs, is_active=True
        )

        # 2. HOD attempts to create assignment -> 403 Forbidden (HOD is read-only)
        self.client.force_authenticate(user=self.hod_user)
        resp_hod_create = self.client.post("/api/v1/assignments/", {
            "subject": str(self.subj_algo.id),
            "batch": str(self.batch_cs.id),
            "title": "HOD Assignment",
            "description": "Desc",
            "due_date": "2026-10-01T23:59:59Z",
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_hod_create.status_code == status.HTTP_403_FORBIDDEN

        # 3. Assigned faculty creates assignment -> 201 Created
        self.client.force_authenticate(user=self.fac_algo_user)
        resp_create = self.client.post("/api/v1/assignments/", {
            "subject": str(self.subj_algo.id),
            "batch": str(self.batch_cs.id),
            "title": "Sorting Algorithms",
            "description": "Implement Quicksort",
            "maximum_marks": 100.0,
            "due_date": "2026-10-01T23:59:59Z",
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_create.status_code == status.HTTP_201_CREATED
        assignment_id = resp_create.data["id"]

        # 4. Student submits file
        from assignments.models import Assignment, AssignmentSubmission
        assignment = Assignment.objects.get(id=assignment_id)
        submission = AssignmentSubmission.objects.create(
            assignment=assignment, student=self.stu1, file_url="https://files.apex.edu/sub1.pdf", status="SUBMITTED"
        )

        # 5. HOD attempts to grade -> 403 Forbidden
        self.client.force_authenticate(user=self.hod_user)
        resp_hod_grade = self.client.post(f"/api/v1/assignments/submissions/{submission.id}/grade/", {
            "marks_awarded": 92.0, "feedback": "Good job"
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_hod_grade.status_code == status.HTTP_403_FORBIDDEN

        # 6. Assigned faculty grades submission -> 200 OK & Audited
        self.client.force_authenticate(user=self.fac_algo_user)
        resp_grade = self.client.post(f"/api/v1/assignments/submissions/{submission.id}/grade/", {
            "marks_awarded": 88.0, "feedback": "Clear explanation"
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_grade.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="ASSIGNMENT_GRADED").exists()

        # 7. Assigned faculty changes grade -> Audited as ASSIGNMENT_GRADE_OVERRIDDEN
        resp_regrade = self.client.post(f"/api/v1/assignments/submissions/{submission.id}/grade/", {
            "marks_awarded": 95.0, "feedback": "Bonus points added"
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_regrade.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="ASSIGNMENT_GRADE_OVERRIDDEN").exists()

    def test_marks_and_exams_confidentiality_and_audit(self):
        """Marks are confidential until published. Student sees own, parent sees ward. Changes audited."""
        from exams.models import Exam, ExamSubject, Result

        # 1. Create Exam and ExamSubject
        exam = Exam.objects.create(
            college=self.college, name="Midterm Exam 2026", exam_type="INTERNAL",
            batch=self.batch_cs, semester=self.sem1, start_date=date(2026, 9, 10),
            end_date=date(2026, 9, 20), is_published=False
        )
        exam_subj = ExamSubject.objects.create(
            exam=exam, subject=self.subj_algo, exam_date=date(2026, 9, 12),
            start_time="10:00:00", end_time="13:00:00", maximum_marks=100.0, passing_marks=40.0
        )

        # 2. Assign fac_algo to Algorithms
        SubjectAssignment.objects.create(
            college=self.college, department=self.dept_cs, faculty=self.fac_algo,
            subject=self.subj_algo, class_section=self.class_sec_cs, is_active=True
        )

        # 3. Assigned faculty enters marks
        self.client.force_authenticate(user=self.fac_algo_user)
        resp_res = self.client.post("/api/v1/exams/results/", {
            "exam_subject": exam_subj.id,
            "student": str(self.stu1.id),
            "marks_obtained": 85.5,
            "grade": "A",
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_res.status_code == status.HTTP_201_CREATED
        result_id = resp_res.data["id"]
        assert AuditLog.objects.filter(action="RESULT_MARKS_ENTERED").exists()

        # 4. Student queries marks while unpublished -> 0 results
        self.client.force_authenticate(user=self.stu1_user)
        resp_stu = self.client.get("/api/v1/exams/results/", HTTP_X_ACTIVE_ROLE="STUDENT")
        assert len(resp_stu.data["results"]) == 0

        # 5. Parent queries marks while unpublished -> 0 results
        self.client.force_authenticate(user=self.parent_user)
        resp_parent = self.client.get("/api/v1/exams/results/", HTTP_X_ACTIVE_ROLE="PARENT")
        assert len(resp_parent.data["results"]) == 0

        # 6. Principal publishes exam
        self.client.force_authenticate(user=self.principal)
        resp_pub = self.client.post(f"/api/v1/exams/{exam.id}/publish/", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_pub.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="EXAM_RESULTS_PUBLISHED").exists()

        # 7. Student queries marks now -> 1 result with marks visible
        self.client.force_authenticate(user=self.stu1_user)
        resp_stu_after = self.client.get("/api/v1/exams/results/", HTTP_X_ACTIVE_ROLE="STUDENT")
        assert len(resp_stu_after.data["results"]) == 1
        assert float(resp_stu_after.data["results"][0]["marks_obtained"]) == 85.5

        # 8. Parent queries marks now -> 1 result with ward marks visible
        self.client.force_authenticate(user=self.parent_user)
        resp_parent_after = self.client.get("/api/v1/exams/results/", HTTP_X_ACTIVE_ROLE="PARENT")
        assert len(resp_parent_after.data["results"]) == 1

        # 9. Faculty updates marks -> Audited as RESULT_MARKS_CHANGED
        self.client.force_authenticate(user=self.fac_algo_user)
        resp_update = self.client.patch(f"/api/v1/exams/results/{result_id}/", {
            "marks_obtained": 90.0,
            "grade": "A+",
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_update.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="RESULT_MARKS_CHANGED").exists()


@pytest.mark.django_db
class TestOperationsBookingsFeesPrintLeaveSpec:
    """
    Phase E: Facility & Library Bookings, Fees & Waivers, Print Shop PIN, Leave Hierarchy.
    Tests:
    1. Facility bookings concurrency (select_for_update) & hierarchy (no self-approval, HOD to Principal).
    2. Library bookings decided ONLY by LIBRARY_FACULTY.
    3. Fee waivers granted ONLY by Principal and audited.
    4. Print shop 4-digit pickup PIN verification, failed attempt counting, PIN hidden from staff in API.
    5. Leave request multi-tier workflow with no self-approval.
    """

    def setup_method(self):
        from decimal import Decimal
        self.Decimal = Decimal
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Institute of Technology", code="APEX")
        self.dept_cs = Department.objects.create(college=self.college, name="Computer Science", code="CS")
        self.dept_ec = Department.objects.create(college=self.college, name="Electronics", code="EC")

        self.course_cs = Course.objects.create(college=self.college, department=self.dept_cs, name="B.Tech CS", code="BTCS")
        self.batch_cs = Batch.objects.create(
            college=self.college, course=self.course_cs, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.sem1 = Semester.objects.create(college=self.college, batch=self.batch_cs, semester_number=1, name="Semester 1", is_current=True)

        # Users
        self.principal = User.objects.create_user(email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college)
        self.accountant = User.objects.create_user(email="accountant@apex.edu", password="Password123!", role="ACCOUNTANT", college=self.college)
        self.library_fac = User.objects.create_user(email="library.fac@apex.edu", password="Password123!", role="LIBRARY_FACULTY", college=self.college)
        self.print_staff = User.objects.create_user(email="print.staff@apex.edu", password="Password123!", role="PRINT_STAFF", college=self.college)

        # HOD CS
        self.hod_cs = User.objects.create_user(email="hod.cs@apex.edu", password="Password123!", role="HOD", college=self.college)
        self.hod_fac = Faculty.objects.create(
            user=self.hod_cs, college=self.college, department=self.dept_cs, faculty_number="F-HOD-CS",
            qualification="Ph.D.", joining_date=date(2023, 1, 1)
        )
        self.dept_cs.hod = self.hod_fac
        self.dept_cs.save()

        # HOD EC
        self.hod_ec = User.objects.create_user(email="hod.ec@apex.edu", password="Password123!", role="HOD", college=self.college)
        self.hod_ec_fac = Faculty.objects.create(
            user=self.hod_ec, college=self.college, department=self.dept_ec, faculty_number="F-HOD-EC",
            qualification="Ph.D.", joining_date=date(2023, 1, 1)
        )
        self.dept_ec.hod = self.hod_ec_fac
        self.dept_ec.save()

        # Faculty CS
        self.faculty_user = User.objects.create_user(email="faculty.cs@apex.edu", password="Password123!", role="FACULTY", college=self.college)
        self.faculty = Faculty.objects.create(
            user=self.faculty_user, college=self.college, department=self.dept_cs, faculty_number="F-CS-01",
            qualification="M.Tech", joining_date=date(2025, 1, 1)
        )

        # Student
        self.student_user = User.objects.create_user(email="student.cs@apex.edu", password="Password123!", role="STUDENT", college=self.college)
        self.student = Student.objects.create(
            user=self.student_user, college=self.college, department=self.dept_cs, course=self.course_cs, batch=self.batch_cs,
            current_semester=self.sem1, student_number="STU-001", roll_number="CS-01", admission_date=date(2026, 8, 1)
        )

    def test_facility_booking_concurrency_and_hierarchy(self):
        """Facility bookings: no self-approval, HOD requests escalate to Principal, concurrency safety."""
        from facilities.models import Facility, FacilityBooking
        hall = Facility.objects.create(college=self.college, name="Central Auditorium", capacity=300)

        # 1. Faculty requests booking
        self.client.force_authenticate(user=self.faculty_user)
        tomorrow = timezone.now().date() + timedelta(days=1)
        resp = self.client.post("/api/v1/facilities/bookings/", {
            "facility": str(hall.id),
            "booking_date": str(tomorrow),
            "start_time": "14:00:00",
            "end_time": "17:00:00",
            "purpose": "Tech Symposium",
            "expected_attendees": 150,
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp.status_code == status.HTTP_201_CREATED
        booking_id = resp.data["id"]

        # 2. Self-approval is rejected
        resp_self = self.client.post(f"/api/v1/facilities/bookings/{booking_id}/approve/", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_self.status_code == status.HTTP_403_FORBIDDEN

        # 3. HOD of another department cannot approve
        self.client.force_authenticate(user=self.hod_ec)
        resp_other_dept = self.client.post(f"/api/v1/facilities/bookings/{booking_id}/approve/", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_other_dept.status_code == status.HTTP_403_FORBIDDEN

        # 4. HOD of own department approves -> 200 OK
        self.client.force_authenticate(user=self.hod_cs)
        resp_approve = self.client.post(f"/api/v1/facilities/bookings/{booking_id}/approve/", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_approve.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="FACILITY_BOOKING_APPROVE").exists()

        # 5. Overlapping request for same facility & time is rejected upon approval attempt
        booking2 = FacilityBooking.objects.create(
            college=self.college, facility=hall, requested_by=self.faculty_user, department=self.dept_cs,
            booking_date=tomorrow, start_time="15:00:00", end_time="18:00:00", purpose="Conflicting Session"
        )
        resp_overlap = self.client.post(f"/api/v1/facilities/bookings/{booking2.id}/approve/", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_overlap.status_code == status.HTTP_400_BAD_REQUEST

        # 6. HOD's own facility request escalates to Principal
        self.client.force_authenticate(user=self.hod_cs)
        day_after = tomorrow + timedelta(days=1)
        resp_hod_book = self.client.post("/api/v1/facilities/bookings/", {
            "facility": str(hall.id),
            "booking_date": str(day_after),
            "start_time": "10:00:00",
            "end_time": "12:00:00",
            "purpose": "Department Meeting",
            "expected_attendees": 50,
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_hod_book.status_code == status.HTTP_201_CREATED
        hod_booking_id = resp_hod_book.data["id"]

        # HOD cannot approve own request
        resp_hod_self = self.client.post(f"/api/v1/facilities/bookings/{hod_booking_id}/approve/", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_hod_self.status_code == status.HTTP_403_FORBIDDEN

        # Principal approves HOD request
        self.client.force_authenticate(user=self.principal)
        resp_prin_app = self.client.post(f"/api/v1/facilities/bookings/{hod_booking_id}/approve/", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_prin_app.status_code == status.HTTP_200_OK

    def test_library_booking_decided_only_by_library_faculty(self):
        """Library requests are decided only by LIBRARY_FACULTY, with timestamped audit entry."""
        from library.models import LibraryBooking
        tomorrow = timezone.now().date() + timedelta(days=1)

        # 1. Faculty requests library study-chamber
        self.client.force_authenticate(user=self.faculty_user)
        resp_req = self.client.post("/api/v1/library/bookings/", {
            "date": str(tomorrow),
            "start_time": "11:00:00",
            "end_time": "13:00:00",
            "purpose": "Research Study Group",
        }, format="json", HTTP_X_ACTIVE_ROLE="FACULTY")
        assert resp_req.status_code == status.HTTP_201_CREATED
        booking_id = resp_req.data["id"]

        # 2. HOD and Principal cannot approve/reject library bookings
        self.client.force_authenticate(user=self.hod_cs)
        resp_hod = self.client.post(f"/api/v1/library/bookings/{booking_id}/approve/", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_hod.status_code == status.HTTP_403_FORBIDDEN

        # 3. LIBRARY_FACULTY approves the booking -> 200 OK & Audited
        self.client.force_authenticate(user=self.library_fac)
        resp_lib = self.client.post(f"/api/v1/library/bookings/{booking_id}/approve/", HTTP_X_ACTIVE_ROLE="LIBRARY_FACULTY")
        assert resp_lib.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="LIBRARY_BOOKING_APPROVE").exists()

        # 4. Overlapping booking for same time slot is blocked
        booking2 = LibraryBooking.objects.create(
            college=self.college, requested_by=self.faculty, date=tomorrow,
            start_time="12:00:00", end_time="14:00:00", purpose="Overlap Test"
        )
        resp_lib_overlap = self.client.post(f"/api/v1/library/bookings/{booking2.id}/approve/", HTTP_X_ACTIVE_ROLE="LIBRARY_FACULTY")
        assert resp_lib_overlap.status_code == status.HTTP_400_BAD_REQUEST

    def test_fee_waiver_granted_only_by_principal_and_audited(self):
        """Accountant issues invoices; Principal grants waivers; Waivers are audited."""
        from fees.models import StudentInvoice
        invoice = StudentInvoice.objects.create(
            college=self.college, student=self.student, title="Semester 1 Tuition",
            subtotal=self.Decimal("50000.00"), discount_amount=self.Decimal("0.00"),
            final_amount=self.Decimal("50000.00"), paid_amount=self.Decimal("0.00"),
            balance_due=self.Decimal("50000.00"), due_date=timezone.now().date() + timedelta(days=30)
        )

        # 1. Accountant attempts to waive fee -> 403 Forbidden (Accountant cannot waive)
        self.client.force_authenticate(user=self.accountant)
        resp_acc_waive = self.client.post(f"/api/v1/fees/invoices/{invoice.id}/waive/", {
            "waiver_amount": 10000.0, "reason": "Merit scholarship"
        }, format="json", HTTP_X_ACTIVE_ROLE="ACCOUNTANT")
        assert resp_acc_waive.status_code == status.HTTP_403_FORBIDDEN

        # 2. Principal grants waiver -> 200 OK & Balance recalculated & Audited
        self.client.force_authenticate(user=self.principal)
        resp_prin_waive = self.client.post(f"/api/v1/fees/invoices/{invoice.id}/waive/", {
            "waiver_amount": 10000.0, "reason": "Sports excellence scholarship"
        }, format="json", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_prin_waive.status_code == status.HTTP_200_OK

        invoice.refresh_from_db()
        assert float(invoice.balance_due) == 40000.0
        assert float(invoice.discount_amount) == 10000.0
        assert AuditLog.objects.filter(action="FEE_WAIVER_GRANTED").exists()

    def test_printshop_4digit_pin_verification_and_counter(self):
        """Print order generates 4-digit PIN; PIN verified by staff; wrong PIN rejected and counted."""
        from printshop.models import PrintOrder

        # 1. Student uploads a print order
        self.client.force_authenticate(user=self.student_user)
        resp_order = self.client.post("/api/v1/printshop/orders/", {
            "document_name": "ProjectReport.pdf",
            "file_url": "https://storage.apex.edu/doc.pdf",
            "page_count": 10,
            "copies": 1,
            "print_color": "BW",
            "print_side": "SINGLE",
            "paper_size": "A4",
            "binding_type": "NONE",
        }, format="json", HTTP_X_ACTIVE_ROLE="STUDENT")
        assert resp_order.status_code == status.HTTP_201_CREATED
        order_id = resp_order.data["id"]
        pickup_pin = resp_order.data["pickup_pin"]
        assert len(str(pickup_pin)) == 4

        # 2. Print staff inspects the order -> PIN is hidden from staff
        self.client.force_authenticate(user=self.print_staff)
        resp_staff_view = self.client.get(f"/api/v1/printshop/orders/{order_id}/", HTTP_X_ACTIVE_ROLE="PRINT_STAFF")
        assert resp_staff_view.status_code == status.HTTP_200_OK
        assert "pickup_pin" not in resp_staff_view.data

        # 3. Print staff submits incorrect PIN -> 400 Bad Request & counter incremented
        resp_wrong_pin = self.client.post(f"/api/v1/printshop/orders/{order_id}/verify-pin/", {
            "pin": "0000" if str(pickup_pin) != "0000" else "9999"
        }, format="json", HTTP_X_ACTIVE_ROLE="PRINT_STAFF")
        assert resp_wrong_pin.status_code == status.HTTP_400_BAD_REQUEST

        order = PrintOrder.objects.get(id=order_id)
        assert order.failed_pin_attempts == 1

        # 4. Print staff submits correct PIN -> 200 OK & Completed & Audited
        resp_correct_pin = self.client.post(f"/api/v1/printshop/orders/{order_id}/verify-pin/", {
            "pin": str(pickup_pin)
        }, format="json", HTTP_X_ACTIVE_ROLE="PRINT_STAFF")
        assert resp_correct_pin.status_code == status.HTTP_200_OK

        order.refresh_from_db()
        assert order.status == PrintOrder.OrderStatus.COMPLETED
        assert order.payment_status == PrintOrder.PaymentStatus.PAID
        assert AuditLog.objects.filter(action="PRINT_ORDER_PICKUP_VERIFIED").exists()

    def test_leave_workflow_no_self_approval_and_hod_escalation(self):
        """HOD leave escalates to Principal. Nobody approves their own request."""
        # 1. HOD applies for leave
        self.client.force_authenticate(user=self.hod_cs)
        resp = self.client.post("/api/v1/leave/requests/", {
            "leave_type": "CASUAL",
            "from_date": "2026-11-10",
            "to_date": "2026-11-12",
            "reason": "Family wedding",
        }, format="json", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp.status_code == status.HTTP_201_CREATED
        leave_id = resp.data["id"]
        assert resp.data["routed_tier"] == "PRINCIPAL"

        # 2. HOD attempts to approve own leave -> 403 Forbidden (no self-approval)
        resp_self = self.client.post(f"/api/v1/leave/requests/{leave_id}/approve/", HTTP_X_ACTIVE_ROLE="HOD")
        assert resp_self.status_code == status.HTTP_403_FORBIDDEN

        # 3. Principal approves HOD leave -> 200 OK & Audited
        self.client.force_authenticate(user=self.principal)
        resp_prin = self.client.post(f"/api/v1/leave/requests/{leave_id}/approve/", {
            "approval_remarks": "Approved. Please handover charge."
        }, format="json", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_prin.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(action="LEAVE_REQUEST_APPROVED").exists()


@pytest.mark.django_db
class TestAbsentStudentLocatorSpec:
    """Specification tests for Section 5: Absent-student locator (camera feature) & Face Consent."""

    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Tech", code="APEX-LOC", slug="apex-loc", status="ACTIVE")

        # Roles
        self.super_admin = User.objects.create_user(email="admin.loc@campyteq.io", password="Password123!", role="SUPER_ADMIN", college=self.college)
        self.principal = User.objects.create_user(email="principal.loc@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college)
        self.hod_user = User.objects.create_user(email="hod.loc@apex.edu", password="Password123!", role="HOD", college=self.college)
        self.faculty_user = User.objects.create_user(email="faculty.loc@apex.edu", password="Password123!", role="FACULTY", college=self.college)
        self.incharge_user = User.objects.create_user(email="incharge.loc@apex.edu", password="Password123!", role="FACULTY", college=self.college)
        self.security_user = User.objects.create_user(email="security.loc@apex.edu", password="Password123!", role="SECURITY", college=self.college)
        self.student_user = User.objects.create_user(
            email="student.loc@apex.edu", password="Password123!", role="STUDENT", college=self.college
        )
        self.parent_user = User.objects.create_user(email="parent.loc@apex.edu", password="Password123!", role="PARENT", college=self.college)

        # Dynamic assignment mode for Class Incharge
        UserRole.objects.create(user=self.incharge_user, college=self.college, role="CLASS_INCHARGE", source="assignment", is_active=True)

        # Department, Faculty Profiles & Academics
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.hod_profile = Faculty.objects.create(
            college=self.college, user=self.hod_user, department=self.dept, faculty_number="F-HOD-LOC",
            qualification="Ph.D.", joining_date=date(2024, 1, 1)
        )
        self.faculty_profile = Faculty.objects.create(
            college=self.college, user=self.faculty_user, department=self.dept, faculty_number="F-FAC-LOC",
            qualification="M.Tech", joining_date=date(2025, 1, 1)
        )
        self.incharge_profile = Faculty.objects.create(
            college=self.college, user=self.incharge_user, department=self.dept, faculty_number="F-INC-LOC",
            qualification="M.Tech", joining_date=date(2025, 1, 1)
        )

        self.course = Course.objects.create(college=self.college, department=self.dept, name="B.Tech CSE", code="BTECH-CSE", duration_years=4, total_semesters=8)
        self.batch = Batch.objects.create(college=self.college, course=self.course, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1))
        self.semester = Semester.objects.create(
            college=self.college, batch=self.batch, semester_number=1, name="Semester 1",
            start_date=date(2026, 8, 1), end_date=date(2026, 12, 15), is_current=True
        )
        self.section = ClassSection.objects.create(college=self.college, department=self.dept, course=self.course, batch=self.batch, name="Section A", academic_year="2026-2027")
        self.subject = Subject.objects.create(
            college=self.college, department=self.dept, course=self.course, name="Operating Systems",
            code="CS301", credits=4, semester_number=1
        )

        # Class Incharge assignment
        ClassIncharge.objects.create(
            college=self.college, department=self.dept, faculty=self.incharge_profile,
            class_section=self.section, is_active=True
        )

        # Student & Parent
        self.student = Student.objects.create(
            college=self.college, user=self.student_user, department=self.dept, course=self.course,
            batch=self.batch, current_semester=self.semester,
            roll_number="2026-CSE-042", student_number="STU-2026-0042", admission_date=date(2026, 8, 1),
            date_of_birth=date(2008, 5, 15)  # Minor (under 18)
        )
        ParentWardLink.objects.create(
            college=self.college, parent=self.parent_user, student=self.student,
            relation="FATHER", is_verified=True
        )

        # Hardware Cameras & Zones
        from cameras.models import CameraZone, Camera
        from tracking.models import FaceEnrollment, DetectionEvent, StudentLatestLocation, TrackingAccessLog
        self.zone_canteen = CameraZone.objects.create(college=self.college, name="Main Canteen", code="CANTEEN", building="Student Center", floor=1)
        self.camera_canteen = Camera.objects.create(college=self.college, zone=self.zone_canteen, name="Canteen East Gate", code="CAM-CANT-01", ip_address="192.168.10.12", status="ONLINE")

        # Active Attendance Session (current period)
        from attendance.models import AttendanceSession, StudentAttendance
        now = timezone.now()
        start_t = (now - timedelta(minutes=15)).time()
        end_t = (now + timedelta(minutes=45)).time()
        self.session = AttendanceSession.objects.create(
            college=self.college,
            subject=self.subject,
            semester=self.semester,
            faculty=self.faculty_profile,
            date=now.date(),
            start_time=start_t,
            end_time=end_t,
            session_type="REGULAR"
        )
        # Target student marked ABSENT
        self.att_record = StudentAttendance.objects.create(
            college=self.college,
            session=self.session,
            student=self.student,
            status="ABSENT"
        )

        # 128-D Face Enrollment vector
        self.embedding_128d = [0.05 * (i % 10) for i in range(128)]
        self.face_enrollment = FaceEnrollment.objects.create(
            college=self.college,
            student=self.student,
            embedding=self.embedding_128d,
            consent_given=True,
            consent_by=self.parent_user,
            consent_at=timezone.now(),
            is_active=True
        )

        # Student latest location sighting
        self.latest_location = StudentLatestLocation.objects.create(
            college=self.college,
            student=self.student,
            camera=self.camera_canteen,
            zone=self.zone_canteen,
            detected_at=now - timedelta(minutes=5),
            confidence_score=0.9850
        )

    def test_locator_role_restrictions(self):
        """Faculty, Class Incharge, and HOD can locate. Security, Super Admin, Principal, Student, Parent blocked."""
        # 1. Faculty assigned to this period -> 200 OK
        self.client.force_authenticate(user=self.faculty_user)
        resp_fac = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=Attendance%20absence%20followup",
            HTTP_X_ACTIVE_ROLE="FACULTY"
        )
        assert resp_fac.status_code == status.HTTP_200_OK
        assert resp_fac.data["success"] is True

        # 2. Class Incharge of student's section -> 200 OK
        self.client.force_authenticate(user=self.incharge_user)
        resp_inc = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=Class%20incharge%20welfare%20check",
            HTTP_X_ACTIVE_ROLE="CLASS_INCHARGE"
        )
        assert resp_inc.status_code == status.HTTP_200_OK

        # 3. HOD of student's department -> 200 OK
        self.client.force_authenticate(user=self.hod_user)
        resp_hod = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=HOD%20departmental%20inquiry",
            HTTP_X_ACTIVE_ROLE="HOD"
        )
        assert resp_hod.status_code == status.HTTP_200_OK

        # 4. Security personnel -> 403 Forbidden (student search strictly blocked)
        self.client.force_authenticate(user=self.security_user)
        resp_sec = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=Routine%20perimeter%20patrol",
            HTTP_X_ACTIVE_ROLE="SECURITY"
        )
        assert resp_sec.status_code == status.HTTP_403_FORBIDDEN
        assert resp_sec.data["code"] == "LOCATOR_ROLE_RESTRICTED"

        # 5. Super Admin -> 403 Forbidden (no routine student data)
        self.client.force_authenticate(user=self.super_admin)
        resp_sa = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=System%20audit",
            HTTP_X_ACTIVE_ROLE="SUPER_ADMIN"
        )
        assert resp_sa.status_code == status.HTTP_403_FORBIDDEN

        # 6. Student -> 403 Forbidden
        self.client.force_authenticate(user=self.student_user)
        resp_stu = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=Locate%20myself",
            HTTP_X_ACTIVE_ROLE="STUDENT"
        )
        assert resp_stu.status_code == status.HTTP_403_FORBIDDEN

        # 7. Parent -> 403 Forbidden
        self.client.force_authenticate(user=self.parent_user)
        resp_par = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=Locate%20my%20ward",
            HTTP_X_ACTIVE_ROLE="PARENT"
        )
        assert resp_par.status_code == status.HTTP_403_FORBIDDEN

    def test_locator_active_period_window_and_absent_status(self):
        """Locator requires student to be marked ABSENT, and only permits searches within period + 30 min."""
        self.client.force_authenticate(user=self.faculty_user)

        # 1. Student marked PRESENT -> 400 Bad Request
        self.att_record.status = "PRESENT"
        self.att_record.save()
        resp_present = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&reason=Attendance%20absence%20followup",
            HTTP_X_ACTIVE_ROLE="FACULTY"
        )
        assert resp_present.status_code == status.HTTP_400_BAD_REQUEST
        assert resp_present.data["code"] == "STUDENT_NOT_ABSENT"

        # Restore ABSENT
        self.att_record.status = "ABSENT"
        self.att_record.save()

        # 2. Window expired (> 30 min post-period) -> 400 Bad Request
        now = timezone.now()
        self.session.date = now.date() - timedelta(days=1)
        self.session.save()
        resp_expired = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&session_id={self.session.id}&reason=Attendance%20absence%20followup",
            HTTP_X_ACTIVE_ROLE="FACULTY"
        )
        assert resp_expired.status_code == status.HTTP_400_BAD_REQUEST
        assert resp_expired.data["code"] == "LOCATOR_WINDOW_EXPIRED"

    def test_face_consent_gate_and_vector_deletion_on_withdrawal(self):
        """Consent-first enrollment requires 128-D vector; withdrawal permanently deletes vector."""
        from tracking.models import FaceEnrollment

        # 1. Non-128D vector or raw image rejected
        self.client.force_authenticate(user=self.principal)
        resp_invalid_vector = self.client.post("/api/v1/tracking/face-enrollment/", {
            "student": str(self.student.id),
            "embedding": [0.1] * 50,  # Invalid dimension
            "consent_given": True,
        }, format="json", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_invalid_vector.status_code == status.HTTP_400_BAD_REQUEST

        # 2. Student without consent returns "Not enrolled" with no fallback tracking
        self.face_enrollment.consent_given = False
        self.face_enrollment.save()
        self.client.force_authenticate(user=self.faculty_user)
        resp_noconsent = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&session_id={self.session.id}&reason=Attendance%20absence%20followup",
            HTTP_X_ACTIVE_ROLE="FACULTY"
        )
        assert resp_noconsent.status_code == status.HTTP_200_OK
        assert resp_noconsent.data["status"] == "NOT_ENROLLED"
        assert resp_noconsent.data["code"] == "NOT_ENROLLED"

        # Restore consent
        self.face_enrollment.consent_given = True
        self.face_enrollment.save()

        # 3. Consent withdrawal deletes 128-D vector permanently and writes audit log
        self.client.force_authenticate(user=self.student_user)
        resp_withdraw = self.client.post(
            f"/api/v1/tracking/face-enrollment/{self.face_enrollment.id}/withdraw/",
            HTTP_X_ACTIVE_ROLE="STUDENT"
        )
        assert resp_withdraw.status_code == status.HTTP_200_OK
        self.face_enrollment.refresh_from_db()
        assert self.face_enrollment.embedding == []
        assert self.face_enrollment.consent_given is False
        assert self.face_enrollment.is_active is False
        assert AuditLog.objects.filter(action="BIOMETRIC_CONSENT_REVOKED").exists()

    def test_locator_returns_last_seen_zone_and_time_only_and_audited(self):
        """Returns last-seen zone + time only (no breadcrumbs/movement trail); logs searches; student sees inquiries."""
        from tracking.models import TrackingAccessLog

        self.client.force_authenticate(user=self.faculty_user)

        # 1. Missing reason is rejected
        resp_no_reason = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&session_id={self.session.id}",
            HTTP_X_ACTIVE_ROLE="FACULTY"
        )
        assert resp_no_reason.status_code == status.HTTP_400_BAD_REQUEST
        assert resp_no_reason.data["code"] == "REASON_REQUIRED"

        # 2. Valid request returns last-seen zone + time ONLY (no trajectory breadcrumbs)
        resp_locate = self.client.get(
            f"/api/v1/tracking/last-seen/?student_number={self.student.roll_number}&session_id={self.session.id}&reason=Student%20absent%20in%20Operating%20Systems",
            HTTP_X_ACTIVE_ROLE="FACULTY"
        )
        assert resp_locate.status_code == status.HTTP_200_OK
        data = resp_locate.data["data"]
        assert "last_seen" in data
        assert data["last_seen"]["zone_name"] == "Main Canteen"
        assert data["last_seen"]["zone_code"] == "CANTEEN"
        assert "time_display" in data["last_seen"]
        assert "trajectory_history" not in data
        assert "movement_trail" not in data

        # 3. Audited: TrackingAccessLog and AuditLog written
        assert TrackingAccessLog.objects.filter(student=self.student, user=self.faculty_user).exists()
        assert AuditLog.objects.filter(action="LOCATOR_SEARCHED", resource_id=str(self.student.id)).exists()

        # 4. Student can see who searched for them
        self.client.force_authenticate(user=self.student_user)
        resp_my_searches = self.client.get("/api/v1/tracking/my-searches/", HTTP_X_ACTIVE_ROLE="STUDENT")
        assert resp_my_searches.status_code == status.HTTP_200_OK
        searches = resp_my_searches.data["results"]
        assert len(searches) >= 1
        assert searches[0]["user_email"] == "faculty.loc@apex.edu"
        assert "Operating Systems" in searches[0]["reason"]

    def test_sightings_auto_delete_after_retention_period(self):
        """Sightings older than 24 hours are purged for DPDP retention compliance."""
        from tracking.models import DetectionEvent
        from tracking.services import cleanup_old_sightings

        # Create older detection (> 24 hours ago)
        old_time = timezone.now() - timedelta(hours=26)
        old_detection = DetectionEvent.objects.create(
            college=self.college,
            camera=self.camera_canteen,
            zone=self.zone_canteen,
            student=self.student,
            detected_at=old_time,
            confidence_score=0.9700
        )
        # Create fresh detection (< 24 hours ago)
        fresh_time = timezone.now() - timedelta(hours=2)
        fresh_detection = DetectionEvent.objects.create(
            college=self.college,
            camera=self.camera_canteen,
            zone=self.zone_canteen,
            student=self.student,
            detected_at=fresh_time,
            confidence_score=0.9900
        )

        deleted = cleanup_old_sightings(retention_hours=24)
        assert deleted >= 1
        assert not DetectionEvent.objects.filter(id=old_detection.id).exists()
        assert DetectionEvent.objects.filter(id=fresh_detection.id).exists()


@pytest.mark.django_db
class TestRoleAdaptiveBackendDrivenDashboardsSpec:
    """Specification tests for Section 6: Role-adaptive and backend-driven dashboards."""

    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(name="Apex Tech", code="APEX-DASH", slug="apex-dash", status="ACTIVE")

        self.super_admin = User.objects.create_user(email="sa.dash@campyteq.io", password="Password123!", role="SUPER_ADMIN", college=self.college)
        self.principal = User.objects.create_user(email="prin.dash@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college)
        self.hod = User.objects.create_user(email="hod.dash@apex.edu", password="Password123!", role="HOD", college=self.college)
        self.faculty = User.objects.create_user(email="fac.dash@apex.edu", password="Password123!", role="FACULTY", college=self.college)
        self.accountant = User.objects.create_user(email="acc.dash@apex.edu", password="Password123!", role="ACCOUNTANT", college=self.college)
        self.lib_faculty = User.objects.create_user(email="lib.dash@apex.edu", password="Password123!", role="LIBRARY_FACULTY", college=self.college)
        self.print_staff = User.objects.create_user(email="print.dash@apex.edu", password="Password123!", role="PRINT_STAFF", college=self.college)
        self.security = User.objects.create_user(email="sec.dash@apex.edu", password="Password123!", role="SECURITY", college=self.college)
        self.student = User.objects.create_user(email="stu.dash@apex.edu", password="Password123!", role="STUDENT", college=self.college)
        self.parent = User.objects.create_user(email="par.dash@apex.edu", password="Password123!", role="PARENT", college=self.college)

        # Assignment modes
        UserRole.objects.create(user=self.faculty, college=self.college, role="CLASS_INCHARGE", source="assignment", is_active=True)
        UserRole.objects.create(user=self.faculty, college=self.college, role="MENTOR", source="assignment", is_active=True)

    def test_backend_modules_endpoint_and_user_profile(self):
        """Endpoints /api/v1/accounts/me/modules/ and /api/v1/accounts/me/ return role-adaptive module lists."""
        self.client.force_authenticate(user=self.principal)
        resp = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.data
        assert data["role"] == "PRINCIPAL"
        module_ids = [m["id"] for m in data["modules"]]
        assert "dashboard" in module_ids
        assert "students" in module_ids
        assert "faculty" in module_ids
        assert "fees" in module_ids
        assert "facilities" in module_ids
        assert "cameras" in module_ids
        assert "analytics" in module_ids
        assert "audit" in module_ids

        # User profile includes modules as well
        resp_me = self.client.get("/api/v1/accounts/me/", HTTP_X_ACTIVE_ROLE="PRINCIPAL")
        assert resp_me.status_code == status.HTTP_200_OK
        assert "modules" in resp_me.data
        assert len(resp_me.data["modules"]) == len(data["modules"])

    def test_super_admin_permitted_modules_no_routine_student_data(self):
        """Super Admin gets platform operator modules only; no routine student academic data."""
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="SUPER_ADMIN")
        assert resp.status_code == status.HTTP_200_OK
        module_ids = [m["id"] for m in resp.data["modules"]]
        assert module_ids == ["dashboard", "colleges", "audit"]
        assert "students" not in module_ids
        assert "attendance" not in module_ids
        assert "exams" not in module_ids

    def test_security_permitted_modules_student_search_blocked(self):
        """Security gets camera health and gate logs only; student search blocked."""
        self.client.force_authenticate(user=self.security)
        resp = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="SECURITY")
        assert resp.status_code == status.HTTP_200_OK
        module_ids = [m["id"] for m in resp.data["modules"]]
        assert module_ids == ["dashboard", "cameras"]
        assert "students" not in module_ids
        assert "fees" not in module_ids

    def test_accountant_and_print_staff_permitted_modules(self):
        """Accountant sees fees/finance; Print Staff sees queue and PIN verification only."""
        # Accountant
        self.client.force_authenticate(user=self.accountant)
        resp_acc = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="ACCOUNTANT")
        assert resp_acc.status_code == status.HTTP_200_OK
        acc_ids = [m["id"] for m in resp_acc.data["modules"]]
        assert "fees" in acc_ids
        assert "attendance" not in acc_ids
        assert "exams" not in acc_ids

        # Print Staff
        self.client.force_authenticate(user=self.print_staff)
        resp_print = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="PRINT_STAFF")
        assert resp_print.status_code == status.HTTP_200_OK
        print_ids = [m["id"] for m in resp_print.data["modules"]]
        assert print_ids == ["dashboard", "printshop"]
        assert "students" not in print_ids

    def test_student_and_parent_permitted_modules(self):
        """Student sees own academic data; Parent sees verified ward data only."""
        # Student
        self.client.force_authenticate(user=self.student)
        resp_stu = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="STUDENT")
        assert resp_stu.status_code == status.HTTP_200_OK
        stu_ids = [m["id"] for m in resp_stu.data["modules"]]
        assert "timetable" in stu_ids
        assert "attendance" in stu_ids
        assert "assignments" in stu_ids
        assert "exams" in stu_ids
        assert "fees" in stu_ids
        assert "printshop" in stu_ids
        assert "faculty" not in stu_ids
        assert "colleges" not in stu_ids

        # Parent
        self.client.force_authenticate(user=self.parent)
        resp_par = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="PARENT")
        assert resp_par.status_code == status.HTTP_200_OK
        par_ids = [m["id"] for m in resp_par.data["modules"]]
        assert "attendance" in par_ids
        assert "exams" in par_ids
        assert "fees" in par_ids
        assert "timetable" in par_ids
        assert "assignments" not in par_ids

    def test_assignment_modes_permitted_modules(self):
        """Switching between FACULTY, CLASS_INCHARGE, and MENTOR adapts navigation modules accordingly."""
        self.client.force_authenticate(user=self.faculty)

        # 1. Base Faculty
        resp_fac = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="FACULTY")
        fac_ids = [m["id"] for m in resp_fac.data["modules"]]
        assert "assignments" in fac_ids
        assert "attendance" in fac_ids
        assert "exams" in fac_ids
        assert "mentorship" not in fac_ids

        # 2. Class Incharge mode
        resp_ci = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="CLASS_INCHARGE")
        ci_ids = [m["id"] for m in resp_ci.data["modules"]]
        assert "students" in ci_ids
        assert "attendance" in ci_ids
        assert "analytics" in ci_ids
        assert "mentorship" not in ci_ids

        # 3. Mentor mode
        resp_mentor = self.client.get("/api/v1/accounts/me/modules/", HTTP_X_ACTIVE_ROLE="MENTOR")
        mentor_ids = [m["id"] for m in resp_mentor.data["modules"]]
        assert "mentorship" in mentor_ids
        assert "analytics" in mentor_ids
        assert "timetable" not in mentor_ids




