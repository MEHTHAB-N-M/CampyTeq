from datetime import date
from rest_framework import serializers
from .models import LibraryBooking

class LibraryBookingSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.user.get_full_name', read_only=True)
    decided_by_name = serializers.CharField(source='decided_by.get_full_name', read_only=True, default='')

    class Meta:
        model = LibraryBooking
        fields = [
            'id',
            'date',
            'start_time',
            'end_time',
            'purpose',
            'status',
            'requested_by',
            'requested_by_name',
            'decided_by',
            'decided_by_name',
            'decided_at',
            'reject_reason',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'status', 'decided_by', 'decided_at', 'created_at', 'updated_at']


class LibraryBookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibraryBooking
        fields = ['date', 'start_time', 'end_time', 'purpose']

    def validate(self, attrs):
        booking_date = attrs.get('date')
        start = attrs.get('start_time')
        end = attrs.get('end_time')

        if booking_date and booking_date < date.today():
            raise serializers.ValidationError({'date': 'Booking date cannot be in the past.'})

        if start and end and end <= start:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})

        return attrs


class LibraryAvailabilitySerializer(serializers.Serializer):
    """Sanitized slot representation that never leaks requester or purpose to unauthorized viewers."""
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    status = serializers.CharField()  # FREE, PENDING, BOOKED
    purpose = serializers.CharField(required=False, default='')
    requested_by_name = serializers.CharField(required=False, default='')
