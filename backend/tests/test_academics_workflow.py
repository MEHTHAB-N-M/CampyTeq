import pytest
from datetime import date, time, timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User
from departments.models import Department
from academics.models import Course, Batch, Semester, Subject, TimetableEntry, FacultySubject
from faculty.models import Faculty
from students.models import Student
from exams.models import Exam, ExamSubject, Result
from assignments.models import Assignment, AssignmentSubmission

@pytest.mark.django_db
class TestAcademicsWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # College
        self.college = College.objects.create(name="Apex Tech", code="APEX-ACAD", slug="apex-acad", status="ACTIVE")

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

        # Hierarchy
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.faculty = Faculty.objects.create(
            user=self.faculty_user, college=self.college, faculty_number="FAC-01", department=self.dept,
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
        self.student = Student.objects.create(
            user=self.student_user, college=self.college, student_number="STU-01", roll_number="CSE-01",
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

    def test_timetable_today_endpoint(self):
        """Student should retrieve today's class schedule for their batch."""
        today_dow = timezone.now().isoweekday()
        target_day = 1 if today_dow > 6 else today_dow

        TimetableEntry.objects.create(
            college=self.college, course=self.course, batch=self.batch, semester=self.semester,
            subject=self.subject, faculty=self.faculty, day_of_week=target_day,
            start_time=time(9, 0), end_time=time(10, 0), room="Hall 304"
        )

        self.client.force_authenticate(user=self.student_user)
        res = self.client.get('/api/v1/academics/timetable/today/')
        assert res.status_code == 200
        assert res.data['total'] >= 1
        assert res.data['classes'][0]['room'] == "Hall 304"
        assert res.data['classes'][0]['subject_code'] == "CS101"

    def test_exam_result_hidden_until_published(self):
        """Student cannot see marks while is_published=False; can see once published."""
        exam = Exam.objects.create(
            college=self.college, name="Mid-Term Test", batch=self.batch, semester=self.semester,
            start_date=date(2026, 9, 1), end_date=date(2026, 9, 5), is_published=False, status="COMPLETED"
        )
        es = ExamSubject.objects.create(
            exam=exam, subject=self.subject, exam_date=date(2026, 9, 1),
            start_time=time(10, 0), end_time=time(12, 0), maximum_marks=100, passing_marks=40
        )
        Result.objects.create(
            college=self.college, exam_subject=es, student=self.student,
            marks_obtained=88.0, grade="A"
        )

        # 1. Student queries when unpublished -> 0 records
        self.client.force_authenticate(user=self.student_user)
        res1 = self.client.get('/api/v1/exams/results/')
        assert res1.status_code == 200
        results_list = res1.data.get('results', res1.data)
        assert len(results_list) == 0

        # 2. Principal publishes exam
        self.client.force_authenticate(user=self.principal)
        pub_res = self.client.post(f'/api/v1/exams/{exam.id}/publish/')
        assert pub_res.status_code == 200

        # 3. Student queries again -> marks visible with grade
        self.client.force_authenticate(user=self.student_user)
        res2 = self.client.get('/api/v1/exams/results/')
        assert res2.status_code == 200
        results_list2 = res2.data.get('results', res2.data)
        assert len(results_list2) == 1
        assert float(results_list2[0]['marks_obtained']) == 88.0
        assert results_list2[0]['grade'] == "A"

    def test_assignment_submission_and_grading_workflow(self):
        """Faculty assigns -> Student submits -> Faculty grades with marks and feedback."""
        assignment = Assignment.objects.create(
            college=self.college, faculty=self.faculty, subject=self.subject, batch=self.batch,
            title="Tree Inversion Assignment", description="Invert binary tree recursively",
            maximum_marks=100, due_date=timezone.now() + timedelta(days=3), status="ACTIVE"
        )

        # 1. Student submits
        self.client.force_authenticate(user=self.student_user)
        sub_res = self.client.post('/api/v1/assignments/submissions/', {
            'assignment': assignment.id,
            'file_url': 'https://storage.campyteq.local/assignments/tree.py',
            'submission_text': 'Completed solution with O(N) time complexity'
        })
        assert sub_res.status_code == 201
        submission_id = sub_res.data['id']
        assert sub_res.data['status'] == 'SUBMITTED'

        # 2. Faculty grades
        self.client.force_authenticate(user=self.faculty_user)
        grade_res = self.client.post(f'/api/v1/assignments/submissions/{submission_id}/grade/', {
            'marks_awarded': 95.0,
            'feedback': 'Excellent clean recursive code and test coverage.'
        })
        assert grade_res.status_code == 200
        assert float(grade_res.data['marks_awarded']) == 95.0
        assert grade_res.data['status'] == 'GRADED'

        # 3. Student reviews graded submission
        self.client.force_authenticate(user=self.student_user)
        check_res = self.client.get(f'/api/v1/assignments/submissions/{submission_id}/')
        assert check_res.status_code == 200
        assert float(check_res.data['marks_awarded']) == 95.0
        assert check_res.data['feedback'] == 'Excellent clean recursive code and test coverage.'
