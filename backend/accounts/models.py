import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from common.models import TimeStampedModel
from .permissions_map import ROLE_PERMISSION_MAP

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
        extra_fields.setdefault('role', 'SUPER_ADMIN')
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
    # 11 Base Roles (CLASS_INCHARGE and MENTOR are assignment modes, not base roles)
    ROLE_CHOICES = [
        ('SUPER_ADMIN', 'Super Admin'),
        ('PRINCIPAL', 'Principal'),
        ('HOD', 'Head of Department'),
        ('FACULTY', 'Faculty'),
        ('LAB_FACULTY', 'Lab Faculty'),
        ('ACCOUNTANT', 'Accountant'),
        ('LIBRARY_FACULTY', 'Library Faculty'),
        ('PRINT_STAFF', 'Print Shop Staff'),
        ('SECURITY', 'Security Administrator'),
        ('STUDENT', 'Student'),
        ('PARENT', 'Parent/Guardian'),
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
    last_active_role = models.CharField(max_length=50, blank=True, null=True)

    college = models.ForeignKey(
        'colleges.College',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='users',
        db_index=True,
        help_text="Tenant association. Nullable for cross-tenant Principal / Super Admin."
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

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Automatically sync base role into UserRole table
        if self.role:
            UserRole.objects.update_or_create(
                user=self,
                role=self.role,
                source='base',
                defaults={
                    'college': self.college,
                    'is_active': (self.status == 'ACTIVE' and self.is_active),
                }
            )

    def get_held_roles(self):
        """Returns list of active role codes currently held by the user."""
        roles = list(self.user_roles.filter(is_active=True).values_list('role', flat=True))
        if self.role and self.role not in roles and self.is_active:
            roles.append(self.role)
        return roles

    def get_default_active_role(self):
        """
        Default role at login:
        Last used if still active, otherwise precedence: HOD > CLASS_INCHARGE > MENTOR > FACULTY.
        """
        active_roles = self.get_held_roles()
        if self.last_active_role and self.last_active_role in active_roles:
            return self.last_active_role

        for r in ['HOD', 'CLASS_INCHARGE', 'MENTOR', 'FACULTY']:
            if r in active_roles:
                return r

        if active_roles:
            return active_roles[0]

        return self.role

    def get_all_permissions_list(self, acting_role=None):
        """
        Only the active role grants permissions, never the union of held roles.
        HasGranularPermission must re-check on every request that the active role
        is still active in UserRole, so a revoked assignment loses access immediately.
        """
        active_role = acting_role or self.last_active_role or self.get_default_active_role()

        # Re-check that this role is still active in UserRole
        if not self.user_roles.filter(role=active_role, is_active=True).exists() and active_role != self.role:
            return set()

        # Super Admin and Principal access
        if active_role in ['SUPER_ADMIN', 'PRINCIPAL']:
            db_perms = set(Permission.objects.values_list('code', flat=True))
            spec_perms = ROLE_PERMISSION_MAP.get(active_role, set())
            return db_perms.union(spec_perms)

        # Standard permission set from spec
        perm_codes = set(ROLE_PERMISSION_MAP.get(active_role, set()))

        # Add custom assigned permissions from Role model if configured
        system_role = Role.objects.filter(code=active_role).prefetch_related('permissions').first()
        if system_role:
            perm_codes.update(system_role.permissions.values_list('code', flat=True))

        return perm_codes


class UserRole(TimeStampedModel):
    """
    Multi-role assignment model:
    Tracks base roles and dynamic assignment modes (CLASS_INCHARGE, MENTOR) held by a user.
    """
    SOURCE_CHOICES = [
        ('base', 'Base Role'),
        ('assignment', 'Assignment Mode'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    college = models.ForeignKey('colleges.College', on_delete=models.CASCADE, null=True, blank=True, related_name='user_roles')
    role = models.CharField(max_length=50, db_index=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='base')
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['-is_active', 'role']
        constraints = [
            models.UniqueConstraint(fields=['user', 'role', 'source'], name='unique_user_role_source')
        ]

    def __str__(self):
        return f"{self.user.email} - {self.role} ({self.source}) [{'Active' if self.is_active else 'Inactive'}]"


class AuditLog(models.Model):
    """Tamper-evident immutable audit log for security and compliance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    college = models.ForeignKey('colleges.College', on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    acting_role = models.CharField(max_length=50, blank=True, default='', db_index=True)
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
            models.Index(fields=['acting_role', 'timestamp']),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.user or 'System'} ({self.acting_role or 'NoRole'}) - {self.action} on {self.resource_type}"
