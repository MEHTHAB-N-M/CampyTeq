from rest_framework import serializers
from .models import Assignment, AssignmentSubmission

class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.get_full_name', read_only=True)
    student_roll = serializers.CharField(source='student.roll_number', read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)
    maximum_marks = serializers.DecimalField(source='assignment.maximum_marks', max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id',
            'assignment',
            'assignment_title',
            'student',
            'student_name',
            'student_roll',
            'submitted_at',
            'file_url',
            'submission_text',
            'status',
            'marks_awarded',
            'maximum_marks',
            'feedback',
            'graded_by',
            'graded_at',
        ]
        read_only_fields = ['id', 'student', 'submitted_at']


class AssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True)
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    total_submissions = serializers.SerializerMethodField()
    my_submission = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id',
            'faculty',
            'faculty_name',
            'subject',
            'subject_name',
            'subject_code',
            'batch',
            'batch_name',
            'title',
            'description',
            'attachment_url',
            'maximum_marks',
            'due_date',
            'status',
            'total_submissions',
            'my_submission',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'faculty', 'created_at', 'updated_at']

    def get_total_submissions(self, obj):
        return obj.submissions.count()

    def get_my_submission(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'STUDENT':
            student = getattr(request.user, 'student_profile', None)
            if student:
                sub = obj.submissions.filter(student=student).first()
                if sub:
                    return AssignmentSubmissionSerializer(sub).data
        return None
