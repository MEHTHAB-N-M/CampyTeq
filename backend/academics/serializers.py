from rest_framework import serializers
from .models import Course, Batch, Semester, Subject, FacultySubject, TimetableEntry, SubjectAssignment, ClassSection

class SemesterSerializer(serializers.ModelSerializer):
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    course_name = serializers.CharField(source='batch.course.name', read_only=True)

    class Meta:
        model = Semester
        fields = [
            'id',
            'batch',
            'batch_name',
            'course_name',
            'semester_number',
            'name',
            'start_date',
            'end_date',
            'is_current',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BatchSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    semesters = SemesterSerializer(many=True, read_only=True)
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id',
            'course',
            'course_name',
            'course_code',
            'name',
            'academic_year',
            'start_date',
            'end_date',
            'status',
            'semesters',
            'total_students',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_students(self, obj):
        return obj.students.filter(is_deleted=False).count()


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    batches = BatchSerializer(many=True, read_only=True)
    total_students = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id',
            'department',
            'department_name',
            'name',
            'code',
            'degree_level',
            'duration_years',
            'total_semesters',
            'status',
            'description',
            'batches',
            'total_students',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_students(self, obj):
        return obj.students.filter(is_deleted=False).count()


class SubjectSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)

    class Meta:
        model = Subject
        fields = [
            'id',
            'course',
            'course_code',
            'department',
            'department_code',
            'name',
            'code',
            'subject_type',
            'credits',
            'semester_number',
            'syllabus',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class FacultySubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True)
    batch_name = serializers.CharField(source='batch.name', read_only=True)

    class Meta:
        model = FacultySubject
        fields = [
            'id',
            'subject',
            'subject_name',
            'subject_code',
            'faculty',
            'faculty_name',
            'batch',
            'batch_name',
            'academic_year',
            'is_primary',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class TimetableEntrySerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True)
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    batch_name = serializers.CharField(source='batch.name', read_only=True)

    class Meta:
        model = TimetableEntry
        fields = [
            'id',
            'course',
            'course_code',
            'batch',
            'batch_name',
            'semester',
            'subject',
            'subject_name',
            'subject_code',
            'faculty',
            'faculty_name',
            'day_of_week',
            'day_name',
            'start_time',
            'end_time',
            'room',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SubjectAssignmentSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    class_section_name = serializers.CharField(source='class_section.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    is_currently_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = SubjectAssignment
        fields = [
            'id',
            'department',
            'department_name',
            'faculty',
            'faculty_name',
            'subject',
            'subject_name',
            'subject_code',
            'class_section',
            'class_section_name',
            'academic_year',
            'is_active',
            'end_date',
            'is_currently_valid',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'is_currently_valid', 'created_at', 'updated_at']

