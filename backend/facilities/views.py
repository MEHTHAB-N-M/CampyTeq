from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q

from common.permissions import IsTenantMember
from facilities.models import Facility, FacilityBooking
from facilities.serializers import (
    FacilitySerializer,
    FacilityBookingSerializer,
    FacilityBookingCreateSerializer,
    FacilityBookingReviewSerializer,
)
from communication.models import Notification


class FacilityViewSet(viewsets.ModelViewSet):
    """
    Campus facilities registry (Seminar Hall, Sports Turf, Auditoriums).
    """
    serializer_class = FacilitySerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["facility_type", "is_active"]
    search_fields = ["name", "location", "amenities"]

    def get_queryset(self):
        user = self.request.user
        qs = Facility.objects.filter(college=user.college, is_active=True)
        if user.role == "PRINCIPAL" and not user.college_id:
            return Facility.objects.all()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ["PRINCIPAL", "HOD"]:
            raise permissions.exceptions.PermissionDenied("Only Administrators or HODs can configure facilities.")
        serializer.save(college=user.college)


class FacilityBookingViewSet(viewsets.ModelViewSet):
    """
    Facility reservation management:
    - Only Mentors can raise requests (Seminar Hall and Turf).
    - Routed to HOD for approval / rejection.
    - Status changes trigger notifications to the requesting Mentor.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["status", "facility", "booking_date", "department"]
    search_fields = ["purpose", "facility__name", "requested_by__first_name", "requested_by__last_name"]

    def get_serializer_class(self):
        if self.action == "create":
            return FacilityBookingCreateSerializer
        return FacilityBookingSerializer

    def get_queryset(self):
        user = self.request.user
        qs = FacilityBooking.objects.filter(college=user.college).select_related(
            "facility", "requested_by", "department", "reviewed_by"
        )

        if user.role in ["SUPER_ADMIN", "PRINCIPAL"]:
            active_college = getattr(self.request, "college", None)
            if active_college:
                return qs.filter(college=active_college)
            return qs

        if user.role == "HOD":
            # HOD sees department bookings, their own requests, and all approved bookings
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            if dept:
                return qs.filter(Q(department=dept) | Q(requested_by=user) | Q(status="APPROVED"))
            return qs

        if user.role in ["FACULTY", "MENTOR"]:
            # Faculty & Mentors see their own bookings + all approved bookings to verify availability
            return qs.filter(Q(requested_by=user) | Q(status="APPROVED"))

        # Other roles see only their own
        return qs.filter(requested_by=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ["FACULTY", "MENTOR", "HOD", "PRINCIPAL", "SUPER_ADMIN"]:
            raise permissions.exceptions.PermissionDenied(
                "Facility booking requests can be raised by Faculty, Mentors, or HODs."
            )

        dept = None
        if hasattr(user, "faculty_profile"):
            dept = user.faculty_profile.department

        booking = serializer.save(
            college=user.college,
            requested_by=user,
            department=dept,
            status="PENDING",
        )

        # Route to HOD for approval / notification
        hod_user = None
        if dept and dept.hod and dept.hod.user:
            hod_user = dept.hod.user
        else:
            from accounts.models import User as AccountUser
            hod_user = AccountUser.objects.filter(college=user.college, role="HOD").first()

        if hod_user:
            Notification.objects.create(
                college=booking.college,
                recipient=hod_user,
                title=f"Facility Booking Request: {booking.facility.name}",
                message=f"Mentor {user.get_full_name()} requested {booking.facility.name} on {booking.booking_date} ({booking.start_time.strftime('%H:%M')} - {booking.end_time.strftime('%H:%M')}). Purpose: {booking.purpose}",
                notification_type="FACILITY_STATUS",
                action_url="/dashboard/facilities",
            )

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        user = request.user
        if user.role not in ["HOD", "PRINCIPAL"]:
            return Response({
                "success": False,
                "message": "Only HODs or Principal can approve or reject facility bookings.",
                "code": "PERMISSION_DENIED"
            }, status=status.HTTP_403_FORBIDDEN)

        booking = self.get_object()
        serializer = FacilityBookingReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        remarks = serializer.validated_data.get("review_remarks", "")

        booking.status = new_status
        booking.review_remarks = remarks
        booking.reviewed_by = user
        booking.reviewed_at = timezone.now()
        booking.save()

        # Trigger notification to requesting Mentor
        status_text = "APPROVED" if new_status == "APPROVED" else "REJECTED"
        Notification.objects.create(
            college=booking.college,
            recipient=booking.requested_by,
            title=f"Facility Booking {status_text}: {booking.facility.name}",
            message=f"Your request for {booking.facility.name} on {booking.booking_date} was {status_text.lower()} by {user.get_full_name()}. {f'Remarks: {remarks}' if remarks else ''}".strip(),
            notification_type="FACILITY_STATUS",
            action_url="/dashboard/facilities",
        )

        return Response(FacilityBookingSerializer(booking).data)
