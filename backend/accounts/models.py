import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from common.models import TimeStampedModel

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email address is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'PRINCIPAL')
        extra_fields.setdefault('status', 'ACTIVE')
        return self.create_user(email, password, **extra_fields)


class Permission(models.Model):
    """Granular permission representing an institutional action."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True, db_index=True, help_text="e.g. student.view")
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, db_index=True, help_text="e.g. Student, Attendance, Finance")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['category', 'code']

    def __str__(self):
        return f"{self.code} ({self.name})"


class Role(models.Model):
    """Institutional role bundling permissions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, related_name='roles', blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    ROLE_CHOICES = [
        ('SUPER_ADMIN', 'Super Admin'),
        ('PRINCIPAL', 'Principal'),
        ('HOD', 'Head of Department'),
        ('MENTOR', 'Mentor'),
        ('FACULTY', 'Faculty'),
        ('ACCOUNTANT', 'Accountant'),
        ('STUDENT', 'Student'),
        ('PARENT', 'Parent/Guardian'),
        ('SECURITY', 'Security Administrator'),
        ('PRINT_STAFF', 'Print Shop Staff'),
        ('LIBRARY_STAFF', 'Library Staff'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('SUSPENDED', 'Suspended'),
    ]

    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='STUDENT', db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)

    college = models.ForeignKey(
        'colleges.College',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='users',
        db_index=True,
        help_text="Tenant association. Nullable for cross-tenant Principal."
    )

    custom_roles = models.ManyToManyField(Role, related_name='users', blank=True)
    profile_photo_url = models.URLField(blank=True, max_length=500)
    is_mfa_enabled = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name']

    class Meta:
        ordering = ['first_name', 'last_name']
        indexes = [
            models.Index(fields=['college', 'role', 'status']),
            models.Index(fields=['email', 'status']),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"

    def get_full_name(self):
        full = f"{self.first_name} {self.last_name}".strip()
        return full or self.email

    def get_short_name(self):
        return self.first_name or self.email

    def get_all_permissions_list(self):
        """Returns set of all permission codes assigned via primary role and custom roles."""
        if self.role == 'PRINCIPAL':
            return set(Permission.objects.values_list('code', flat=True))

        perm_codes = set()
        # Fetch from custom assigned roles
        for r in self.custom_roles.prefetch_related('permissions'):
            perm_codes.update(r.permissions.values_list('code', flat=True))

        # Also fetch from standard system role by code
        system_role = Role.objects.filter(code=self.role).prefetch_related('permissions').first()
        if system_role:
            perm_codes.update(system_role.permissions.values_list('code', flat=True))

        return perm_codes


class AuditLog(models.Model):
    """Tamper-evident audit log for security and compliance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    college = models.ForeignKey('colleges.College', on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100, db_index=True)
    resource_type = models.CharField(max_length=100, db_index=True)
    resource_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['college', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.user or 'System'} - {self.action} on {self.resource_type}"
