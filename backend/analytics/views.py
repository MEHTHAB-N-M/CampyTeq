from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from decimal import Decimal
from datetime import date, timedelta
import uuid

from common.permissions import IsTenantMember
from students.models import Student, MentorAssignment
from faculty.models import Faculty
from departments.models import Department
from attendance.models import StudentAttendance, AttendanceSession
from fees.models import StudentInvoice, Payment
from exams.models import Exam, ExamSubject, Result
from .models import StudentAIAnalysis
from .services import AcademicRiskEngine
from .serializers import (
    StudentAIAnalysisSerializer,
    ReviewRiskAnalysisSerializer,
    EvaluateStudentSerializer,
)


class IsAnalyticsViewer(permissions.BasePermission):
    """Allows analytics view to institutional leaders, mentors, and accountants."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [
            'PRINCIPAL', 'MANAGEMENT', 'HOD',
            'MENTOR', 'ACCOUNTANT', 'FACULTY', 'STUDENT', 'PARENT'
        ]


class InstitutionalOverviewView(APIView):
    """Executive KPI overview across academics, attendance, finance, and risks."""
    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user
        college = user.college

        # Scoped querysets
        student_qs = Student.objects.filter(is_deleted=False)
        faculty_qs = Faculty.objects.filter(is_deleted=False)
        dept_qs = Department.objects.filter(status='ACTIVE')
        invoice_qs = StudentInvoice.objects.all()
        payment_qs = Payment.objects.filter(status='SUCCESS')
        risk_qs = StudentAIAnalysis.objects.filter(is_latest=True)

        if college:
            student_qs = student_qs.filter(college=college)
            faculty_qs = faculty_qs.filter(college=college)
            dept_qs = dept_qs.filter(college=college)
            invoice_qs = invoice_qs.filter(college=college)
            payment_qs = payment_qs.filter(college=college)
            risk_qs = risk_qs.filter(college=college)

        total_students = student_qs.count()
        total_faculty = faculty_qs.count()
        total_depts = dept_qs.count()

        # Attendance calculation
        att_qs = StudentAttendance.objects.all()
        if college:
            att_qs = att_qs.filter(college=college)
        total_att = att_qs.count()
        present_att = att_qs.filter(status__in=['PRESENT', 'LATE']).count()
        overall_attendance_pct = round((present_att / total_att * 100), 1) if total_att > 0 else 85.0

        # Financial totals
        total_invoiced = invoice_qs.aggregate(t=Sum('final_amount'))['t'] or Decimal("0.00")
        total_collected = payment_qs.aggregate(t=Sum('amount'))['t'] or Decimal("0.00")
        total_pending = max(Decimal("0.00"), total_invoiced - total_collected)
        collection_pct = round(float(total_collected / total_invoiced * 100), 1) if total_invoiced > 0 else 0.0

        # At-Risk Student Counts
        critical_risk_count = risk_qs.filter(risk_level='CRITICAL').count()
        high_risk_count = risk_qs.filter(risk_level='HIGH').count()
        medium_risk_count = risk_qs.filter(risk_level='MEDIUM').count()
        low_risk_count = risk_qs.filter(risk_level='LOW').count()
        total_at_risk = critical_risk_count + high_risk_count

        return Response({
            'success': True,
            'data': {
                'total_students': total_students,
                'total_faculty': total_faculty,
                'total_departments': total_depts,
                'overall_attendance_percentage': overall_attendance_pct,
                'financials': {
                    'total_invoiced': str(total_invoiced),
                    'total_collected': str(total_collected),
                    'total_pending': str(total_pending),
                    'collection_percentage': collection_pct,
                },
                'early_warning_summary': {
                    'total_evaluated': risk_qs.count(),
                    'critical_risk': critical_risk_count,
                    'high_risk': high_risk_count,
                    'medium_risk': medium_risk_count,
                    'low_risk': low_risk_count,
                    'action_required_count': total_at_risk,
                }
            }
        })


class AttendanceReportView(APIView):
    """Institutional attendance aggregation and defaulter roster."""
    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user
        college = user.college

        student_qs = Student.objects.filter(is_deleted=False).select_related('user', 'department', 'batch')
        if college:
            student_qs = student_qs.filter(college=college)

        # Calculate attendance per department
        dept_breakdown = []
        departments = Department.objects.filter(status='ACTIVE')
        if college:
            departments = departments.filter(college=college)

        for d in departments:
            d_students = student_qs.filter(department=d)
            d_att = StudentAttendance.objects.filter(student__in=d_students)
            total = d_att.count()
            present = d_att.filter(status__in=['PRESENT', 'LATE']).count()
            rate = round((present / total * 100), 1) if total > 0 else 85.0
            dept_breakdown.append({
                'department_id': str(d.id),
                'name': d.name,
                'code': d.code,
                'student_count': d_students.count(),
                'attendance_rate': rate
            })

        # Overall distribution (Present, Absent, Late, Excused)
        all_att = StudentAttendance.objects.all()
        if college:
            all_att = all_att.filter(college=college)

        status_counts = all_att.values('status').annotate(count=Count('id'))
        status_dict = {item['status']: item['count'] for item in status_counts}

        # Daily trends for the past 7 days
        today = timezone.now().date()
        daily_trends = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_records = all_att.filter(session__date=day)
            day_total = day_records.count()
            day_present = day_records.filter(status__in=['PRESENT', 'LATE']).count()
            daily_trends.append({
                'date': day.strftime('%Y-%m-%d'),
                'day': day.strftime('%a'),
                'rate': round((day_present / day_total * 100), 1) if day_total > 0 else 90.0,
                'total_marked': day_total
            })

        return Response({
            'success': True,
            'data': {
                'department_breakdown': dept_breakdown,
                'status_distribution': {
                    'present': status_dict.get('PRESENT', 0),
                    'absent': status_dict.get('ABSENT', 0),
                    'late': status_dict.get('LATE', 0),
                    'excused': status_dict.get('EXCUSED', 0),
                },
                'daily_trends': daily_trends,
            }
        })


class FinancialAnalyticsView(APIView):
    """Fee collection velocities, overdue tracking, and breakdown by payment channels."""
    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user
        college = user.college

        invoice_qs = StudentInvoice.objects.all()
        payment_qs = Payment.objects.filter(status='SUCCESS').select_related('invoice')
        if college:
            invoice_qs = invoice_qs.filter(college=college)
            payment_qs = payment_qs.filter(college=college)

        total_billed = invoice_qs.aggregate(t=Sum('final_amount'))['t'] or Decimal("0.00")
        total_received = payment_qs.aggregate(t=Sum('amount'))['t'] or Decimal("0.00")

        # Payment methods breakdown
        methods = payment_qs.values('payment_method').annotate(
            total_amount=Sum('amount'),
            txn_count=Count('id')
        ).order_by('-total_amount')

        method_data = [
            {
                'method': m['payment_method'],
                'amount': str(m['total_amount']),
                'count': m['txn_count']
            }
            for m in methods
        ]

        # Status breakdown
        invoices_paid = invoice_qs.filter(status='PAID').count()
        invoices_partially_paid = invoice_qs.filter(status='PARTIALLY_PAID').count()
        invoices_pending = invoice_qs.filter(status='PENDING').count()

        return Response({
            'success': True,
            'data': {
                'total_billed': str(total_billed),
                'total_collected': str(total_received),
                'total_outstanding': str(max(Decimal("0.00"), total_billed - total_received)),
                'payment_methods': method_data,
                'invoice_counts': {
                    'paid': invoices_paid,
                    'partially_paid': invoices_partially_paid,
                    'pending': invoices_pending,
                }
            }
        })


FinanceReportView = FinancialAnalyticsView


class AcademicReportView(APIView):
    """Examinations and grading distributions."""
    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user
        college = user.college

        res_qs = Result.objects.filter(is_published=True).select_related('exam_subject', 'exam_subject__subject')
        if college:
            res_qs = res_qs.filter(college=college)

        total_results = res_qs.count()
        passed_results = res_qs.filter(is_passed=True).count()
        overall_pass_pct = round((passed_results / total_results * 100), 1) if total_results > 0 else 100.0

        # Grade distribution
        grades = res_qs.values('grade').annotate(count=Count('id')).order_by('-count')
        grade_dist = {g['grade']: g['count'] for g in grades if g['grade']}

        return Response({
            'success': True,
            'data': {
                'total_results_evaluated': total_results,
                'overall_pass_percentage': overall_pass_pct,
                'grade_distribution': grade_dist,
            }
        })


class StudentAIAnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    """
    AI Academic Early-Warning Risk Assessment ViewSet.
    Non-punitive decision-support tool for mentors and institutional leadership.
    """
    serializer_class = StudentAIAnalysisSerializer
    permission_classes = [IsTenantMember, IsAnalyticsViewer]
    filterset_fields = ['risk_level', 'analysis_type', 'is_latest']
    search_fields = ['student__student_number', 'student__roll_number', 'student__user__first_name', 'student__user__last_name']
    ordering_fields = ['score', 'attendance_rate', 'generated_at']

    def get_queryset(self):
        user = self.request.user
        qs = StudentAIAnalysis.objects.filter(is_latest=True).select_related(
            'student', 'student__user', 'student__department', 'student__batch',
            'student__current_semester', 'reviewed_by'
        )

        if user.role == 'PRINCIPAL' and not user.college:
            pass
        elif user.role in ['PRINCIPAL', 'MANAGEMENT', 'HOD']:
            qs = qs.filter(college=user.college)
            if user.role == 'HOD':
                # Optional: focus on HOD's department
                faculty_profile = getattr(user, 'faculty_profile', None)
                if faculty_profile and faculty_profile.department:
                    qs = qs.filter(student__department=faculty_profile.department)
        elif user.role in ['MENTOR', 'FACULTY']:
            # Scoped strictly to Mentor's assigned cohort or Faculty's department
            assigned_ids = MentorAssignment.objects.filter(
                mentor__user=user,
                is_active=True
            ).values_list('student_id', flat=True)
            if assigned_ids.exists():
                qs = qs.filter(student_id__in=assigned_ids)
            else:
                faculty_profile = getattr(user, 'faculty_profile', None)
                if faculty_profile and faculty_profile.department:
                    qs = qs.filter(student__department=faculty_profile.department)
        elif user.role == 'STUDENT':
            # Confidential self-view
            qs = qs.filter(student__user=user)
        elif user.role == 'PARENT':
            # Linked wards
            from students.models import StudentGuardian
            ward_ids = StudentGuardian.objects.filter(
                guardian__user=user
            ).values_list('student_id', flat=True)
            qs = qs.filter(student_id__in=ward_ids)
        else:
            qs = StudentAIAnalysis.objects.none()

        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            qs = qs.filter(risk_level=risk_level)

        dept_id = self.request.query_params.get('department')
        if dept_id:
            qs = qs.filter(student__department_id=dept_id)

        reviewed = self.request.query_params.get('reviewed')
        if reviewed == 'true':
            qs = qs.filter(reviewed_by__isnull=False)
        elif reviewed == 'false':
            qs = qs.filter(reviewed_by__isnull=True)

        return qs

    @action(detail=False, methods=['post'], permission_classes=[IsTenantMember])
    def evaluate_student(self, request):
        """On-demand trigger to compute explainable AI academic risk for a student."""
        user = request.user
        serializer = EvaluateStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data.get('student_id')

        if not student_id:
            return Response({
                'success': False,
                'message': "Please provide a valid 'student_id'.",
                'code': 'STUDENT_ID_REQUIRED'
            }, status=status.HTTP_400_BAD_REQUEST)

        student_qs = Student.objects.all()
        if user.college:
            student_qs = student_qs.filter(college=user.college)

        target_student = None
        try:
            target_student = student_qs.filter(id=uuid.UUID(str(student_id))).first()
        except ValueError:
            target_student = student_qs.filter(
                Q(student_number__iexact=student_id) | Q(roll_number__iexact=student_id)
            ).first()

        if not target_student:
            return Response({
                'success': False,
                'message': f"Student '{student_id}' not found.",
                'code': 'STUDENT_NOT_FOUND'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check mentor scoping
        if user.role == 'MENTOR':
            is_assigned = MentorAssignment.objects.filter(
                mentor__user=user,
                student=target_student,
                is_active=True
            ).exists()
            if not is_assigned:
                return Response({
                    'success': False,
                    'message': "Mentors can only evaluate students in their assigned cohort.",
                    'code': 'MENTOR_COHORT_VIOLATION'
                }, status=status.HTTP_403_FORBIDDEN)

        analysis = AcademicRiskEngine.evaluate_student(target_student)
        return Response({
            'success': True,
            'message': f"AI academic risk evaluated for {target_student.roll_number}: {analysis.risk_level} ({analysis.score}/100)",
            'data': StudentAIAnalysisSerializer(analysis).data
        })

    @action(detail=False, methods=['post'], permission_classes=[IsTenantMember])
    def evaluate_all(self, request):
        """Batch evaluation of all students in college (Admins/Principal only)."""
        user = request.user
        if user.role not in ['PRINCIPAL', 'MANAGEMENT']:
            return Response({
                'success': False,
                'message': "Only Principals and Management can run batch AI risk evaluations.",
                'code': 'PERMISSION_DENIED'
            }, status=status.HTTP_403_FORBIDDEN)

        college = user.college
        student_qs = Student.objects.filter(is_deleted=False)
        if college:
            student_qs = student_qs.filter(college=college)

        count = 0
        for s in student_qs:
            AcademicRiskEngine.evaluate_student(s)
            count += 1

        return Response({
            'success': True,
            'message': f"Successfully refreshed AI early-warning assessments for {count} students."
        })

    @action(detail=True, methods=['post'], permission_classes=[IsTenantMember])
    def review(self, request, pk=None):
        """Mentor or HOD submits human review notes and logs chosen intervention."""
        analysis = self.get_object()
        user = request.user

        # Scoping: Mentor can only review assigned students
        if user.role == 'MENTOR':
            is_assigned = MentorAssignment.objects.filter(
                mentor__user=user,
                student=analysis.student,
                is_active=True
            ).exists()
            if not is_assigned:
                return Response({
                    'success': False,
                    'message': "Mentors can only review early-warning assessments for their assigned students.",
                    'code': 'MENTOR_COHORT_VIOLATION'
                }, status=status.HTTP_403_FORBIDDEN)
        elif user.role not in ['PRINCIPAL', 'HOD', 'MANAGEMENT', 'FACULTY']:
            return Response({
                'success': False,
                'message': "Unauthorized to review academic risk assessments.",
                'code': 'PERMISSION_DENIED'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = ReviewRiskAnalysisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        analysis.reviewed_by = user
        analysis.reviewed_at = timezone.now()
        analysis.review_notes = serializer.validated_data['review_notes']
        analysis.review_action_taken = serializer.validated_data['review_action_taken']
        analysis.save(update_fields=['reviewed_by', 'reviewed_at', 'review_notes', 'review_action_taken'])

        return Response({
            'success': True,
            'message': f"Mentor review recorded for {analysis.student.roll_number}.",
            'data': StudentAIAnalysisSerializer(analysis).data
        })
