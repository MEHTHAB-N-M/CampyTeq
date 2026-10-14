from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from common.permissions import IsTenantMember
from accounts.models import User
from faculty.models import Faculty
from departments.models import Department
from communication.models import (
    Announcement,
    Notification,
    Document,
)
from communication.serializers import (
    AnnouncementSerializer,
    NotificationSerializer,
    DocumentSerializer,
)


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["category", "priority", "target_audience", "department"]
    search_fields = ["title", "content"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "SUPER_ADMIN":
            active_college = getattr(self.request, "college", None)
            qs = Announcement.objects.all().select_related("department", "created_by", "college")
            if active_college:
                qs = qs.filter(Q(college=active_college) | Q(college__isnull=True))
            return qs

        # Users see announcements for their college + global super admin announcements
        qs = Announcement.objects.filter(
            Q(college=user.college) | Q(college__isnull=True)
        ).select_related("department", "created_by")

        if user.role == "STUDENT":
            dept = getattr(getattr(user, "student_profile", None), "department", None)
            return qs.filter(
                Q(target_audience="ENTIRE_COLLEGE")
                | Q(target_audience="STUDENTS_ONLY")
                | (Q(target_audience="DEPARTMENT") & Q(department=dept))
            )
        elif user.role in ["FACULTY", "MENTOR"]:
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            return qs.filter(
                Q(target_audience="ENTIRE_COLLEGE")
                | Q(target_audience="FACULTY_ONLY")
                | (Q(target_audience="DEPARTMENT") & Q(department=dept))
            )
        elif user.role == "HOD":
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            return qs.filter(
                Q(target_audience="ENTIRE_COLLEGE")
                | (Q(department=dept) if dept else Q())
                | Q(created_by=user)
            )
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        category = serializer.validated_data.get("category", "ACADEMIC")
        if user.role == "ACCOUNTANT" and category != "FEES":
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"category": "Accountants are only authorized to publish Fee announcements."})

        extra_kwargs = {}
        if user.role == "HOD":
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            if dept:
                extra_kwargs["department"] = dept

        college = getattr(self.request, "college", None) or user.college

        serializer.save(
            college=college,
            created_by=user,
            **extra_kwargs
        )


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get_queryset(self):
        return Notification.objects.filter(
            college=self.request.user.college,
            recipient=self.request.user,
        )

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read"})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)




class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["document_type", "status", "student"]
    search_fields = ["title", "student__roll_number"]

    def get_queryset(self):
        user = self.request.user
        qs = Document.objects.filter(college=user.college).select_related(
            "student", "student__user", "uploaded_by"
        )
        if user.role == "STUDENT":
            if hasattr(user, "student_profile"):
                return qs.filter(Q(student=user.student_profile) | Q(student__isnull=True))
            return qs.filter(student__isnull=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            college=self.request.user.college,
            uploaded_by=self.request.user,
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsTenantMember])
def contact_directory(request):
    """Provides authorized contact information for HODs, Faculty, Mentors, and Departments."""
    user = request.user
    faculty_members = Faculty.objects.filter(
        college=user.college, status="ACTIVE"
    ).select_related("user", "department")

    contacts = []
    for f in faculty_members:
        contacts.append({
            "name": f.user.get_full_name(),
            "role": "HOD" if hasattr(f, "headed_department") else ("MENTOR" if f.mentored_students.exists() else "FACULTY"),
            "designation": f.designation,
            "department": f.department.name if f.department else "General",
            "email": f.user.email,
            "phone": f.user.phone or "+91 80 2345 6789",
            "office": f"Block B, Room {100 + (hash(f.faculty_number) % 40)}",
            "office_hours": "Mon-Fri 02:00 PM - 04:00 PM",
        })

    # Add general administration desk
    contacts.append({
        "name": "Registrar & Student Affairs",
        "role": "ADMINISTRATION",
        "designation": "Administrative Office",
        "department": "Campus Administration",
        "email": "helpdesk@apex.edu",
        "phone": "+91 80 4000 1122",
        "office": "Main Administrative Building, Ground Floor",
        "office_hours": "Mon-Sat 09:00 AM - 05:00 PM",
    })

    return Response(contacts)
