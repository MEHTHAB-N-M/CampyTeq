from datetime import date, datetime
from django.db import transaction
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, permissions, status, views
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog, User
from communication.models import Notification
from facilities.models import Facility, FacilityBooking
from facilities.serializers import (
    FacilitySerializer,
    FacilityBookingSerializer,
    FacilityBookingCreateSerializer,
    FacilityBookingReviewSerializer,
)

class FacilityViewSet(viewsets.ModelViewSet):
    """
    Campus facilities registry (Gym, Sports Turf, Seminar Hall, Auditorium, Project Rooms).
    """
    serializer_class = FacilitySerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["facility_type", "is_active"]
    search_fields = ["name", "location", "amenities"]

    def get_queryset(self):
        user = self.request.user
        qs = Facility.objects.filter(college=user.college, is_active=True)
        acting_role = get_acting_role(self.request)
        if (acting_role == "PRINCIPAL" or user.role == "PRINCIPAL") and not user.college_id:
            return Facility.objects.all()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        if acting_role not in ["PRINCIPAL", "SUPER_ADMIN", "HOD"] and user.role not in ["PRINCIPAL", "SUPER_ADMIN", "HOD"]:
            raise permissions.exceptions.PermissionDenied("Only Administrators or HODs can configure facilities.")
        serializer.save(college=user.college)


class FacilityBookingViewSet(viewsets.ModelViewSet):
    """
    Facility reservation management (Section 9 of Specification):
    - Requesters: FACULTY, LAB_FACULTY, HOD (in Faculty mode), CLASS_INCHARGE, MENTOR.
    - Approvals:
      * Standard request: HOD of booking.department (with active role HOD).
      * HOD's own request: decided by PRINCIPAL.
      * Nobody approves their own request.
      * HOD of another department cannot decide.
    - Overlapping APPROVED bookings prevented via transaction + select_for_update.
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
        acting_role = get_acting_role(self.request)

        qs = FacilityBooking.objects.filter(college=user.college).select_related(
            "facility", "requested_by", "department", "reviewed_by"
        )

        # Principal gets read-only report view of all bookings
        if acting_role in ["SUPER_ADMIN", "PRINCIPAL"] or user.role in ["SUPER_ADMIN", "PRINCIPAL"]:
            return qs

        if acting_role == "HOD":
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            if dept:
                return qs.filter(Q(department=dept) | Q(requested_by=user))
            return qs.filter(requested_by=user)

        # Faculty / Mentor / Lab Faculty see own bookings
        return qs.filter(requested_by=user)

    def create(self, request, *args, **kwargs):
        user = request.user
        acting_role = get_acting_role(request)

        allowed_requesters = ["FACULTY", "LAB_FACULTY", "HOD", "CLASS_INCHARGE", "MENTOR"]
        if acting_role not in allowed_requesters and user.role not in allowed_requesters:
            return Response(
                {"detail": "Only faculty instructors, lab faculty, mentors, and HODs can request facility bookings."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = FacilityBookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        facility = serializer.validated_data["facility"]
        attendees = serializer.validated_data.get("expected_attendees", 1)
        b_date = serializer.validated_data["booking_date"]
        start = serializer.validated_data["start_time"]
        end = serializer.validated_data["end_time"]

        # Validations
        if b_date < date.today():
            return Response({"detail": "Booking date cannot be in the past."}, status=status.HTTP_400_BAD_REQUEST)
        if end <= start:
            return Response({"detail": "End time must be after start time."}, status=status.HTTP_400_BAD_REQUEST)
        if attendees > facility.capacity:
            return Response(
                {"detail": f"Expected attendees ({attendees}) exceeds facility capacity ({facility.capacity})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        dept = getattr(getattr(user, "faculty_profile", None), "department", None)

        booking = serializer.save(
            college=user.college,
            requested_by=user,
            department=dept,
            status=FacilityBooking.BookingStatus.PENDING,
        )

        # Audit log
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        valid_ip = ip if ('.' in ip and ':' not in ip) else None

        AuditLog.objects.create(
            user=user,
            college=user.college,
            acting_role=acting_role,
            action='FACILITY_BOOKING_REQUEST',
            resource_type='FacilityBooking',
            resource_id=str(booking.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={},
            new_values={'facility': facility.name, 'date': str(b_date), 'start': str(start), 'end': str(end)}
        )

        return Response(FacilityBookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Returns all bookings requested by the authenticated user."""
        user = request.user
        qs = FacilityBooking.objects.filter(college=user.college, requested_by=user).order_by("-booking_date", "-start_time")
        return Response(FacilityBookingSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        GET /api/v1/facilities/pending/ (and /bookings/pending/)
        - HOD: pending requests from their own department.
        - Principal: pending requests made by HODs.
        """
        user = request.user
        acting_role = get_acting_role(request)

        qs = FacilityBooking.objects.filter(
            college=user.college,
            status=FacilityBooking.BookingStatus.PENDING
        ).select_related("facility", "requested_by", "department")

        if acting_role in ["PRINCIPAL", "SUPER_ADMIN"] or user.role in ["PRINCIPAL", "SUPER_ADMIN"]:
            # Principal decides requests made by HODs
            hod_users = User.objects.filter(college=user.college, role="HOD")
            return Response(FacilityBookingSerializer(qs.filter(requested_by__in=hod_users), many=True).data)

        if acting_role == "HOD":
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            if dept:
                # Exclude self-requests (which go to Principal)
                return Response(FacilityBookingSerializer(qs.filter(department=dept).exclude(requested_by=user), many=True).data)
            return Response([])

        return Response(
            {"detail": "Only HODs or Principal can view the pending facility queue."},
            status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """
        POST /api/v1/facilities/bookings/{id}/approve/
        Approval rules:
        - HOD of booking.department (with active role HOD)
        - Request made by HOD is decided by PRINCIPAL
        - Nobody approves their own request
        - HOD of another department cannot decide
        - Overlap prevention: select_for_update in atomic transaction
        """
        user = request.user
        acting_role = get_acting_role(request)

        with transaction.atomic():
            booking = FacilityBooking.objects.select_for_update().filter(id=pk, college=user.college).first()
            if not booking:
                return Response({"detail": "Facility booking not found."}, status=status.HTTP_404_NOT_FOUND)

            # 1. Nobody approves their own request
            if booking.requested_by_id == user.id:
                return Response(
                    {"detail": "Conflict: Nobody is permitted to approve their own facility request. Requests must go to your supervisor."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 2. Check decider authority
            is_requester_hod = (booking.requested_by.role == "HOD")
            if is_requester_hod:
                if acting_role not in ["PRINCIPAL", "SUPER_ADMIN"]:
                    return Response(
                        {"detail": "Facility requests raised by an HOD must be decided by the Principal."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                if acting_role not in ["HOD", "PRINCIPAL", "SUPER_ADMIN"]:
                    return Response(
                        {"detail": "Only the Department HOD can approve faculty facility bookings."},
                        status=status.HTTP_403_FORBIDDEN
                    )
                if acting_role == "HOD":
                    dept = getattr(getattr(user, "faculty_profile", None), "department", None)
                    if not dept or booking.department_id != dept.id:
                        return Response(
                            {"detail": "Permission denied: The HOD of another department cannot decide this facility request."},
                            status=status.HTTP_403_FORBIDDEN
                        )

            # 3. Overlap check against APPROVED bookings
            overlap = FacilityBooking.objects.select_for_update().filter(
                college=user.college,
                facility=booking.facility,
                booking_date=booking.booking_date,
                status=FacilityBooking.BookingStatus.APPROVED,
                start_time__lt=booking.end_time,
                end_time__gt=booking.start_time
            ).exclude(pk=booking.pk).exists()

            if overlap:
                return Response(
                    {"detail": "slot already taken: Another department's booking for this facility and time has already been approved."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            booking.status = FacilityBooking.BookingStatus.APPROVED
            booking.reviewed_by = user
            booking.reviewed_at = timezone.now()
            booking.save()

            # Audit log
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ip and ',' in ip:
                ip = ip.split(',')[0].strip()
            valid_ip = ip if ('.' in ip and ':' not in ip) else None

            AuditLog.objects.create(
                user=user,
                college=user.college,
                acting_role=acting_role,
                action='FACILITY_BOOKING_APPROVE',
                resource_type='FacilityBooking',
                resource_id=str(booking.id),
                ip_address=valid_ip,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
                old_values={'status': 'PENDING'},
                new_values={'status': 'APPROVED'}
            )

        return Response(FacilityBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """
        POST /api/v1/facilities/bookings/{id}/reject/
        Rejection requires a reason.
        """
        user = request.user
        acting_role = get_acting_role(request)

        reason = request.data.get("reject_reason") or request.data.get("review_remarks") or request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "A rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking = FacilityBooking.objects.filter(id=pk, college=user.college).first()
        if not booking:
            return Response({"detail": "Facility booking not found."}, status=status.HTTP_404_NOT_FOUND)

        # Nobody decides own request
        if booking.requested_by_id == user.id:
            return Response({"detail": "Nobody is permitted to reject their own facility request."}, status=status.HTTP_403_FORBIDDEN)

        is_requester_hod = (booking.requested_by.role == "HOD")
        if is_requester_hod:
            if acting_role not in ["PRINCIPAL", "SUPER_ADMIN"]:
                return Response({"detail": "HOD facility requests must be decided by the Principal."}, status=status.HTTP_403_FORBIDDEN)
        else:
            if acting_role == "HOD":
                dept = getattr(getattr(user, "faculty_profile", None), "department", None)
                if not dept or booking.department_id != dept.id:
                    return Response({"detail": "Permission denied: The HOD of another department cannot decide this request."}, status=status.HTTP_403_FORBIDDEN)

        booking.status = FacilityBooking.BookingStatus.REJECTED
        booking.reviewed_by = user
        booking.reviewed_at = timezone.now()
        booking.review_remarks = reason
        booking.save()

        # Audit log
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        valid_ip = ip if ('.' in ip and ':' not in ip) else None

        AuditLog.objects.create(
            user=user,
            college=user.college,
            acting_role=acting_role,
            action='FACILITY_BOOKING_REJECT',
            resource_type='FacilityBooking',
            resource_id=str(booking.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={'status': 'PENDING'},
            new_values={'status': 'REJECTED', 'reject_reason': reason}
        )

        return Response(FacilityBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """
        POST /api/v1/facilities/bookings/{id}/cancel/
        Requester can cancel before the slot.
        """
        user = request.user
        acting_role = get_acting_role(request)

        booking = FacilityBooking.objects.filter(id=pk, college=user.college).first()
        if not booking:
            return Response({"detail": "Facility booking not found."}, status=status.HTTP_404_NOT_FOUND)

        if acting_role not in ["SUPER_ADMIN", "PRINCIPAL"]:
            if booking.requested_by_id != user.id:
                return Response({"detail": "You can only cancel your own bookings."}, status=status.HTTP_403_FORBIDDEN)

        booking.status = FacilityBooking.BookingStatus.CANCELLED
        booking.save()

        # Audit log
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        valid_ip = ip if ('.' in ip and ':' not in ip) else None

        AuditLog.objects.create(
            user=user,
            college=user.college,
            acting_role=acting_role,
            action='FACILITY_BOOKING_CANCEL',
            resource_type='FacilityBooking',
            resource_id=str(booking.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={'status': 'PENDING'},
            new_values={'status': 'CANCELLED'}
        )

        return Response({"message": "Booking cancelled successfully."})

    # Legacy review endpoint alias
    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        new_status = request.data.get("status")
        if new_status == "APPROVED":
            return self.approve(request, pk)
        return self.reject(request, pk)


class FacilityAvailabilityView(views.APIView):
    """
    GET /api/v1/facilities/availability/?facility=&date=
    Availability (Free / Pending / Booked, time only) is visible to HOD, FACULTY, LAB_FACULTY.
    Requester and purpose are visible only to the requester, their HOD and the Principal.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request):
        user = request.user
        acting_role = get_acting_role(request)

        # Disallow unauthorized viewers
        allowed_roles = ["HOD", "FACULTY", "LAB_FACULTY", "CLASS_INCHARGE", "MENTOR", "PRINCIPAL", "SUPER_ADMIN"]
        if acting_role not in allowed_roles and user.role not in allowed_roles:
            return Response({"detail": "You do not have permission to view facility availability."}, status=status.HTTP_403_FORBIDDEN)

        facility_id = request.query_params.get("facility")
        date_str = request.query_params.get("date")

        if not date_str:
            target_date = date.today()
        else:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        bookings_qs = FacilityBooking.objects.filter(
            college=user.college,
            booking_date=target_date
        ).exclude(status__in=[FacilityBooking.BookingStatus.CANCELLED, FacilityBooking.BookingStatus.REJECTED]).select_related("facility", "requested_by", "department")

        if facility_id:
            bookings_qs = bookings_qs.filter(facility_id=facility_id)

        user_dept = getattr(getattr(user, "faculty_profile", None), "department", None)
        is_principal = acting_role in ["PRINCIPAL", "SUPER_ADMIN"] or user.role in ["PRINCIPAL", "SUPER_ADMIN"]

        slots = []
        for b in bookings_qs:
            is_own = (b.requested_by_id == user.id)
            is_own_dept_hod = (acting_role == "HOD" and user_dept and b.department_id == user_dept.id)

            can_see_details = is_principal or is_own or is_own_dept_hod
            slot_status = "Booked" if b.status == FacilityBooking.BookingStatus.APPROVED else "Pending"

            item = {
                "id": str(b.id),
                "facility_id": str(b.facility_id),
                "facility_name": b.facility.name,
                "date": b.booking_date.isoformat(),
                "start_time": b.start_time.strftime("%H:%M"),
                "end_time": b.end_time.strftime("%H:%M"),
                "status": slot_status,
            }

            # Spec: Requester and purpose are visible ONLY to requester, their HOD and Principal
            if can_see_details:
                item["purpose"] = b.purpose
                item["requested_by_name"] = b.requested_by.get_full_name()
                item["department"] = b.department.name if b.department else ""

            slots.append(item)

        return Response({
            "date": target_date.isoformat(),
            "slots": slots
        })
