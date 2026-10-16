from django.db import models
from common.models import TenantModel

class Course(TenantModel):
    DEGREE_LEVEL_CHOICES = [
        ('UG', 'Undergraduate'),
        ('PG', 'Postgraduate'),
        ('DIPLOMA', 'Diploma'),
        ('DOCTORAL', 'Doctoral (Ph.D.)'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    ]

    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='courses',
        db_index=True
    )
    name = models.CharField(max_length=200, db_index=True)
    code = models.CharField(max_length=50, db_index=True, help_text="e.g. BTECH-CSE, BCA, MBA")
    degree_level = models.CharField(max_length=20, choices=DEGREE_LEVEL_CHOICES, default='UG')
    duration_years = models.PositiveSmallIntegerField(default=4)
    total_semesters = models.PositiveSmallIntegerField(default=8)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['college', 'code'],
                condition=models.Q(is_deleted=False),
                name='unique_course_code_per_college'
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Batch(TenantModel):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('ARCHIVED', 'Archived'),
    ]

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='batches',
        db_index=True
    )
    name = models.CharField(max_length=100, db_index=True, help_text="e.g. 2026-2030 Batch")
    academic_year = models.CharField(max_length=50, help_text="e.g. 2026-2027")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)

    class Meta:
        ordering = ['-start_date', 'name']
        verbose_name_plural = 'Batches'
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'name'],
                condition=models.Q(is_deleted=False),
                name='unique_batch_name_per_course'
            )
        ]

    def __str__(self):
        return f"{self.course.code} — {self.name}"

    @property
    def class_section(self):
        cs = self.class_sections.first()
        if not cs:
            cs = ClassSection.objects.create(
                college=self.college,
                department=self.course.department,
                course=self.course,
                batch=self,
                name=self.name,
                academic_year=self.academic_year,
                is_active=(self.status == 'ACTIVE')
            )
        return cs



class Semester(TenantModel):
    batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE,
        related_name='semesters',
        db_index=True
    )
    semester_number = models.PositiveSmallIntegerField(db_index=True, help_text="1 to 8")
    name = models.CharField(max_length=100, help_text="e.g. Semester 1, Semester 2")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['batch', 'semester_number']
        constraints = [
            models.UniqueConstraint(
                fields=['batch', 'semester_number'],
                condition=models.Q(is_deleted=False),
                name='unique_semester_per_batch'
            )
        ]

    def __str__(self):
        return f"{self.batch.name} - {self.name}"


class Subject(TenantModel):
    SUBJECT_TYPE_CHOICES = [
        ('THEORY', 'Theory'),
        ('PRACTICAL', 'Laboratory / Practical'),
        ('HYBRID', 'Hybrid (Theory + Lab)'),
    ]

    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.PROTECT,
        related_name='subjects',
        db_index=True
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.PROTECT,
        related_name='subjects',
        db_index=True
    )
    name = models.CharField(max_length=200, db_index=True)
    code = models.CharField(max_length=50, db_index=True, help_text="e.g. CS301, PY102")
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPE_CHOICES, default='THEORY')
    credits = models.PositiveSmallIntegerField(default=4)
    semester_number = models.PositiveSmallIntegerField(default=1, db_index=True)
    syllabus = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='ACTIVE', db_index=True)

    class Meta:
        ordering = ['course', 'semester_number', 'code']
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'code'],
                condition=models.Q(is_deleted=False),
                name='unique_subject_code_per_course'
            )
        ]

    def __str__(self):
        return f"{self.code}: {self.name} (Sem {self.semester_number})"


class FacultySubject(TenantModel):
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='faculty_assignments'
    )
    faculty = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='subject_assignments'
    )
    batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE,
        related_name='faculty_subjects'
    )
    academic_year = models.CharField(max_length=50, help_text="e.g. 2026-2027")
    is_primary = models.BooleanField(default=True)

    class Meta:
        ordering = ['subject', 'faculty']
        constraints = [
            models.UniqueConstraint(
                fields=['subject', 'faculty', 'batch', 'academic_year'],
                condition=models.Q(is_deleted=False),
                name='unique_faculty_subject_batch_year'
            )
        ]

    def __str__(self):
        return f"{self.faculty.user.get_full_name()} ➔ {self.subject.code} ({self.batch.name})"


class TimetableEntry(TenantModel):
    DAY_CHOICES = [
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='timetable_entries')
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='timetable_entries')
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='timetable_entries')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='timetable_entries')
    faculty = models.ForeignKey('faculty.Faculty', on_delete=models.CASCADE, related_name='timetable_entries')
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES, db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=100, help_text="e.g. Hall 304, Computer Lab 2")

    class Meta:
        ordering = ['day_of_week', 'start_time']
        indexes = [
            models.Index(fields=['batch', 'day_of_week']),
            models.Index(fields=['faculty', 'day_of_week']),
        ]

    def __str__(self):
        return f"{self.get_day_of_week_display()}: {self.subject.code} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}) in {self.room}"


class ClassSection(TenantModel):
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.CASCADE,
        related_name='class_sections'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='class_sections'
    )
    batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE,
        related_name='class_sections',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=100, help_text="e.g. Section A, CSE-A")
    academic_year = models.CharField(max_length=50, default="2026-2027")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['course', 'name']

    def __str__(self):
        return f"{self.course.code} - {self.name}"


class ClassIncharge(TenantModel):
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.CASCADE,
        related_name='class_incharges'
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.CASCADE,
        related_name='incharges'
    )
    faculty = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='incharge_assignments'
    )
    academic_year = models.CharField(max_length=50, default="2026-2027")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['-academic_year', 'class_section']

    def __str__(self):
        return f"Incharge: {self.faculty.user.get_full_name()} for {self.class_section.name} ({self.academic_year})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from accounts.models import UserRole
        if self.is_active:
            UserRole.objects.update_or_create(
                user=self.faculty.user,
                college=self.college,
                role='CLASS_INCHARGE',
                source='assignment',
                defaults={'is_active': True}
            )
        else:
            if not ClassIncharge.objects.filter(faculty=self.faculty, is_active=True).exists():
                UserRole.objects.filter(
                    user=self.faculty.user,
                    role='CLASS_INCHARGE',
                    source='assignment'
                ).update(is_active=False)


class SubjectAssignment(TenantModel):
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.CASCADE,
        related_name='subject_assignments'
    )
    faculty = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='subject_allocations'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='subject_allocations'
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.CASCADE,
        related_name='subject_allocations'
    )
    academic_year = models.CharField(max_length=50, default="2026-2027")
    is_active = models.BooleanField(default=True, db_index=True)
    end_date = models.DateField(null=True, blank=True, help_text="Null for permanent; specific date for substitute faculty")

    class Meta:
        ordering = ['class_section', 'subject']

    def __str__(self):
        return f"{self.faculty.user.get_full_name()} ➔ {self.subject.code} in {self.class_section.name}"

    @property
    def is_currently_valid(self):
        from django.utils import timezone
        if not self.is_active:
            return False
        if self.end_date and self.end_date < timezone.now().date():
            return False
        return True

