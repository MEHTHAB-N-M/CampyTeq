from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog, User as AccountUser
from leave.models import LeaveRequest
from leave.serializers import LeaveRequestSerializer, LeaveReviewActionSerializer
from communication.models import Notification


class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["status", "leave_type", "user", "routed_tier"]
    search_fields = ["user__first_name", "user__last_name", "reason"]

    def get_queryset(self):
        user = self.request.user
        qs = LeaveRequest.objects.filter(college=user.college).select_related(
            "user", "approved_by", "routed_to"
        )

        if user.role == "SUPER_ADMIN":
            # Super Admin sees leave requests from Principals across colleges
            active_college = getattr(self.request, "college", None)
            base_qs = LeaveRequest.objects.all()
            if active_college:
                base_qs = base_qs.filter(college=active_college)
            return base_qs.filter(
                Q(user__role="PRINCIPAL") | Q(routed_tier="SUPER_ADMIN") | Q(user=user)
            ).select_related("user", "approved_by", "routed_to")

        if user.role == "STUDENT":
            # Students only see their own requests
            return qs.filter(user=user)

        elif user.role in ["FACULTY", "MENTOR"]:
            # Faculty/Mentor sees own leaves + student leaves assigned to them
            faculty_filter = Q(user=user) | Q(routed_to=user)
            if hasattr(user, "faculty_profile"):
                from students.models import MentorAssignment
                student_user_ids = MentorAssignment.objects.filter(
                    mentor=user.faculty_profile, is_active=True
                ).values_list("student__user_id", flat=True)
                faculty_filter |= (Q(routed_tier__in=["MENTOR", "FACULTY"]) & Q(user_id__in=student_user_ids))
            return qs.filter(faculty_filter)

        elif user.role == "HOD":
            # HOD sees own leaves + Faculty/Mentor leaves in their department
            hod_filter = Q(user=user) | Q(routed_to=user)
            dept = getattr(getattr(user, "faculty_profile", None), "department", None)
            if dept:
                hod_filter |= (
                    Q(routed_tier="HOD")
                    & (Q(user__faculty_profile__department=dept) | Q(user__role__in=["FACULTY", "MENTOR"]))
                )
            return qs.filter(hod_filter)

        elif user.role == "PRINCIPAL":
            # Principal sees all staff leaves + leaves forwarded for Principal approval
            return qs.filter(
                Q(user=user)
                | Q(routed_to=user)
                | Q(routed_tier="PRINCIPAL")
                | Q(user__role__in=["HOD", "FACULTY", "MENTOR"])
            )

        # Other roles see only their own
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        routed_to = None
        routed_tier = ""

        # 1. Student -> Mentor
        if acting_role == "STUDENT":
            routed_tier = "MENTOR"
            student_profile = getattr(user, "student_profile", None)
            if student_profile and student_profile.mentor:
                routed_to = student_profile.mentor.user
            else:
                from students.models import MentorAssignment
                assignment = MentorAssignment.objects.filter(student__user=user, is_active=True).first()
                if assignment and assignment.mentor:
                    routed_to = assignment.mentor.user

        # 2. Faculty / Lab Faculty -> HOD
        elif acting_role in ["FACULTY", "LAB_FACULTY", "MENTOR"]:
            routed_tier = "HOD"
            faculty_profile = getattr(user, "faculty_profile", None)
            if faculty_profile and faculty_profile.department:
                dept = faculty_profile.department
                if dept.hod and dept.hod.user:
                    routed_to = dept.hod.user
                else:
                    routed_to = AccountUser.objects.filter(
                        college=user.college, role="HOD"
                    ).first()

        # 3. HOD -> Principal (No self-approval: HOD escalates to Principal)
        elif acting_role == "HOD":
            routed_tier = "PRINCIPAL"
            routed_to = AccountUser.objects.filter(
                college=user.college, role="PRINCIPAL"
            ).first()

        # 4. Principal -> Super Admin
        elif acting_role == "PRINCIPAL":
            routed_tier = "SUPER_ADMIN"
            routed_to = AccountUser.objects.filter(role="SUPER_ADMIN").first()

        req = serializer.save(
            college=user.college,
            user=user,
            status="PENDING",
            routed_to=routed_to,
            routed_tier=routed_tier,
        )

        ip_addr = self.request.META.get('HTTP_X_FORWARDED_FOR', self.request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        AuditLog.objects.create(
            college=req.college,
            user=user,
            acting_role=acting_role,
            action='LEAVE_REQUEST_CREATED',
            resource_type='LeaveRequest',
            resource_id=str(req.id),
            ip_address=ip_addr,
            new_values={
                'leave_type': req.leave_type,
                'from_date': str(req.from_date),
                'to_date': str(req.to_date),
                'routed_tier': routed_tier,
            }
        )

        # Send notification to the designated reviewer
        if routed_to:
            Notification.objects.create(
                college=req.college,
                recipient=routed_to,
                title=f"Leave request from {user.get_full_name()} ({user.get_role_display()})",
                message=f"{req.days_count} days {req.get_leave_type_display()}: {req.reason[:80]}",
                notification_type="LEAVE_STATUS",
                action_url="/dashboard/leave",
            )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Reviewer approves a leave application."""
        leave_req = self.get_object()
        acting_role = get_acting_role(request)

        # Rule 5: Nobody approves their own request
        if not self._can_review(request.user, leave_req, acting_role=acting_role):
            return Response({
                "success": False,
                "message": "You are not authorized to review this leave request. Self-approval is strictly forbidden.",
                "code": "PERMISSION_DENIED"
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = LeaveReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remarks = serializer.validated_data.get("approval_remarks", "Approved as requested.")
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()

        # Multi-tier hierarchy: Principal <- HOD <- Faculty
        # If applicant is Faculty/Mentor and reviewer is HOD, forward to Principal for final sign-off
        if leave_req.routed_tier == "HOD" and acting_role == "HOD":
            principal_user = AccountUser.objects.filter(
                college=leave_req.college, role="PRINCIPAL"
            ).first()
            leave_req.routed_tier = "PRINCIPAL"
            if principal_user:
                leave_req.routed_to = principal_user
            leave_req.approval_remarks = f"HOD Recommendation ({request.user.get_full_name()}): {remarks}"
            leave_req.save()

            AuditLog.objects.create(
                college=leave_req.college,
                user=request.user,
                acting_role=acting_role,
                action='LEAVE_REQUEST_FORWARDED',
                resource_type='LeaveRequest',
                resource_id=str(leave_req.id),
                ip_address=ip_addr,
                new_values={'forwarded_to': 'PRINCIPAL', 'remarks': remarks}
            )

            if principal_user:
                Notification.objects.create(
                    college=leave_req.college,
                    recipient=principal_user,
                    title=f"Faculty Leave (HOD Recommended): {leave_req.user.get_full_name()}",
                    message=f"{leave_req.days_count} days {leave_req.get_leave_type_display()} recommended by HOD {request.user.get_full_name()}.",
                    notification_type="LEAVE_STATUS",
                    action_url="/dashboard/leave",
                )
            Notification.objects.create(
                college=leave_req.college,
                recipient=leave_req.user,
                title="Leave Recommended by HOD",
                message=f"HOD {request.user.get_full_name()} has recommended your leave and forwarded it to Principal for final approval.",
                notification_type="LEAVE_STATUS",
                action_url="/dashboard/leave",
            )
            return Response(LeaveRequestSerializer(leave_req).data)

        # Final approval (by Principal for staff, or Faculty/Mentor for Student)
        leave_req.status = "APPROVED"
        leave_req.approved_by = request.user
        leave_req.approval_remarks = remarks
        leave_req.reviewed_at = timezone.now()
        leave_req.save()

        AuditLog.objects.create(
            college=leave_req.college,
            user=request.user,
            acting_role=acting_role,
            action='LEAVE_REQUEST_APPROVED',
            resource_type='LeaveRequest',
            resource_id=str(leave_req.id),
            ip_address=ip_addr,
            new_values={'status': 'APPROVED', 'remarks': remarks}
        )

        Notification.objects.create(
            college=leave_req.college,
            recipient=leave_req.user,
            title=f"Your {leave_req.get_leave_type_display()} has been APPROVED",
            message=f"Reviewed by {request.user.get_full_name()}. Remarks: {leave_req.approval_remarks}",
            notification_type="LEAVE_STATUS",
            action_url="/dashboard/leave",
        )

        return Response(LeaveRequestSerializer(leave_req).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reviewer rejects a leave application."""
        leave_req = self.get_object()
        acting_role = get_acting_role(request)

        # Rule 5: Nobody decides their own request
        if not self._can_review(request.user, leave_req, acting_role=acting_role):
            return Response({
                "success": False,
                "message": "You are not authorized to review this leave request.",
                "code": "PERMISSION_DENIED"
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = LeaveReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remarks = serializer.validated_data.get("approval_remarks", "Rejected.")
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()

        leave_req.status = "REJECTED"
        leave_req.approved_by = request.user
        leave_req.approval_remarks = remarks
        leave_req.reviewed_at = timezone.now()
        leave_req.save()

        AuditLog.objects.create(
            college=leave_req.college,
            user=request.user,
            acting_role=acting_role,
            action='LEAVE_REQUEST_REJECTED',
            resource_type='LeaveRequest',
            resource_id=str(leave_req.id),
            ip_address=ip_addr,
            new_values={'status': 'REJECTED', 'remarks': remarks}
        )

        Notification.objects.create(
            college=leave_req.college,
            recipient=leave_req.user,
            title=f"Your {leave_req.get_leave_type_display()} was NOT approved",
            message=f"Reviewed by {request.user.get_full_name()}. Reason: {leave_req.approval_remarks}",
            notification_type="LEAVE_STATUS",
            action_url="/dashboard/leave",
        )

        return Response(LeaveRequestSerializer(leave_req).data)

    def _can_review(self, user, leave_req, acting_role=None):
        # Rule 5: Nobody approves their own request
        if leave_req.user_id == user.id:
            return False

        if not acting_role:
            acting_role = getattr(user, 'active_role', None) or user.get_default_active_role()

        if acting_role in ["SUPER_ADMIN", "PRINCIPAL"]:
            return True
        if leave_req.routed_to_id and leave_req.routed_to_id == user.id:
            return True
        if leave_req.routed_tier in ["MENTOR", "FACULTY"] and acting_role in ["MENTOR", "FACULTY"]:
            return True
        if leave_req.routed_tier == "HOD" and acting_role == "HOD":
            return True
        return False
