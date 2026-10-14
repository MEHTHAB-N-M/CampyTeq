from datetime import date
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember
from library.models import Book, BookIssue, LibraryRequest
from library.serializers import (
    BookSerializer,
    BookIssueSerializer,
    BookIssueCreateSerializer,
    BookReturnActionSerializer,
    LibraryRequestSerializer,
    LibraryRequestReviewSerializer,
)
from communication.models import Notification


class BookViewSet(viewsets.ModelViewSet):
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["category"]
    search_fields = ["title", "author", "isbn", "publisher", "shelf_location"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["STUDENT", "PARENT"]:
            return Book.objects.none()
        return Book.objects.filter(college=user.college)

    def perform_create(self, serializer):
        serializer.save(college=self.request.user.college)


class BookIssueViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["status", "fine_paid", "book", "user"]
    search_fields = ["book__title", "book__isbn", "user__first_name", "user__last_name", "student__roll_number"]

    def get_serializer_class(self):
        if self.action == "create":
            return BookIssueCreateSerializer
        return BookIssueSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ["STUDENT", "PARENT"]:
            return BookIssue.objects.none()
        qs = BookIssue.objects.filter(college=user.college).select_related(
            "book", "user", "student", "issued_by"
        )
        if user.role in ["LIBRARY_STAFF", "PRINCIPAL"]:
            return qs
        return qs.filter(user=user)

    @action(detail=True, methods=["post"])
    def mark_return(self, request, pk=None):
        """Process book return, calculate overdue fine, and restock inventory."""
        issue = self.get_object()
        if issue.status == BookIssue.IssueStatus.RETURNED:
            return Response({"detail": "This book has already been returned."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BookReturnActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        return_date = date.today()
        issue.return_date = return_date
        issue.status = BookIssue.IssueStatus.RETURNED

        fine = issue.calculate_overdue_fine(Decimal("5.00"))
        issue.fine_amount = fine
        issue.fine_paid = serializer.validated_data.get("fine_paid", False)
        if serializer.validated_data.get("remarks"):
            issue.remarks = f"{issue.remarks} | {serializer.validated_data['remarks']}".strip(" | ")

        issue.save()

        # Restock inventory
        book = issue.book
        book.available_copies += 1
        book.save()

        # Send notification to borrower
        Notification.objects.create(
            college=issue.college,
            recipient=issue.user,
            title=f"Library Return Confirmed: {book.title}",
            message=f"Book returned successfully.{f' Overdue fine assessed: ₹{fine}' if fine > 0 else ' No overdue fines.'}",
            notification_type="SYSTEM",
            action_url="/dashboard/library",
        )

        return Response(BookIssueSerializer(issue).data)

    @action(detail=False, methods=["get"])
    def overdue_list(self, request):
        today = date.today()
        qs = self.get_queryset().filter(
            status=BookIssue.IssueStatus.ISSUED,
            due_date__lt=today
        )
        serializer = BookIssueSerializer(qs, many=True)
        return Response(serializer.data)


class LibraryRequestViewSet(viewsets.ModelViewSet):
    """
    Library Request management:
    - Mentors can raise requests (borrowing/reservation/procurement).
    - Library Staff and Principal can view and review incoming requests.
    - Status updates notify the requesting Mentor.
    """
    serializer_class = LibraryRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["status", "request_type", "user", "book"]
    search_fields = ["book__title", "suggested_title", "notes", "user__first_name", "user__last_name"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["STUDENT", "PARENT"]:
            return LibraryRequest.objects.none()
        qs = LibraryRequest.objects.filter(college=user.college).select_related(
            "user", "book", "reviewed_by"
        )
        if user.role in ["LIBRARY_STAFF", "PRINCIPAL", "SUPER_ADMIN"]:
            return qs
        # Mentors and HODs view their own requests
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ["HOD", "MENTOR", "FACULTY", "PRINCIPAL", "SUPER_ADMIN"]:
            raise permissions.exceptions.PermissionDenied("Only HODs, Faculty, and Mentors can submit library requests.")
        
        req = serializer.save(
            college=user.college,
            user=user,
            status="PENDING",
        )

        # Notify Library Staff of incoming request
        from accounts.models import User as AccountUser
        staff_users = AccountUser.objects.filter(college=user.college, role="LIBRARY_STAFF")
        title_name = req.book.title if req.book else req.suggested_title
        for staff in staff_users:
            Notification.objects.create(
                college=user.college,
                recipient=staff,
                title=f"New Library Request: {title_name}",
                message=f"Mentor {user.get_full_name()} submitted a {req.get_request_type_display()} request.",
                notification_type="SYSTEM",
                action_url="/dashboard/library",
            )

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        if request.user.role not in ["LIBRARY_STAFF", "PRINCIPAL"]:
            return Response({
                "success": False,
                "message": "Only Library Staff or Principal can review library requests.",
                "code": "PERMISSION_DENIED"
            }, status=status.HTTP_403_FORBIDDEN)

        lib_req = self.get_object()
        serializer = LibraryRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        remarks = serializer.validated_data.get("reviewer_remarks", "")

        lib_req.status = new_status
        lib_req.reviewer_remarks = remarks
        lib_req.reviewed_by = request.user
        lib_req.reviewed_at = timezone.now()
        lib_req.save()

        # If fulfilled / issued and copies available, decrement copies
        if new_status == "FULFILLED" and lib_req.book:
            if lib_req.book.available_copies > 0:
                lib_req.book.available_copies -= 1
                lib_req.book.save(update_fields=["available_copies"])

        # Trigger notification to requesting Mentor
        title_name = lib_req.book.title if lib_req.book else lib_req.suggested_title
        Notification.objects.create(
            college=lib_req.college,
            recipient=lib_req.user,
            title=f"Library Request {new_status}: {title_name}",
            message=f"Your request has been {new_status.lower()} by {request.user.get_full_name()}. {f'Remarks: {remarks}' if remarks else ''}".strip(),
            notification_type="SYSTEM",
            action_url="/dashboard/library",
        )

        return Response(LibraryRequestSerializer(lib_req).data)
