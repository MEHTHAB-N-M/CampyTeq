from django.core.exceptions import PermissionDenied
from django.db import models
from django.utils import timezone
from common.permissions import get_acting_role
from academics.models import ClassSection, ClassIncharge, SubjectAssignment, FacultySubject, Batch
from faculty.models import Faculty

def resolve_class_section(class_or_id, college=None):
    """Resolves a ClassSection from a ClassSection instance, Batch instance, or ID/UUID."""
    if isinstance(class_or_id, ClassSection):
        return class_or_id
    if isinstance(class_or_id, Batch):
        return class_or_id.class_section

    # ID lookup
    cs = ClassSection.objects.filter(id=class_or_id).first()
    if cs:
        return cs
    batch = Batch.objects.filter(id=class_or_id).first()
    if batch:
        return batch.class_section
    return None


def risk_queryset(user, class_section, request=None):
    """
    ONE shared scoping helper for Risk Radar, attendance and marks.
    Enforces exact specification rules:
    - Own class (class incharge mode): returns ("class", None)
    - Other class they teach: returns ("subject", [subject_id, ...])
    - Class they neither run nor teach: raises PermissionDenied
    """
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required.")

    acting_role = get_acting_role(request) if request else getattr(user, 'acting_role', None) or user.get_default_active_role()

    # Super Admin and Principal have full institutional class scope
    if acting_role in ['SUPER_ADMIN', 'PRINCIPAL'] or user.role in ['SUPER_ADMIN', 'PRINCIPAL']:
        return ("class", None)

    cs = resolve_class_section(class_section, college=user.college)
    if not cs:
        raise PermissionDenied("Target class/section does not exist.")

    faculty_profile = getattr(user, 'faculty_profile', None)
    if not faculty_profile:
        raise PermissionDenied("User does not have an active faculty profile.")

    # 1. HOD scope check
    if acting_role == 'HOD' or (user.role == 'HOD' and acting_role == 'HOD'):
        if faculty_profile.department_id == cs.department_id:
            return ("class", None)

    # 2. Check if user is active CLASS_INCHARGE of this class section
    if acting_role == 'CLASS_INCHARGE':
        is_incharge = ClassIncharge.objects.filter(
            faculty=faculty_profile,
            class_section=cs,
            is_active=True
        ).exists()
        # Also check if linked via batch
        if not is_incharge and cs.batch:
            is_incharge = ClassIncharge.objects.filter(
                faculty=faculty_profile,
                class_section__batch=cs.batch,
                is_active=True
            ).exists()

        if is_incharge:
            return ("class", None)

    # 3. Check if user teaches subjects in this class section
    taught_subject_ids = list(SubjectAssignment.objects.filter(
        faculty=faculty_profile,
        class_section=cs,
        is_active=True
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=timezone.now().date())
    ).values_list('subject_id', flat=True))

    # Also check legacy/direct FacultySubject assignments for this batch
    if cs.batch:
        fs_ids = list(FacultySubject.objects.filter(
            faculty=faculty_profile,
            batch=cs.batch
        ).values_list('subject_id', flat=True))
        taught_subject_ids = list(set(taught_subject_ids + fs_ids))

    if taught_subject_ids:
        return ("subject", taught_subject_ids)

    # 4. If neither running nor teaching this class: denied!
    raise PermissionDenied("You neither run nor teach this class.")
