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
from academics.models import Course, Batch, Semester, Subject, FacultySubject
from cameras.models import CameraZone, Camera
from tracking.models import BiometricProfile, DetectionEvent, StudentLatestLocation, TrackingAccessLog, FaceEnrollment
from attendance.models import AttendanceSession, StudentAttendance


@pytest.mark.django_db
class TestCameraAndTrackingWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Colleges
        self.college = College.objects.create(name="Apex Tech", code="APEX-CAM", slug="apex-cam", status="ACTIVE")
        self.other_college = College.objects.create(name="Beta Tech", code="BETA-CAM", slug="beta-cam", status="ACTIVE")

        # Users
        self.hod_officer = User.objects.create_user(
            email="hod@apex.edu", password="Password123!", role="HOD", college=self.college, first_name="Balwinder"
        )
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
            email="ananya@apex.edu", password="Password123!", role="STUDENT", college=self.college, first_name="Ananya"
        )
        self.other_hod = User.objects.create_user(
            email="hod@beta.edu", password="Password123!", role="HOD", college=self.other_college, first_name="BetaOfficer"
        )

        # Department, Faculty, Students
        self.dept = Department.objects.create(college=self.college, name="Computer Science", code="CSE", status="ACTIVE")
        self.faculty_hod = Faculty.objects.create(
            user=self.hod_officer, college=self.college, faculty_number="FAC-HOD-01", department=self.dept,
            designation="PROFESSOR", joining_date=date(2020, 1, 1), status="ACTIVE"
        )
        self.course = Course.objects.create(
            college=self.college, department=self.dept, name="B.Tech CSE", code="BTECH-CAM", duration_years=4, total_semesters=8
        )
        self.batch = Batch.objects.create(
            college=self.college, course=self.course, name="2026-2030", academic_year="2026-2027", start_date=date(2026, 8, 1)
        )
        self.semester = Semester.objects.create(
            college=self.college, batch=self.batch, semester_number=1, name="Sem 1", is_current=True
        )

        self.faculty = Faculty.objects.create(
            user=self.mentor_user, college=self.college, faculty_number="FAC-CAM-01", department=self.dept,
            designation="ASSOCIATE_PROFESSOR", joining_date=date(2022, 1, 1), status="ACTIVE"
        )

        self.student_1 = Student.objects.create(
            user=self.student_user_1, college=self.college, student_number="STU-CAM-01", roll_number="CSE-CAM-01",
            department=self.dept, course=self.course, batch=self.batch, current_semester=self.semester,
            admission_date=date(2026, 8, 1), status="ACTIVE"
        )
        self.student_2 = Student.objects.create(
            user=self.student_user_2, college=self.college, student_number="STU-CAM-02", roll_number="CSE-CAM-02",
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

        # Camera Zone & Camera for Apex
        self.zone_gate = CameraZone.objects.create(
            college=self.college, name="Main Gate", code="ZONE-APEX-GATE", building="Gatehouse", floor=0
        )
        self.zone_lab = CameraZone.objects.create(
            college=self.college, name="CSE Lab", code="ZONE-APEX-LAB", building="Block A", floor=2
        )
        self.camera_gate = Camera.objects.create(
            college=self.college, zone=self.zone_gate, name="Gate 1 Camera", code="CAM-APEX-GATE",
            camera_type="BULLET", status="ONLINE", fps=30
        )
        self.camera_lab = Camera.objects.create(
            college=self.college, zone=self.zone_lab, name="Lab Camera", code="CAM-APEX-LAB",
            camera_type="DOME", status="ONLINE", fps=30
        )

        # Camera in Beta college
        self.other_zone = CameraZone.objects.create(
            college=self.other_college, name="Beta Gate", code="ZONE-BETA-GATE", building="Gate", floor=0
        )
        self.other_camera = Camera.objects.create(
            college=self.other_college, zone=self.other_zone, name="Beta Camera", code="CAM-BETA-GATE",
            camera_type="BULLET", status="ONLINE", fps=30
        )

        # Biometric Face Enrollment with verified consent (DPDP Act 2023)
        FaceEnrollment.objects.create(
            college=self.college,
            student=self.student_1,
            consent_given=True,
            consent_by=self.principal,
            embedding=[0.05] * 128,
            is_active=True
        )
        FaceEnrollment.objects.create(
            college=self.college,
            student=self.student_2,
            consent_given=True,
            consent_by=self.principal,
            embedding=[0.05] * 128,
            is_active=True
        )

        # Subject, FacultySubject, and Active Period Session where student_1 is marked ABSENT
        self.subject = Subject.objects.create(
            college=self.college, department=self.dept, course=self.course,
            name="Operating Systems", code="CS302", credits=4, semester_number=1
        )
        FacultySubject.objects.create(
            college=self.college,
            faculty=self.faculty,
            subject=self.subject,
            batch=self.batch,
            academic_year="2026-2027"
        )
        now = timezone.now()
        self.session = AttendanceSession.objects.create(
            college=self.college, subject=self.subject, semester=self.semester,
            faculty=self.faculty, date=now.date(),
            start_time=(now - timedelta(minutes=15)).time(),
            end_time=(now + timedelta(minutes=45)).time(),
            session_type="REGULAR"
        )
        StudentAttendance.objects.create(
            college=self.college, session=self.session,
            student=self.student_1, status="ABSENT"
        )

    def test_camera_and_zone_crud_and_tenant_isolation(self):
        """Verify camera directory and tenant isolation between colleges."""
        self.client.force_authenticate(user=self.hod_officer)

        # 1. Apex security lists zones
        res = self.client.get('/api/v1/cameras/zones/')
        assert res.status_code == 200
        data = res.data.get('results', res.data.get('data', res.data))
        zone_codes = [z['code'] for z in data]
        assert "ZONE-APEX-GATE" in zone_codes
        assert "ZONE-APEX-LAB" in zone_codes
        assert "ZONE-BETA-GATE" not in zone_codes  # Strict tenant isolation

        # 2. Apex security lists cameras
        res = self.client.get('/api/v1/cameras/cameras/')
        assert res.status_code == 200
        data = res.data.get('results', res.data.get('data', res.data))
        cam_codes = [c['code'] for c in data]
        assert "CAM-APEX-GATE" in cam_codes
        assert "CAM-APEX-LAB" in cam_codes
        assert "CAM-BETA-GATE" not in cam_codes

        # 3. Stats overview
        res = self.client.get('/api/v1/cameras/stats/')
        assert res.status_code == 200
        stats = res.data.get('data', res.data)
        assert stats['total_cameras'] == 2
        assert stats['online_cameras'] == 2
        assert stats['total_zones'] == 2

    def test_camera_heartbeat_action(self):
        """Verify camera heartbeat updates status and timestamp."""
        self.client.force_authenticate(user=self.hod_officer)

        res = self.client.post(f'/api/v1/cameras/cameras/{self.camera_gate.id}/heartbeat/', {
            'status': 'ONLINE',
            'fps': 28
        }, format='json')
        assert res.status_code == 200
        self.camera_gate.refresh_from_db()
        assert self.camera_gate.fps == 28
        assert self.camera_gate.last_heartbeat is not None

    def test_edge_detection_ingestion_updates_latest_location(self):
        """Verify edge detection ingest endpoint updates latest location and logs event."""
        self.client.force_authenticate(user=self.hod_officer)

        det_time = timezone.now() - timedelta(minutes=10)
        res = self.client.post('/api/v1/tracking/ingest/', {
            'camera_code': 'CAM-APEX-GATE',
            'student_number': 'STU-CAM-01',
            'confidence_score': 0.9750,
            'detected_at': det_time.isoformat(),
            'event_type': 'FACE_RECOGNITION'
        }, format='json')

        assert res.status_code == 201
        assert DetectionEvent.objects.filter(student=self.student_1).count() == 1

        latest = StudentLatestLocation.objects.get(student=self.student_1)
        assert latest.camera == self.camera_gate
        assert latest.zone == self.zone_gate
        assert float(latest.confidence_score) == 0.9750

        # Now simulate subsequent detection inside CSE Lab (newer time)
        newer_time = timezone.now() - timedelta(minutes=2)
        res2 = self.client.post('/api/v1/tracking/ingest/', {
            'camera_code': 'CAM-APEX-LAB',
            'student_number': 'STU-CAM-01',
            'confidence_score': 0.9880,
            'detected_at': newer_time.isoformat(),
            'event_type': 'FACE_RECOGNITION'
        }, format='json')

        assert res2.status_code == 201
        assert DetectionEvent.objects.filter(student=self.student_1).count() == 2

        # Verify latest location advanced to CSE Lab
        latest.refresh_from_db()
        assert latest.camera == self.camera_lab
        assert latest.zone == self.zone_lab

    def test_mentor_cohort_scoping_on_tracking(self):
        """Verify assigned faculty can search absent student, but is rejected on student not marked absent."""
        # Seed detection for both students
        DetectionEvent.objects.create(
            college=self.college, camera=self.camera_lab, zone=self.zone_lab,
            student=self.student_1, detected_at=timezone.now(), confidence_score=Decimal("0.9600")
        )
        StudentLatestLocation.objects.create(
            college=self.college, camera=self.camera_lab, zone=self.zone_lab,
            student=self.student_1, detected_at=timezone.now(), confidence_score=Decimal("0.9600")
        )

        DetectionEvent.objects.create(
            college=self.college, camera=self.camera_gate, zone=self.zone_gate,
            student=self.student_2, detected_at=timezone.now(), confidence_score=Decimal("0.9500")
        )

        self.client.force_authenticate(user=self.mentor_user)

        # 1. Faculty queries absent student in active period (Rahul / student_1) -> Success (200)
        res1 = self.client.get('/api/v1/tracking/last-seen/', {
            'student_id': str(self.student_1.id),
            'reason': 'Academic period attendance follow-up'
        }, HTTP_X_ACTIVE_ROLE="FACULTY")
        assert res1.status_code == 200
        data1 = res1.data.get('data', res1.data)
        assert data1['student']['roll_number'] == "CSE-CAM-01"
        assert data1['last_seen']['zone_code'] == "ZONE-APEX-LAB"

        # 2. Faculty queries student not marked absent (Ananya / student_2) -> Bad Request (400)
        res2 = self.client.get('/api/v1/tracking/last-seen/', {
            'student_id': str(self.student_2.id),
            'reason': 'Attempting unauthorized lookup'
        }, HTTP_X_ACTIVE_ROLE="FACULTY")
        assert res2.status_code == 400
        assert res2.data.get('code') in ['STUDENT_NOT_MARKED_ABSENT', 'NO_ACTIVE_SESSION']

    def test_tracking_search_requires_reason_and_creates_audit_log(self):
        """Verify mandatory operational reason and audit log creation."""
        self.client.force_authenticate(user=self.hod_officer)

        # 1. Missing reason -> Bad Request (400)
        res1 = self.client.get('/api/v1/tracking/last-seen/', {
            'student_id': str(self.student_1.id),
        }, HTTP_X_ACTIVE_ROLE="HOD")
        assert res1.status_code == 400
        assert "reason" in res1.data.get('message', '').lower()

        # 2. Short reason (< 3 chars) -> Bad Request (400)
        res2 = self.client.get('/api/v1/tracking/last-seen/', {
            'student_id': str(self.student_1.id),
            'reason': 'ab'
        }, HTTP_X_ACTIVE_ROLE="HOD")
        assert res2.status_code == 400

        # 3. Valid reason -> Success (200) and audit log written
        valid_reason = "Campus perimeter security check on reported student missing from exam"
        res3 = self.client.get('/api/v1/tracking/last-seen/', {
            'student_id': str(self.student_1.id),
            'reason': valid_reason
        }, HTTP_X_ACTIVE_ROLE="HOD")
        assert res3.status_code == 200

        log = TrackingAccessLog.objects.filter(student=self.student_1, user=self.hod_officer).first()
        assert log is not None
        assert log.reason == valid_reason

        # 4. Audit log endpoint returns this entry
        audit_res = self.client.get('/api/v1/tracking/audit-logs/', HTTP_X_ACTIVE_ROLE="HOD")
        assert audit_res.status_code == 200
        logs = audit_res.data.get('results', audit_res.data.get('data', audit_res.data))
        assert any(l['reason'] == valid_reason for l in logs)

    def test_unauthorized_roles_blocked_from_cameras_and_tracking(self):
        """Verify students and parents cannot view cameras or track locations."""
        self.client.force_authenticate(user=self.student_user_1)

        # Cannot view cameras
        res_cam = self.client.get('/api/v1/cameras/cameras/')
        assert res_cam.status_code == 403

        # Cannot search tracking
        res_track = self.client.get('/api/v1/tracking/last-seen/', {
            'student_id': str(self.student_2.id),
            'reason': 'Curious about friend location'
        })
        assert res_track.status_code == 403
