from datetime import datetime, date
from django.db.models import Count, Q, F
from django.utils import timezone
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsTenantMember, get_acting_role
from accounts.models import AuditLog
from attendance.models import AttendanceSession, StudentAttendance, FacultyAttendance
from attendance.serializers import (
    AttendanceSessionSerializer,
    AttendanceSessionDetailSerializer,
    StudentAttendanceSerializer,
    BulkMarkAttendanceSerializer,
    FacultyAttendanceSerializer,
    FacultyPunchSerializer,
)
from students.models import Student, ParentWardLink, MentorAssignment
from academics.models import Subject, SubjectAssignment, FacultySubject, ClassIncharge


def is_faculty_assigned_to_subject(faculty, subject):
    """Checks if a faculty is assigned to the subject via SubjectAssignment or FacultySubject."""
    today = timezone.now().date()
    has_sa = SubjectAssignment.objects.filter(
        faculty=faculty,
        subject=subject,
        is_active=True,
    ).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=today)
    ).exists()
    if has_sa:
        return True

    has_fs = FacultySubject.objects.filter(
        faculty=faculty,
        subject=subject,
    ).exists()
    return has_fs


class AttendanceSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["date", "subject", "semester", "faculty", "session_type"]
    search_fields = ["subject__name", "subject__code", "topic_covered"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return AttendanceSession.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == "SUPER_ADMIN":
            return AttendanceSession.objects.none()

        qs = AttendanceSession.objects.filter(
            college=user.college
        ).select_related("subject", "semester", "faculty", "faculty__user")

        if acting_role == "STUDENT":
            if hasattr(user, "student_profile"):
                return qs.filter(semester=user.student_profile.current_semester)
            return AttendanceSession.objects.none()
        elif acting_role == "PARENT":
            ward_sem_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list("student__current_semester_id", flat=True)
            return qs.filter(semester_id__in=ward_sem_ids)
        elif acting_role == "LAB_FACULTY":
            qs = qs.filter(session_type="LAB")
            if hasattr(user, "faculty_profile"):
                return qs.filter(faculty=user.faculty_profile)
            return AttendanceSession.objects.none()
        elif acting_role == "FACULTY":
            if hasattr(user, "faculty_profile"):
                return qs.filter(faculty=user.faculty_profile)
            return AttendanceSession.objects.none()
        elif acting_role == "CLASS_INCHARGE":
            faculty_profile = getattr(user, "faculty_profile", None)
            if faculty_profile:
                incharge_batch_ids = ClassIncharge.objects.filter(
                    faculty=faculty_profile, is_active=True
                ).values_list("class_section__batch_id", flat=True)
                return qs.filter(semester__batch_id__in=incharge_batch_ids)
            return AttendanceSession.objects.none()
        elif acting_role == "HOD":
            faculty_profile = getattr(user, "faculty_profile", None)
            if faculty_profile and faculty_profile.department:
                return qs.filter(subject__department=faculty_profile.department)

        return qs

    def get_serializer_class(self):
        if self.action in ["retrieve"]:
            return AttendanceSessionDetailSerializer
        return AttendanceSessionSerializer

    def perform_create(self, serializer):
        user = self.request.user
        acting_role = get_acting_role(self.request)
        subject = serializer.validated_data.get("subject")
        faculty = serializer.validated_data.get("faculty") or getattr(user, "faculty_profile", None)

        if acting_role == "SUPER_ADMIN":
            raise PermissionDenied("Super Administrators do not create attendance sessions.")

        if acting_role == "LAB_FACULTY":
            if not faculty or not is_faculty_assigned_to_subject(faculty, subject):
                raise PermissionDenied("Only assigned lab faculty can create practical attendance sessions.")
            serializer.save(college=user.college, faculty=faculty, session_type="LAB")
        elif acting_role == "FACULTY":
            if not faculty or not is_faculty_assigned_to_subject(faculty, subject):
                raise PermissionDenied("Only the assigned subject faculty or active substitute can create attendance sessions.")
            serializer.save(college=user.college, faculty=faculty)
        elif acting_role == "HOD":
            faculty_profile = getattr(user, "faculty_profile", None)
            if not faculty_profile or subject.department_id != faculty_profile.department_id:
                raise PermissionDenied("HOD can only create attendance sessions for subjects in their department.")
            serializer.save(college=user.college, faculty=faculty or faculty_profile)
        elif acting_role == "PRINCIPAL":
            serializer.save(college=user.college, faculty=faculty or getattr(user, "faculty_profile", None))
        else:
            raise PermissionDenied("You do not have permission to create attendance sessions.")

    @action(detail=True, methods=["get"])
    def roster(self, request, pk=None):
        """Returns the enrolled student roster for this session's semester, along with current mark status if any."""
        session = self.get_object()
        students = Student.objects.filter(
            college=session.college,
            current_semester=session.semester,
            status="ACTIVE",
        ).select_related("user")

        # Map existing attendance
        existing_attendances = {
            att.student_id: att for att in session.student_attendances.all()
        }

        roster_data = []
        for s in students:
            att = existing_attendances.get(s.id)
            roster_data.append({
                "student_id": str(s.id),
                "student_name": s.user.get_full_name(),
                "roll_number": s.roll_number,
                "status": att.status if att else None,
                "remarks": att.remarks if att else "",
            })
        return Response(roster_data)

    @action(detail=True, methods=["post"])
    def mark_bulk(self, request, pk=None):
        """Allows assigned faculty (or active substitute) to mark/update attendance for all students in one request."""
        session = self.get_object()
        acting_role = get_acting_role(request)
        faculty_profile = getattr(request.user, "faculty_profile", None)

        # Authorization: assigned subject faculty (or active substitute), HOD in dept, or Principal
        if acting_role in ["FACULTY", "LAB_FACULTY"]:
            if not faculty_profile or not is_faculty_assigned_to_subject(faculty_profile, session.subject):
                raise PermissionDenied("Only the assigned subject faculty or active substitute can mark attendance.")
        elif acting_role == "HOD":
            if not faculty_profile or session.subject.department_id != faculty_profile.department_id:
                raise PermissionDenied("HOD can only mark attendance for subjects in their department.")
        elif acting_role == "PRINCIPAL":
            pass
        else:
            raise PermissionDenied("You do not have permission to mark attendance.")

        serializer = BulkMarkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendances_data = serializer.validated_data["attendances"]
        records_to_create = []
        records_to_update = []

        existing_records = {
            att.student_id: att for att in session.student_attendances.all()
        }

        ip_addr = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0].strip()

        for item in attendances_data:
            student_id = item["student_id"]
            new_status = item["status"]
            remarks = item.get("remarks", "")

            if student_id in existing_records:
                record = existing_records[student_id]
                if record.status != new_status:
                    # Audit override
                    AuditLog.objects.create(
                        college=session.college,
                        user=request.user,
                        acting_role=acting_role,
                        action="ATTENDANCE_OVERRIDDEN",
                        resource_type="StudentAttendance",
                        resource_id=str(record.id),
                        ip_address=ip_addr,
                        old_values={"status": record.status, "student_id": str(student_id)},
                        new_values={"status": new_status, "remarks": remarks},
                    )
                record.status = new_status
                record.remarks = remarks
                record.marked_by = request.user
                records_to_update.append(record)
            else:
                records_to_create.append(
                    StudentAttendance(
                        college=session.college,
                        session=session,
                        student_id=student_id,
                        status=new_status,
                        remarks=remarks,
                        marked_by=request.user,
                    )
                )

        if records_to_create:
            StudentAttendance.objects.bulk_create(records_to_create)
        if records_to_update:
            StudentAttendance.objects.bulk_update(
                records_to_update, ["status", "remarks", "marked_by"]
            )

        return Response({
            "message": f"Successfully updated attendance for {len(attendances_data)} students.",
            "created": len(records_to_create),
            "updated": len(records_to_update),
        })


class StudentAttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = StudentAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["session", "student", "status"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return StudentAttendance.objects.none()

        acting_role = get_acting_role(self.request)
        if acting_role == "SUPER_ADMIN":
            return StudentAttendance.objects.none()

        qs = StudentAttendance.objects.filter(
            college=user.college
        ).select_related(
            "session", "session__subject", "student", "student__user", "marked_by"
        )

        if acting_role == "STUDENT":
            if hasattr(user, "student_profile"):
                return qs.filter(student=user.student_profile)
            return StudentAttendance.objects.none()
        elif acting_role == "PARENT":
            ward_ids = ParentWardLink.objects.filter(
                parent=user, is_verified=True, is_active=True, college=user.college
            ).values_list("student_id", flat=True)
            return qs.filter(student_id__in=ward_ids)
        elif acting_role == "MENTOR":
            if hasattr(user, "faculty_profile"):
                assigned_student_ids = MentorAssignment.objects.filter(
                    mentor=user.faculty_profile, is_active=True
                ).values_list("student_id", flat=True)
                return qs.filter(student_id__in=assigned_student_ids)
            return StudentAttendance.objects.none()
        elif acting_role == "CLASS_INCHARGE":
            if hasattr(user, "faculty_profile"):
                incharge_batch_ids = ClassIncharge.objects.filter(
                    faculty=user.faculty_profile, is_active=True
                ).values_list("class_section__batch_id", flat=True)
                return qs.filter(student__batch_id__in=incharge_batch_ids)
            return StudentAttendance.objects.none()
        elif acting_role in ["FACULTY", "LAB_FACULTY"]:
            if hasattr(user, "faculty_profile"):
                return qs.filter(session__faculty=user.faculty_profile)
            return StudentAttendance.objects.none()
        elif acting_role == "HOD":
            if hasattr(user, "faculty_profile") and user.faculty_profile.department:
                return qs.filter(student__department=user.faculty_profile.department)

        return qs

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Returns subject-wise and overall attendance percentage for a student."""
        user = request.user
        acting_role = get_acting_role(request)
        student_id = request.query_params.get("student_id")

        if acting_role == "SUPER_ADMIN":
            raise PermissionDenied("Super Administrators do not have access to student attendance data.")

        if acting_role == "STUDENT":
            if hasattr(user, "student_profile"):
                student = user.student_profile
            else:
                return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
        elif acting_role == "PARENT":
            if not student_id:
                return Response({"error": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            # Rule 8: Parent requesting unlinked student ID gets 404, never 403
            is_linked = ParentWardLink.objects.filter(
                parent=user, student_id=student_id, is_verified=True, is_active=True, college=user.college
            ).exists()
            if not is_linked:
                return Response({"error": "Ward not found or unverified"}, status=status.HTTP_404_NOT_FOUND)
            try:
                student = Student.objects.get(id=student_id, college=user.college)
            except Student.DoesNotExist:
                return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        elif student_id:
            try:
                student = Student.objects.get(id=student_id, college=user.college)
            except Student.DoesNotExist:
                return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({"error": "student_id is required for staff queries"}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate attendance per subject
        subjects = Subject.objects.filter(
            course=student.course,
            semester_number=student.current_semester.semester_number if student.current_semester else 1,
            college=student.college,
        )

        subject_summaries = []
        total_conducted_all = 0
        total_attended_all = 0

        for subj in subjects:
            sessions = AttendanceSession.objects.filter(
                subject=subj, semester=student.current_semester, college=student.college
            )
            conducted_count = sessions.count()
            attended_count = StudentAttendance.objects.filter(
                session__in=sessions,
                student=student,
                status__in=["PRESENT", "LATE"],
            ).count()

            percentage = round((attended_count / conducted_count * 100), 2) if conducted_count > 0 else 100.0
            is_low = percentage < 75.0

            total_conducted_all += conducted_count
            total_attended_all += attended_count

            subject_summaries.append({
                "subject_id": str(subj.id),
                "subject_code": subj.code,
                "subject_name": subj.name,
                "credits": subj.credits,
                "conducted_sessions": conducted_count,
                "attended_sessions": attended_count,
                "percentage": percentage,
                "is_low_attendance": is_low,
            })

        overall_percentage = (
            round((total_attended_all / total_conducted_all * 100), 2)
            if total_conducted_all > 0
            else 100.0
        )

        return Response({
            "student_id": str(student.id),
            "student_name": student.user.get_full_name(),
            "roll_number": student.roll_number,
            "overall_conducted": total_conducted_all,
            "overall_attended": total_attended_all,
            "overall_percentage": overall_percentage,
            "is_defaulter": overall_percentage < 75.0,
            "subjects": subject_summaries,
        })

    @action(detail=False, methods=["get"])
    def defaulters(self, request):
        """Returns list of students with overall attendance below 75%."""
        user = request.user
        acting_role = get_acting_role(request)

        if acting_role == "SUPER_ADMIN":
            raise PermissionDenied("Super Administrators do not have access to defaulter lists.")

        students_qs = Student.objects.filter(
            college=user.college, status="ACTIVE"
        ).select_related("user", "department", "current_semester", "mentor", "mentor__user")

        if acting_role == "MENTOR" and hasattr(user, "faculty_profile"):
            assigned_student_ids = MentorAssignment.objects.filter(
                mentor=user.faculty_profile, is_active=True
            ).values_list("student_id", flat=True)
            students_qs = students_qs.filter(id__in=assigned_student_ids)
        elif acting_role == "CLASS_INCHARGE" and hasattr(user, "faculty_profile"):
            incharge_batch_ids = ClassIncharge.objects.filter(
                faculty=user.faculty_profile, is_active=True
            ).values_list("class_section__batch_id", flat=True)
            students_qs = students_qs.filter(batch_id__in=incharge_batch_ids)
        elif acting_role == "HOD" and hasattr(user, "faculty_profile") and user.faculty_profile.department:
            students_qs = students_qs.filter(department=user.faculty_profile.department)

        defaulters_list = []
        for s in students_qs:
            sessions = AttendanceSession.objects.filter(
                semester=s.current_semester, college=s.college
            )
            conducted = sessions.count()
            if conducted == 0:
                continue

            attended = StudentAttendance.objects.filter(
                session__in=sessions,
                student=s,
                status__in=["PRESENT", "LATE"],
            ).count()

            pct = round((attended / conducted * 100), 2)
            if pct < 75.0:
                defaulters_list.append({
                    "student_id": str(s.id),
                    "student_name": s.user.get_full_name(),
                    "roll_number": s.roll_number,
                    "department_name": s.department.name if s.department else "N/A",
                    "semester_name": s.current_semester.name if s.current_semester else "N/A",
                    "attendance_percentage": pct,
                    "conducted_sessions": conducted,
                    "attended_sessions": attended,
                    "missed_sessions": conducted - attended,
                    "mentor_name": s.mentor.user.get_full_name() if s.mentor else "Not Assigned",
                    "mentor_email": s.mentor.user.email if s.mentor else "",
                })

        return Response(defaulters_list)



class FacultyAttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = FacultyAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
    filterset_fields = ["date", "faculty", "status"]

    def get_queryset(self):
        user = self.request.user
        qs = FacultyAttendance.objects.filter(
            college=user.college
        ).select_related("faculty", "faculty__user", "faculty__department")

        acting_role = get_acting_role(self.request)
        if acting_role in ["FACULTY", "LAB_FACULTY"]:
            if hasattr(user, "faculty_profile"):
                return qs.filter(faculty=user.faculty_profile)
            return FacultyAttendance.objects.none()
        return qs

    @action(detail=False, methods=["get"])
    def today(self, request):
        """Returns the authenticated faculty member's punch status for today."""
        user = request.user
        if not hasattr(user, "faculty_profile"):
            return Response({"error": "Faculty profile required"}, status=status.HTTP_400_BAD_REQUEST)

        today_date = timezone.localdate() if hasattr(timezone, "localdate") else date.today()
        record = FacultyAttendance.objects.filter(
            faculty=user.faculty_profile, date=today_date
        ).first()

        if record:
            return Response(FacultyAttendanceSerializer(record).data)
        return Response({
            "is_punched_in": False,
            "is_punched_out": False,
            "date": str(today_date),
            "record": None,
        })

    @action(detail=False, methods=["post"])
    def check_in(self, request):
        """Records check-in punch for authenticated faculty."""
        user = request.user
        if not hasattr(user, "faculty_profile"):
            return Response({"error": "Faculty profile required"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = FacultyPunchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        now = timezone.localtime() if hasattr(timezone, "localtime") else datetime.now()
        today_date = now.date()
        current_time = now.time()

        record, created = FacultyAttendance.objects.get_or_create(
            college=user.college,
            faculty=user.faculty_profile,
            date=today_date,
            defaults={
                "check_in": current_time,
                "punch_source": serializer.validated_data.get("punch_source", "WEB_PORTAL"),
                "remarks": serializer.validated_data.get("remarks", ""),
                "status": "PRESENT",
            },
        )

        if not created and not record.check_in:
            record.check_in = current_time
            record.punch_source = serializer.validated_data.get("punch_source", "WEB_PORTAL")
            record.save()

        return Response(FacultyAttendanceSerializer(record).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def check_out(self, request):
        """Records check-out punch and computes working duration."""
        user = request.user
        if not hasattr(user, "faculty_profile"):
            return Response({"error": "Faculty profile required"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.localtime() if hasattr(timezone, "localtime") else datetime.now()
        today_date = now.date()
        current_time = now.time()

        record = FacultyAttendance.objects.filter(
            faculty=user.faculty_profile, date=today_date
        ).first()

        if not record:
            return Response(
                {"error": "Cannot check out without a valid check-in today"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record.check_out = current_time
        record.save()  # Triggers calculate_working_minutes in model save()

        return Response(FacultyAttendanceSerializer(record).data, status=status.HTTP_200_OK)
