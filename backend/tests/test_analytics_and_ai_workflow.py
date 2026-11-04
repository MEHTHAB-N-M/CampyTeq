import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from students.models import Student, MentorAssignment
from faculty.models import Faculty
from departments.models import Department
from academics.models import Course, Batch, Semester, Subject
from attendance.models import AttendanceSession, StudentAttendance
from exams.models import Exam, ExamSubject, Result
from assignments.models import Assignment, AssignmentSubmission
from analytics.models import StudentAIAnalysis
from analytics.services import AcademicRiskEngine


@pytest.mark.django_db
class TestAnalyticsAndAIWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-AN", slug="apex-an", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-AN", slug="beta-an", status="ACTIVE")

        # Users
        self.principal = User.objects.create_user(
            email="principal@apex.edu", password="Password123!", role="PRINCIPAL", college=self.college, first_name="Rajesh"
        )
        self.mentor_user = User.objects.create_user(
            email="mentor@apex.edu", password="Password123!", role="FACULTY", college=self.college, first_name="Anil"
        )
        self.student_user_1 = User.objects.create_user(
            email="rahul@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rahul"
        )
        self.student_user_2 = User.objects.create_user(
            email="rohan@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Rohan"
        )
        self.other_user = User.objects.create_user(
            email="user@beta.edu", password="Password123!", role="PRINCIPAL", college=self.other_college, first_name="BetaPrincipal"
        )

        # Department, Faculty, Students
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.course = Course.objects.create(
            college=self.college, department=self.dept, name="B.Tech CSE", code="BTECH-AN", duration_years=4, total_semesters=8
        )
        self.batch = Batch.objects.create(
            college=self.college, course=self.course, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.semester = Semester.objects.create(
            college=self.college, batch=self.batch, semester_number=1, name="Sem 1", is_current=True
        )

        self.faculty = Faculty.objects.create(
            user=self.mentor_user, college=self.college, faculty_number="FAC-AN-01", department=self.dept,
            designation="ASSOCIATE_PROFESSOR", joining_date=date(2022, 1, 1), status="ACTIVE"
        )

        self.student_1 = Student.objects.create(
            user=self.student_user_1, college=self.college, student_number="STU-AN-01", roll_number="CSE-AN-01",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )
        self.student_2 = Student.objects.create(
            user=self.student_user_2, college=self.college, student_number="STU-AN-02", roll_number="CSE-AN-02",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )

        # Mentor Assignment: Mentor Anil is assigned ONLY to student_1 (Rahul)
        MentorAssignment.objects.create(
            college=self.college,
            mentor=self.faculty,
            student=self.student_1,
            is_active=True
        )

        # Subject
        self.subject = Subject.objects.create(
            college=self.college, department=self.dept, course=self.course, code="CS301", name="Data Structures", semester_number=1
        )

    def test_institutional_overview_and_tenant_isolation(self):
        """Verify institutional overview metrics and college tenant isolation."""
        self.client.force_authenticate(user=self.principal)

        res = self.client.get('/api/v1/analytics/overview/')
        assert res.status_code == 200
        data = res.data.get('data', res.data)
        assert data['total_students'] == 2
        assert data['total_faculty'] == 1
        assert data['total_departments'] == 1
        assert 'early_warning_summary' in data

        # Beta principal cannot see Apex numbers
        self.client.force_authenticate(user=self.other_user)
        beta_res = self.client.get('/api/v1/analytics/overview/')
        assert beta_res.status_code == 200
        beta_data = beta_res.data.get('data', beta_res.data)
        assert beta_data['total_students'] == 0

    def test_attendance_and_finance_reports(self):
        """Verify attendance breakdown and finance reporting endpoints."""
        self.client.force_authenticate(user=self.principal)

        # Attendance report
        att_res = self.client.get('/api/v1/analytics/attendance-report/')
        assert att_res.status_code == 200
        att_data = att_res.data.get('data', att_res.data)
        assert 'department_breakdown' in att_data
        assert any(d['code'] == 'CSE' for d in att_data['department_breakdown'])

        # Finance report
        fin_res = self.client.get('/api/v1/analytics/finance-report/')
        assert fin_res.status_code == 200
        fin_data = fin_res.data.get('data', fin_res.data)
        assert 'total_billed' in fin_data
        assert 'total_collected' in fin_data

    def test_academic_risk_engine_scoring_and_explainability(self):
        """Verify AcademicRiskEngine calculation, explainable drivers, and risk levels."""
        # 1. Evaluate clean student (student_1)
        analysis_1 = AcademicRiskEngine.evaluate_student(self.student_1)
        assert analysis_1.risk_level == 'LOW'
        assert float(analysis_1.score) < 40.0
        assert len(analysis_1.key_risk_drivers) > 0

        # 2. Simulate defaulter attendance on student_2 (Rohan): 3 absences out of 5 sessions = 40%
        for i in range(5):
            s_sess = AttendanceSession.objects.create(
                college=self.college, faculty=self.faculty, subject=self.subject,
                semester=self.semester, date=date.today() - timedelta(days=i),
                start_time=timezone.now().time(), end_time=timezone.now().time()
            )
            status = 'PRESENT' if i < 2 else 'ABSENT'
            StudentAttendance.objects.create(
                college=self.college, session=s_sess, student=self.student_2, status=status
            )

        analysis_2 = AcademicRiskEngine.evaluate_student(self.student_2)
        # With 40% attendance, risk score should be >= 50 and drivers must flag attendance deficit
        assert float(analysis_2.score) >= 50.0
        assert analysis_2.risk_level in ['HIGH', 'MEDIUM', 'CRITICAL']
        assert any("attendance" in d.lower() for d in analysis_2.key_risk_drivers)

    def test_non_punitive_constraint(self):
        """Verify ethical guardrail: evaluating high risk NEVER modifies student enrollment status."""
        self.student_2.status = "ACTIVE"
        self.student_2.save()

        # Run risk evaluation
        analysis = AcademicRiskEngine.evaluate_student(self.student_2)

        self.student_2.refresh_from_db()
        # Student status must strictly remain ACTIVE (no automatic disciplinary action)
        assert self.student_2.status == "ACTIVE"

    def test_mentor_cohort_scoping_and_review_workflow(self):
        """Verify mentor can only review assigned students, and review action saves correctly."""
        analysis_1 = AcademicRiskEngine.evaluate_student(self.student_1)
        analysis_2 = AcademicRiskEngine.evaluate_student(self.student_2)

        self.client.force_authenticate(user=self.mentor_user)

        # 1. Mentor lists risk assessments -> only assigned student_1 appears
        list_res = self.client.get('/api/v1/analytics/ai-risk/')
        assert list_res.status_code == 200
        results = list_res.data.get('results', list_res.data.get('data', list_res.data))
        student_ids = [str(r['student']) for r in results]
        assert str(self.student_1.id) in student_ids
        assert str(self.student_2.id) not in student_ids  # Mentor scoping

        # 2. Mentor reviews assigned student_1 -> Success (200)
        review_res = self.client.post(f'/api/v1/analytics/ai-risk/{analysis_1.id}/review/', {
            'review_notes': 'Conducted 1-on-1 counseling regarding academic progress and timetable habits.',
            'review_action_taken': 'COUNSELING_SCHEDULED'
        }, format='json')
        assert review_res.status_code == 200
        analysis_1.refresh_from_db()
        assert analysis_1.reviewed_by == self.mentor_user
        assert analysis_1.review_action_taken == 'COUNSELING_SCHEDULED'
        assert analysis_1.reviewed_at is not None

        # 3. Mentor attempts to review unassigned student_2 -> Forbidden (403)
        review_fail = self.client.post(f'/api/v1/analytics/ai-risk/{analysis_2.id}/review/', {
            'review_notes': 'Attempting unauthorized review.',
            'review_action_taken': 'NO_ACTION'
        }, format='json')
        assert review_fail.status_code in [403, 404]

    def test_student_confidential_self_view(self):
        """Verify student can only view their own AI analysis record."""
        analysis_1 = AcademicRiskEngine.evaluate_student(self.student_1)
        analysis_2 = AcademicRiskEngine.evaluate_student(self.student_2)

        self.client.force_authenticate(user=self.student_user_1)

        res = self.client.get('/api/v1/analytics/ai-risk/')
        assert res.status_code == 200
        results = res.data.get('results', res.data.get('data', res.data))
        assert len(results) == 1
        assert str(results[0]['student']) == str(self.student_1.id)
