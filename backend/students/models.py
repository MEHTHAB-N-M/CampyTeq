from django.db import models
from django.utils import timezone
from common.models import TenantModel

class Student(TenantModel):
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('GRADUATED', 'Graduated'),
        ('SUSPENDED', 'Suspended'),
        ('TRANSFERRED', 'Transferred'),
    ]

    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='student_profile',
        db_index=True
    )
    student_number = models.CharField(max_length=50, db_index=True, help_text="Unique institutional student ID")
    roll_number = models.CharField(max_length=50, db_index=True, help_text="Class/Batch roll number")
    admission_date = models.DateField()
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='students',
        db_index=True
    )
    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.PROTECT,
        related_name='students',
        db_index=True
    )
    batch = models.ForeignKey(
        'academics.Batch',
        on_delete=models.PROTECT,
        related_name='students',
        db_index=True
    )
    current_semester = models.ForeignKey(
        'academics.Semester',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
        db_index=True
    )
    mentor = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mentored_students',
        db_index=True
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='MALE')
    blood_group = models.CharField(max_length=10, blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)

    class Meta:
        ordering = ['roll_number']
        constraints = [
            models.UniqueConstraint(
                fields=['college', 'student_number'],
                condition=models.Q(is_deleted=False),
                name='unique_student_number_per_college'
            ),
            models.UniqueConstraint(
                fields=['batch', 'roll_number'],
                condition=models.Q(is_deleted=False),
                name='unique_roll_number_per_batch'
            )
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.roll_number}) - {self.course.code}"


class Guardian(TenantModel):
    RELATIONSHIP_CHOICES = [
        ('FATHER', 'Father'),
        ('MOTHER', 'Mother'),
        ('LEGAL_GUARDIAN', 'Legal Guardian'),
        ('OTHER', 'Other'),
    ]

    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guardian_profile'
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)
    relationship = models.CharField(max_length=30, choices=RELATIONSHIP_CHOICES, default='FATHER')
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=150, blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_relationship_display()})"


class StudentGuardian(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='guardian_relations')
    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE, related_name='student_relations')
    is_primary = models.BooleanField(default=True)
    emergency_contact = models.BooleanField(default=True)

    class Meta:
        unique_together = ('student', 'guardian')

    def __str__(self):
        return f"{self.student.roll_number} ↔ {self.guardian.first_name}"


class MentorAssignment(TenantModel):
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.CASCADE,
        related_name='mentor_assignments',
        null=True,
        blank=True
    )
    mentor = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='assigned_cohorts'
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='mentor_assignments'
    )
    academic_year = models.CharField(max_length=50, default="2026-2027")
    is_active = models.BooleanField(default=True, db_index=True)
    assigned_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_mentor_assignments'
    )
    assigned_on = models.DateTimeField(default=timezone.now)
    ended_on = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-assigned_on']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'academic_year'],
                condition=models.Q(is_active=True),
                name='unique_active_mentor_per_student_year'
            )
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.mentor and self.student:
            if self.mentor.college_id != self.student.college_id:
                raise ValidationError("Mentor and student must be in the same college.")
            if self.mentor.department_id != self.student.department_id:
                raise ValidationError("Mentor and student must be in the same department.")

    def save(self, *args, **kwargs):
        from django.utils import timezone
        from accounts.models import UserRole

        if self.mentor and not self.college_id:
            self.college = self.mentor.college
        if self.mentor and not self.department_id:
            self.department = self.mentor.department

        self.clean()

        # If setting to active, end any other active assignment for this student in the academic year
        if self.is_active:
            MentorAssignment.objects.filter(
                student=self.student,
                academic_year=self.academic_year,
                is_active=True
            ).exclude(pk=self.pk).update(is_active=False, ended_on=timezone.now())

        super().save(*args, **kwargs)

        # Auto-create or auto-end MENTOR role in UserRole
        if self.is_active:
            UserRole.objects.update_or_create(
                user=self.mentor.user,
                college=self.college,
                role='MENTOR',
                source='assignment',
                defaults={'is_active': True}
            )
        else:
            if not MentorAssignment.objects.filter(mentor=self.mentor, is_active=True).exists():
                UserRole.objects.filter(
                    user=self.mentor.user,
                    role='MENTOR',
                    source='assignment'
                ).update(is_active=False)

    def __str__(self):
        return f"Mentor {self.mentor.user.get_full_name()} ➔ Student {self.student.roll_number} ({self.academic_year})"


class ParentWardLink(TenantModel):
    """
    Verified institutional link binding a parent user to a student ward.
    Only college administrators (Principal or HOD) can create, verify, or end links.
    """
    RELATION_CHOICES = [
        ('FATHER', 'Father'),
        ('MOTHER', 'Mother'),
        ('LEGAL_GUARDIAN', 'Legal Guardian'),
        ('OTHER', 'Other'),
    ]

    parent = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='ward_links'
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='parent_links'
    )
    relation = models.CharField(max_length=30, choices=RELATION_CHOICES, default='FATHER')
    is_verified = models.BooleanField(default=True, db_index=True)
    verified_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_parent_links'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['student__roll_number']
        constraints = [
            models.UniqueConstraint(
                fields=['parent', 'student'],
                name='unique_parent_student_link'
            )
        ]

    def __str__(self):
        return f"{self.parent.email} ↔ Ward {self.student.student_number} ({self.relation})"


class MenteeCounselingNote(TenantModel):
    """
    Confidential counseling and welfare notes recorded by the assigned mentor.
    A new mentor can read past notes; a former mentor cannot.
    """
    mentor = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='counseling_notes'
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='counseling_notes'
    )
    note = models.TextField()
    academic_year = models.CharField(max_length=50, default="2026-2027")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note for {self.student.roll_number} by {self.mentor.user.get_full_name()} ({self.created_at.strftime('%Y-%m-%d')})"

