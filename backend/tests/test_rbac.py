import pytest
from rest_framework.test import APIClient
from colleges.models import College
from accounts.models import User

@pytest.mark.django_db
class TestRBAC:
    def setup_method(self):
        self.client = APIClient()
        self.college = College.objects.create(
            name="Apex Institute",
            code="APEX-TEST",
            slug="apex-test",
            status="ACTIVE"
        )
        self.principal = User.objects.create_user(
            email="principal@apex.edu",
            password="Password123!",
            first_name="Dr. Principal",
            role="PRINCIPAL",
            college=self.college,
            status="ACTIVE"
        )
        self.student = User.objects.create_user(
            email="student@apex.edu",
            password="Password123!",
            first_name="Apex",
            last_name="Student",
            role="STUDENT",
            college=self.college,
            status="ACTIVE"
        )

    def test_principal_can_create_user(self):
        self.client.force_authenticate(user=self.principal)
        response = self.client.post('/api/v1/users/', {
            'email': 'newhod@apex.edu',
            'password': 'StrongPassword123!',
            'first_name': 'New',
            'last_name': 'HOD',
            'role': 'HOD',
            'status': 'ACTIVE'
        })
        assert response.status_code == 201
        created_user = User.objects.get(email='newhod@apex.edu')
        # Ensure college is auto-assigned to creator's college
        assert created_user.college == self.college

    def test_student_cannot_create_user(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/v1/users/', {
            'email': 'hacker@apex.edu',
            'password': 'StrongPassword123!',
            'first_name': 'Hacker',
            'role': 'STUDENT',
            'status': 'ACTIVE'
        })
        assert response.status_code == 403
        assert response.data.get('success') is False
        assert response.data.get('code') == 'PERMISSION_DENIED'
