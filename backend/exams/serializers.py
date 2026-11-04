from rest_framework import serializers
from .models import Exam, ExamSubject, Result

class ExamSubjectSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)

    class Meta:
        model = ExamSubject
        fields = [
            'id',
            'exam',
            'exam_name',
            'subject',
            'subject_name',
            'subject_code',
            'exam_date',
            'start_time',
            'end_time',
            'maximum_marks',
            'passing_marks',
            'room',
        ]


class ExamSerializer(serializers.ModelSerializer):
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    exam_subjects = ExamSubjectSerializer(many=True, read_only=True)
    total_subjects = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            'id',
            'name',
            'exam_type',
            'batch',
            'batch_name',
            'semester',
            'semester_name',
            'start_date',
            'end_date',
            'is_published',
            'status',
            'description',
            'exam_subjects',
            'total_subjects',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_subjects(self, obj):
        return obj.exam_subjects.count()


class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_roll = serializers.CharField(source='student.roll_number', read_only=True)
    subject_name = serializers.CharField(source='exam_subject.subject.name', read_only=True)
    subject_code = serializers.CharField(source='exam_subject.subject.code', read_only=True)
    maximum_marks = serializers.DecimalField(source='exam_subject.maximum_marks', max_digits=5, decimal_places=2, read_only=True)
    passing_marks = serializers.DecimalField(source='exam_subject.passing_marks', max_digits=5, decimal_places=2, read_only=True)
    exam_name = serializers.CharField(source='exam_subject.exam.name', read_only=True)
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = [
            'id',
            'exam_subject',
            'exam_name',
            'subject_name',
            'subject_code',
            'student',
            'student_name',
            'student_roll',
            'marks_obtained',
            'maximum_marks',
            'passing_marks',
            'percentage',
            'grade',
            'is_absent',
            'remarks',
            'created_at',
        ]
        read_only_fields = ['id', 'percentage', 'created_at']

    def get_percentage(self, obj):
        if obj.is_absent or not obj.exam_subject.maximum_marks:
            return 0.0
        return round((float(obj.marks_obtained) / float(obj.exam_subject.maximum_marks)) * 100, 1)
