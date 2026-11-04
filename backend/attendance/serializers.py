from rest_framework import serializers
from attendance.models import AttendanceSession, StudentAttendance, FacultyAttendance
from students.models import Student


class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)
    student_roll = serializers.CharField(source="student.roll_number", read_only=True)
    subject_code = serializers.CharField(source="session.subject.code", read_only=True)
    subject_name = serializers.CharField(source="session.subject.name", read_only=True)
    session_date = serializers.DateField(source="session.date", read_only=True)

    class Meta:
        model = StudentAttendance
        fields = [
            "id",
            "session",
            "student",
            "student_name",
            "student_roll",
            "subject_code",
            "subject_name",
            "session_date",
            "status",
            "marked_at",
            "marked_by",
            "remarks",
        ]
        read_only_fields = ["marked_at", "marked_by"]


class AttendanceSessionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True)
    faculty_name = serializers.CharField(source="faculty.user.get_full_name", read_only=True)
    total_students = serializers.IntegerField(read_only=True)
    present_count = serializers.IntegerField(read_only=True)
    absent_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "subject",
            "subject_name",
            "subject_code",
            "semester",
            "semester_name",
            "faculty",
            "faculty_name",
            "date",
            "start_time",
            "end_time",
            "session_type",
            "topic_covered",
            "total_students",
            "present_count",
            "absent_count",
            "created_at",
        ]
        read_only_fields = ["id", "faculty", "created_at"]


class AttendanceSessionDetailSerializer(AttendanceSessionSerializer):
    student_attendances = StudentAttendanceSerializer(many=True, read_only=True)

    class Meta(AttendanceSessionSerializer.Meta):
        fields = AttendanceSessionSerializer.Meta.fields + ["student_attendances"]


class BulkMarkAttendanceItemSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    status = serializers.ChoiceField(
        choices=StudentAttendance.AttendanceStatus.choices,
        default=StudentAttendance.AttendanceStatus.PRESENT,
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class BulkMarkAttendanceSerializer(serializers.Serializer):
    attendances = BulkMarkAttendanceItemSerializer(many=True)


class FacultyAttendanceSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source="faculty.user.get_full_name", read_only=True)
    faculty_number = serializers.CharField(source="faculty.faculty_number", read_only=True)
    department_name = serializers.CharField(source="faculty.department.name", read_only=True)
    working_hours = serializers.SerializerMethodField()

    class Meta:
        model = FacultyAttendance
        fields = [
            "id",
            "faculty",
            "faculty_name",
            "faculty_number",
            "department_name",
            "date",
            "check_in",
            "check_out",
            "working_minutes",
            "working_hours",
            "status",
            "punch_source",
            "remarks",
        ]
        read_only_fields = ["working_minutes", "working_hours"]

    def get_working_hours(self, obj):
        hours = obj.working_minutes // 60
        mins = obj.working_minutes % 60
        return f"{hours}h {mins}m"


class FacultyPunchSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
    punch_source = serializers.ChoiceField(
        choices=FacultyAttendance.PunchSource.choices,
        default=FacultyAttendance.PunchSource.WEB_PORTAL,
    )
