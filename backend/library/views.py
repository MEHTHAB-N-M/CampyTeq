from datetime import date, datetime
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, permissions, status, views
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog
from faculty.models import Faculty
from .models import LibraryBooking
from .serializers import (
    LibraryBookingSerializer,
    LibraryBookingCreateSerializer,
    LibraryAvailabilitySerializer
)

class LibraryBookingViewSet(viewsets.ModelViewSet):
    """
    Library space booking workflow (Section 8 of Specification):
    - Requesters: FACULTY, LAB_FACULTY, HOD (in Faculty mode).
    - Only LIBRARY_FACULTY approves or rejects.
    - Students and parents have zero library access.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    serializer_class = LibraryBookingSerializer

    def get_queryset(self):
        user = self.request.user
        acting_role = get_acting_role(self.request)

        # Students and parents have no access
        if acting_role in ['STUDENT', 'PARENT'] or user.role in ['STUDENT', 'PARENT']:
            return LibraryBooking.objects.none()

        qs = LibraryBooking.objects.filter(college=user.college).select_related('requested_by__user', 'decided_by')

        if acting_role == 'LIBRARY_FACULTY':
            return qs

        faculty_profile = getattr(user, 'faculty_profile', None)
        if faculty_profile:
            return qs.filter(requested_by=faculty_profile)

        if acting_role in ['SUPER_ADMIN', 'PRINCIPAL']:
            return qs

        return LibraryBooking.objects.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        acting_role = get_acting_role(request)

        # Allowed requesters: FACULTY, LAB_FACULTY, HOD (in Faculty mode), CLASS_INCHARGE, MENTOR
        allowed_requesters = ['FACULTY', 'LAB_FACULTY', 'HOD', 'CLASS_INCHARGE', 'MENTOR']
        if acting_role not in allowed_requesters and user.role not in allowed_requesters:
            return Response(
                {'detail': 'Only faculty instructors, lab faculty, and HODs can request library bookings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        faculty_profile = getattr(user, 'faculty_profile', None)
        if not faculty_profile:
            return Response(
                {'detail': 'An active faculty profile is required to request a library booking.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = LibraryBookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = LibraryBooking.objects.create(
            college=user.college,
            requested_by=faculty_profile,
            date=serializer.validated_data['date'],
            start_time=serializer.validated_data['start_time'],
            end_time=serializer.validated_data['end_time'],
            purpose=serializer.validated_data['purpose'],
            status=LibraryBooking.BookingStatus.PENDING
        )

        # Audit log creation
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        valid_ip = ip if ('.' in ip and ':' not in ip) else None

        AuditLog.objects.create(
            user=user,
            college=user.college,
            acting_role=acting_role,
            action='LIBRARY_BOOKING_REQUEST',
            resource_type='LibraryBooking',
            resource_id=str(booking.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={},
            new_values={'date': str(booking.date), 'start': str(booking.start_time), 'end': str(booking.end_time)}
        )

        return Response(LibraryBookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Returns all library bookings submitted by the authenticated requester."""
        user = request.user
        faculty_profile = getattr(user, 'faculty_profile', None)
        if not faculty_profile:
            return Response([])

        qs = LibraryBooking.objects.filter(college=user.college, requested_by=faculty_profile).order_by('-date', '-start_time')
        return Response(LibraryBookingSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        GET /api/v1/library/bookings/pending/ (and /api/v1/library/pending/)
        Only accessible by LIBRARY_FACULTY.
        """
        user = request.user
        acting_role = get_acting_role(request)

        if acting_role != 'LIBRARY_FACULTY' and acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            return Response(
                {'detail': 'Only Library Faculty can view the pending approval queue.'},
                status=status.HTTP_403_FORBIDDEN
            )

        qs = LibraryBooking.objects.filter(
            college=user.college,
            status=LibraryBooking.BookingStatus.PENDING
        ).select_related('requested_by__user').order_by('date', 'start_time')

        return Response(LibraryBookingSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        POST /api/v1/library/bookings/{id}/approve/
        Only LIBRARY_FACULTY approves. Prevents overlapping approved bookings.
        """
        user = request.user
        acting_role = get_acting_role(request)

        if acting_role != 'LIBRARY_FACULTY' and acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            return Response(
                {'detail': 'Only Library Faculty can approve library bookings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            booking = LibraryBooking.objects.select_for_update().filter(id=pk, college=user.college).first()
            if not booking:
                return Response({'detail': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

            if booking.status == LibraryBooking.BookingStatus.APPROVED:
                return Response({'detail': 'Booking is already approved.'}, status=status.HTTP_400_BAD_REQUEST)

            # Overlap check against existing APPROVED bookings
            overlap = LibraryBooking.objects.select_for_update().filter(
                college=user.college,
                date=booking.date,
                status=LibraryBooking.BookingStatus.APPROVED,
                start_time__lt=booking.end_time,
                end_time__gt=booking.start_time
            ).exclude(pk=booking.pk).exists()

            if overlap:
                return Response(
                    {'detail': 'Conflict: This slot overlaps with an already approved booking.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            booking.status = LibraryBooking.BookingStatus.APPROVED
            booking.decided_by = user
            booking.decided_at = timezone.now()
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
                action='LIBRARY_BOOKING_APPROVE',
                resource_type='LibraryBooking',
                resource_id=str(booking.id),
                ip_address=valid_ip,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
                old_values={'status': 'PENDING'},
                new_values={'status': 'APPROVED'}
            )

        return Response(LibraryBookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        POST /api/v1/library/bookings/{id}/reject/
        Rejection requires a reason.
        """
        user = request.user
        acting_role = get_acting_role(request)

        if acting_role != 'LIBRARY_FACULTY' and acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            return Response(
                {'detail': 'Only Library Faculty can reject library bookings.'},
                status=status.HTTP_403_FORBIDDEN
            )

        reason = request.data.get('reject_reason') or request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'A rejection reason is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking = LibraryBooking.objects.filter(id=pk, college=user.college).first()
        if not booking:
            return Response({'detail': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        booking.status = LibraryBooking.BookingStatus.REJECTED
        booking.decided_by = user
        booking.decided_at = timezone.now()
        booking.reject_reason = reason
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
            action='LIBRARY_BOOKING_REJECT',
            resource_type='LibraryBooking',
            resource_id=str(booking.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={'status': 'PENDING'},
            new_values={'status': 'REJECTED', 'reject_reason': reason}
        )

        return Response(LibraryBookingSerializer(booking).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        POST /api/v1/library/bookings/{id}/cancel/
        Requester cancels own booking before the slot.
        """
        user = request.user
        acting_role = get_acting_role(request)
        faculty_profile = getattr(user, 'faculty_profile', None)

        booking = LibraryBooking.objects.filter(id=pk, college=user.college).first()
        if not booking:
            return Response({'detail': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if acting_role not in ['SUPER_ADMIN', 'PRINCIPAL']:
            if not faculty_profile or booking.requested_by_id != faculty_profile.id:
                return Response({'detail': 'You can only cancel your own bookings.'}, status=status.HTTP_403_FORBIDDEN)

        booking.status = LibraryBooking.BookingStatus.CANCELLED
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
            action='LIBRARY_BOOKING_CANCEL',
            resource_type='LibraryBooking',
            resource_id=str(booking.id),
            ip_address=valid_ip,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            old_values={'status': 'PENDING'},
            new_values={'status': 'CANCELLED'}
        )

        return Response({'message': 'Booking cancelled successfully.'})


class LibraryAvailabilityView(views.APIView):
    """
    GET /api/v1/library/availability/?date=YYYY-MM-DD
    Availability (Free / Pending / Booked, date and time only) visible to
    LIBRARY_FACULTY, HOD, FACULTY, LAB_FACULTY.
    Never returns requester or purpose to anyone except LIBRARY_FACULTY and the requester's own bookings.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]

    def get(self, request):
        user = request.user
        acting_role = get_acting_role(request)

        # Students and parents are blocked
        if acting_role in ['STUDENT', 'PARENT'] or user.role in ['STUDENT', 'PARENT']:
            return Response({'detail': 'Students and parents have no library access.'}, status=status.HTTP_403_FORBIDDEN)

        date_str = request.query_params.get('date')
        if not date_str:
            target_date = date.today()
        else:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'Invalid date format (use YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)

        bookings = LibraryBooking.objects.filter(
            college=user.college,
            date=target_date
        ).exclude(status__in=[LibraryBooking.BookingStatus.CANCELLED, LibraryBooking.BookingStatus.REJECTED]).select_related('requested_by__user')

        faculty_profile = getattr(user, 'faculty_profile', None)
        is_lib_faculty = (acting_role == 'LIBRARY_FACULTY') or (acting_role in ['SUPER_ADMIN', 'PRINCIPAL'])

        slots = []
        for b in bookings:
            is_own = bool(faculty_profile and b.requested_by_id == faculty_profile.id)
            slot_status = "Booked" if b.status == LibraryBooking.BookingStatus.APPROVED else "Pending"

            item = {
                'id': str(b.id),
                'date': b.date.isoformat(),
                'start_time': b.start_time.strftime('%H:%M'),
                'end_time': b.end_time.strftime('%H:%M'),
                'status': slot_status,
            }

            # Spec: Never return requester or purpose to anyone except LIBRARY_FACULTY and the requester's own bookings
            if is_lib_faculty or is_own:
                item['purpose'] = b.purpose
                item['requested_by_name'] = b.requested_by.user.get_full_name()

            slots.append(item)

        return Response({
            'date': target_date.isoformat(),
            'slots': slots
        })
