import pytest
from datetime import date
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from departments.models import Department
from academics.models import Course, Batch, Semester
from faculty.models import Faculty
from students.models import Student, MentorAssignment

@pytest.mark.django_db
class TestCollegeAndPeople:
    def setup_method(self):
        self.client = APIClient()

        # College A
        self.college_a = College.objects.create(
            name="Apex Institute",
            code="APEX-A",
            slug="apex-a",
            status="ACTIVE"
        )
        self.principal_a = User.objects.create_user(
            email="principal.a@apex.edu",
            password="Password123!",
            first_name="Principal",
            role="PRINCIPAL",
            college=self.college_a,
            status="ACTIVE"
        )
        self.dept_cs_a = Department.objects.create(
            college=self.college_a,
            name="Computer Science",
            code="CSE",
            status="ACTIVE"
        )
        self.course_a = Course.objects.create(
            college=self.college_a,
            department=self.dept_cs_a,
            name="B.Tech Computer Science",
            code="BTECH-CSE",
            duration_years=4,
            total_semesters=8,
            status="ACTIVE"
        )
        self.batch_a = Batch.objects.create(
            college=self.college_a,
            course=self.course_a,
            name="2026-2030",
            academic_year="2026-2027",
            start_date=date(2026, 8, 1),
            status="ACTIVE"
        )
        self.sem_a = Semester.objects.create(
            college=self.college_a,
            batch=self.batch_a,
            semester_number=1,
            name="Semester 1",
            is_current=True
        )

        # Faculty & Mentor in College A
        self.user_mentor_a = User.objects.create_user(
            email="mentor.a@apex.edu",
            password="Password123!",
            first_name="Mentor",
            last_name="Anil",
            role="FACULTY",
            college=self.college_a,
            status="ACTIVE"
        )
        self.faculty_mentor_a = Faculty.objects.create(
            user=self.user_mentor_a,
            college=self.college_a,
            faculty_number="FAC-001",
            department=self.dept_cs_a,
            designation="ASSOCIATE_PROFESSOR",
            qualification="Ph.D.",
            joining_date=date(2020, 1, 1),
            status="ACTIVE"
        )

        # Faculty other in College A
        self.user_faculty2_a = User.objects.create_user(
            email="faculty2.a@apex.edu",
            password="Password123!",
            first_name="Faculty",
            last_name="Priya",
            role="FACULTY",
            college=self.college_a,
            status="ACTIVE"
        )
        self.faculty2_a = Faculty.objects.create(
            user=self.user_faculty2_a,
            college=self.college_a,
            faculty_number="FAC-002",
            department=self.dept_cs_a,
            designation="ASSISTANT_PROFESSOR",
            qualification="M.Tech",
            joining_date=date(2021, 1, 1),
            status="ACTIVE"
        )

        # Students in College A
        self.user_stu1_a = User.objects.create_user(
            email="stu1.a@apex.edu",
            password="Password123!",
            first_name="Student",
            last_name="One",
            role="STUDENT",
            college=self.college_a,
            status="ACTIVE"
        )
        self.stu1_a = Student.objects.create(
            user=self.user_stu1_a,
            college=self.college_a,
            student_number="STU-001",
            roll_number="CSE-01",
            department=self.dept_cs_a,
            course=self.course_a,
            batch=self.batch_a,
            current_semester=self.sem_a,
            mentor=self.faculty_mentor_a,
            admission_date=date(2026, 8, 1),
            status="ACTIVE"
        )

        self.user_stu2_a = User.objects.create_user(
            email="stu2.a@apex.edu",
            password="Password123!",
            first_name="Student",
            last_name="Two",
            role="STUDENT",
            college=self.college_a,
            status="ACTIVE"
        )
        self.stu2_a = Student.objects.create(
            user=self.user_stu2_a,
            college=self.college_a,
            student_number="STU-002",
            roll_number="CSE-02",
            department=self.dept_cs_a,
            course=self.course_a,
            batch=self.batch_a,
            current_semester=self.sem_a,
            mentor=self.faculty2_a,
            admission_date=date(2026, 8, 1),
            status="ACTIVE"
        )

        # Assign stu1 to mentor_a
        MentorAssignment.objects.create(
            college=self.college_a,
            mentor=self.faculty_mentor_a,
            student=self.stu1_a,
            is_active=True
        )

        # College B
        self.college_b = College.objects.create(
            name="Metro Science",
            code="METRO-B",
            slug="metro-b",
            status="ACTIVE"
        )
        self.dept_b = Department.objects.create(
            college=self.college_b,
            name="Physics",
            code="PHY",
            status="ACTIVE"
        )
        self.course_b = Course.objects.create(
            college=self.college_b,
            department=self.dept_b,
            name="B.Sc Physics",
            code="BSC-PHY",
            duration_years=3,
            total_semesters=6,
            status="ACTIVE"
        )
        self.batch_b = Batch.objects.create(
            college=self.college_b,
            course=self.course_b,
            name="2026-2029",
            academic_year="2026-2027",
            start_date=date(2026, 8, 1),
            status="ACTIVE"
        )
        self.user_stu_b = User.objects.create_user(
            email="stu.b@metro.edu",
            password="Password123!",
            first_name="Metro",
            last_name="Student",
            role="STUDENT",
            college=self.college_b,
            status="ACTIVE"
        )
        self.stu_b = Student.objects.create(
            user=self.user_stu_b,
            college=self.college_b,
            student_number="METRO-STU-01",
            roll_number="PHY-01",
            department=self.dept_b,
            course=self.course_b,
            batch=self.batch_b,
            admission_date=date(2026, 8, 1),
            status="ACTIVE"
        )

    def test_department_list_tenant_isolation(self):
        """Principal of College A should only see College A departments."""
        self.client.force_authenticate(user=self.principal_a)
        res = self.client.get('/api/v1/departments/')
        assert res.status_code == 200
        codes = [d['code'] for d in res.data['results']]
        assert "CSE" in codes
        assert "PHY" not in codes

    def test_course_list_tenant_isolation(self):
        """Principal of College A should only see College A courses."""
        self.client.force_authenticate(user=self.principal_a)
        res = self.client.get('/api/v1/academics/courses/')
        assert res.status_code == 200
        codes = [c['code'] for c in res.data['results']]
        assert "BTECH-CSE" in codes
        assert "BSC-PHY" not in codes

    def test_student_list_tenant_isolation(self):
        """Principal of College A should only see College A students."""
        self.client.force_authenticate(user=self.principal_a)
        res = self.client.get('/api/v1/students/')
        assert res.status_code == 200
        roll_numbers = [s['roll_number'] for s in res.data['results']]
        assert "CSE-01" in roll_numbers
        assert "CSE-02" in roll_numbers
        assert "PHY-01" not in roll_numbers

    def test_cross_college_direct_lookup_404(self):
        """Direct ID lookup of College B student by College A principal returns 404."""
        self.client.force_authenticate(user=self.principal_a)
        res = self.client.get(f'/api/v1/students/{self.stu_b.id}/')
        assert res.status_code == 404

    def test_mentor_query_scoping(self):
        """Mentor Anil should only see student 1 (in his cohort) and NOT student 2."""
        self.client.force_authenticate(user=self.user_mentor_a)
        res = self.client.get('/api/v1/students/', HTTP_X_ACTIVE_ROLE="MENTOR")
        assert res.status_code == 200
        roll_numbers = [s['roll_number'] for s in res.data['results']]
        assert "CSE-01" in roll_numbers
        assert "CSE-02" not in roll_numbers

    def test_student_can_only_view_self(self):
        """Student 1 listing /api/v1/students/ should only see their own profile."""
        self.client.force_authenticate(user=self.user_stu1_a)
        res = self.client.get('/api/v1/students/')
        assert res.status_code == 200
        roll_numbers = [s['roll_number'] for s in res.data['results']]
        assert roll_numbers == ["CSE-01"]
