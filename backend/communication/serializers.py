from rest_framework import serializers
from communication.models import Announcement, Notification, Document
from accounts.models import User


class AnnouncementSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "content",
            "category",
            "priority",
            "target_audience",
            "department",
            "department_name",
            "created_by",
            "created_by_name",
            "is_pinned",
            "published_at",
            "expires_at",
            "attachment_url",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "recipient",
            "title",
            "message",
            "notification_type",
            "action_url",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["recipient", "created_at"]





class DocumentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_roll = serializers.CharField(source="student.roll_number", read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "document_type",
            "student",
            "student_name",
            "student_roll",
            "uploaded_by",
            "uploaded_by_name",
            "file_url",
            "status",
            "issued_date",
            "created_at",
        ]
        read_only_fields = ["uploaded_by", "created_at"]
