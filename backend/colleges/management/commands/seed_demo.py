from django.core.management.base import BaseCommand
from datetime import date, time, timedelta
from django.utils import timezone
from colleges.models import College
from accounts.models import User, Role, Permission
from departments.models import Department
from academics.models import Course, Batch, Semester, Subject, FacultySubject, TimetableEntry
from faculty.models import Faculty
from students.models import Student, Guardian, StudentGuardian, MentorAssignment
from decimal import Decimal
from exams.models import Exam, ExamSubject, Result
from assignments.models import Assignment, AssignmentSubmission
from attendance.models import AttendanceSession, StudentAttendance, FacultyAttendance
from fees.models import FeeCategory, FeeStructure, StudentInvoice, Payment, PaymentReceipt
from communication.models import Announcement, Notification, Document
from leave.models import LeaveRequest
from printshop.models import PrintPricing, PrintOrder
from library.models import LibraryBooking
from cameras.models import CameraZone, Camera
from tracking.models import BiometricProfile, DetectionEvent, StudentLatestLocation, TrackingAccessLog
from analytics.models import StudentAIAnalysis
from facilities.models import Facility, FacilityBooking

class Command(BaseCommand):
    help = "Seeds initial demo colleges, users, academic structure, timetable, exams, results, and assignments."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("==> Seeding CampyTeq Phase 3 Foundation & Academics Data..."))

        # 1. Colleges
        apex_college, _ = College.objects.get_or_create(
            code="APEX-TECH",
            defaults={
                "name": "Apex Institute of Technology",
                "slug": "apex-tech",
                "domain": "apex.campyteq.local",
                "email": "contact@apex.edu",
                "phone": "+91 98765 43210",
                "address": "Campus Boulevard, Cyber City, Bengaluru, KA 560100",
                "status": "ACTIVE",
                "settings": {
                    "academic_year": "2026-2027",
                    "attendance_threshold_percentage": 75,
                    "currency": "INR",
                    "currency_symbol": "₹",
                }
            }
        )

        metro_college, _ = College.objects.get_or_create(
            code="METRO-SCI",
            defaults={
                "name": "Metropolitan College of Science",
                "slug": "metro-sci",
                "domain": "metro.campyteq.local",
                "email": "admin@metro.edu",
                "phone": "+91 91234 56789",
                "address": "Tech Park Road, Hyderabad, TS 500081",
                "status": "ACTIVE",
                "settings": {"currency": "INR"}
            }
        )

        # 2. Permissions
        permissions_data = [
            ("student.view", "View Students", "Student"),
            ("student.create", "Create Student", "Student"),
            ("student.update", "Update Student", "Student"),
            ("student.delete", "Delete Student", "Student"),
            ("attendance.view", "View Attendance", "Attendance"),
            ("attendance.mark", "Mark Attendance", "Attendance"),
            ("attendance.update", "Update Attendance", "Attendance"),
            ("fees.view", "View Fees & Invoices", "Finance"),
            ("fees.create", "Create Fee Structure", "Finance"),
            ("fees.update", "Update Fee Invoices", "Finance"),
            ("payments.record", "Record Payments", "Finance"),
            ("camera.view", "View Camera Status", "Security"),
            ("camera.manage", "Manage Cameras & Zones", "Security"),
            ("tracking.search", "Search Authorized Last-Detected Location", "Security"),
            ("print.create", "Submit Print Order", "Print Shop"),
            ("print.manage", "Manage Print Queue", "Print Shop"),
            ("library.view", "Browse Library Books", "Library"),
            ("library.issue", "Issue & Return Books", "Library"),
            ("academics.view", "View Academics & Timetable", "Academics"),
            ("academics.manage", "Manage Courses, Batches & Exams", "Academics"),
        ]

        permission_objs = {}
        for code, name, category in permissions_data:
            perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": name, "category": category})
            permission_objs[code] = perm

        # 3. Roles
        role_definitions = {
            "PRINCIPAL": ("Principal", list(permission_objs.keys())),
            "HOD": ("Head of Department", ["student.view", "student.update", "attendance.view", "attendance.mark", "academics.view", "academics.manage", "camera.view", "tracking.search"]),
            "MENTOR": ("Mentor", ["student.view", "attendance.view", "academics.view", "camera.view", "tracking.search", "print.create", "library.view"]),
            "FACULTY": ("Faculty", ["student.view", "attendance.view", "attendance.mark", "print.create"]),
            "ACCOUNTANT": ("Accountant", ["fees.view", "fees.create", "fees.update", "payments.record", "print.create"]),
            "STUDENT": ("Student", ["attendance.view", "academics.view", "fees.view", "print.create", "library.view"]),
            "PARENT": ("Parent/Guardian", ["student.view", "attendance.view", "academics.view", "fees.view"]),
            "PRINT_STAFF": ("Print Shop Staff", ["print.create", "print.manage"]),
            "LIBRARY_STAFF": ("Library Staff", ["library.view", "library.issue", "print.create"]),
        }

        for role_code, (role_name, perm_codes) in role_definitions.items():
            role, _ = Role.objects.get_or_create(code=role_code, defaults={"name": role_name})
            role.permissions.set([permission_objs[c] for c in perm_codes if c in permission_objs])

        # 4. Demo Users
        default_password = "Password123!"
        demo_users_data = [
            ("principal@apex.edu", "Dr. Rajesh", "Nambiar", "PRINCIPAL", apex_college, True, True),
            ("hod.cs@apex.edu", "Dr. Aruna", "Sundaram", "HOD", apex_college, False, False),
            ("mentor.anil@apex.edu", "Anil", "Verma", "MENTOR", apex_college, False, False),
            ("faculty.priya@apex.edu", "Priya", "Nair", "FACULTY", apex_college, False, False),
            ("accountant.raman@apex.edu", "Raman", "Iyer", "ACCOUNTANT", apex_college, False, False),
            ("student.rahul@apex.edu", "Rahul", "Kumar", "STUDENT", apex_college, False, False),
            ("parent.sharma@apex.edu", "Suresh", "Sharma", "PARENT", apex_college, False, False),
            ("printstaff.dev@apex.edu", "Dev", "Prasad", "PRINT_STAFF", apex_college, False, False),
            ("librarystaff.anita@apex.edu", "Anita", "Deshmukh", "LIBRARY_FACULTY", apex_college, False, False),
            ("security.chief@apex.edu", "Karan", "Thakur", "SECURITY", apex_college, False, False),
            ("labfaculty.vikram@apex.edu", "Vikram", "Mehta", "LAB_FACULTY", apex_college, False, False),
            ("ananya.sen@apex.edu", "Ananya", "Sen", "STUDENT", apex_college, False, False),
            ("rohan.gupta@apex.edu", "Rohan", "Gupta", "STUDENT", apex_college, False, False),
            ("sneha.patil@apex.edu", "Sneha", "Patil", "STUDENT", apex_college, False, False),
        ]

        users = {}
        from accounts.models import UserRole
        for email, fn, ln, r, col, is_staff, is_super in demo_users_data:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": fn, "last_name": ln, "role": r,
                    "college": col, "is_staff": is_staff, "is_superuser": is_super,
                    "status": "ACTIVE"
                }
            )
            user.role = r
            user.set_password(default_password)
            user.save()
            UserRole.objects.update_or_create(
                user=user, college=col, role=r,
                defaults={"source": "base", "is_active": True}
            )
            users[email] = user

        # 5. Departments
        departments_data = [
            ("Computer Science & Engineering", "CSE", "Leading computing education and cutting-edge software research."),
            ("Electronics & Communication", "ECE", "Hardware, embedded systems, and VLSI engineering."),
            ("Mechanical Engineering", "MECH", "Robotics, thermal systems, and modern manufacturing."),
            ("Information Technology", "IT", "Cloud computing, cybersecurity, and enterprise systems."),
            ("Civil Engineering", "CIVIL", "Infrastructure, structural mechanics, and sustainable smart cities."),
        ]

        apex_depts = {}
        for name, code, desc in departments_data:
            dept, _ = Department.objects.get_or_create(
                college=apex_college, code=code,
                defaults={"name": name, "description": desc, "status": "ACTIVE"}
            )
            apex_depts[code] = dept

        # 6. Faculty
        faculty_hod, _ = Faculty.objects.get_or_create(
            user=users["hod.cs@apex.edu"],
            defaults={
                "college": apex_college, "faculty_number": "FAC-CSE-001",
                "department": apex_depts["CSE"], "designation": "PROFESSOR",
                "qualification": "Ph.D. in Computer Science (IIT Madras)",
                "specialization": "Distributed Systems & Database Engineering",
                "joining_date": date(2018, 6, 15), "status": "ACTIVE"
            }
        )
        apex_depts["CSE"].hod = faculty_hod
        apex_depts["CSE"].save()

        faculty_priya, _ = Faculty.objects.get_or_create(
            user=users["faculty.priya@apex.edu"],
            defaults={
                "college": apex_college, "faculty_number": "FAC-CSE-002",
                "department": apex_depts["CSE"], "designation": "ASSISTANT_PROFESSOR",
                "qualification": "M.Tech in Software Engineering",
                "specialization": "Data Structures & Python Systems",
                "joining_date": date(2021, 7, 1), "status": "ACTIVE"
            }
        )

        faculty_mentor, _ = Faculty.objects.get_or_create(
            user=users["mentor.anil@apex.edu"],
            defaults={
                "college": apex_college, "faculty_number": "FAC-CSE-003",
                "department": apex_depts["CSE"], "designation": "ASSOCIATE_PROFESSOR",
                "qualification": "Ph.D. in Software Architecture",
                "specialization": "Computer Systems & Design",
                "joining_date": date(2019, 8, 10), "status": "ACTIVE"
            }
        )

        # 7. Courses, Batches, Semesters
        btech_cse, _ = Course.objects.get_or_create(
            college=apex_college, code="BTECH-CSE",
            defaults={
                "name": "Bachelor of Technology in Computer Science & Engineering",
                "department": apex_depts["CSE"], "degree_level": "UG",
                "duration_years": 4, "total_semesters": 8, "status": "ACTIVE"
            }
        )

        batch_2026, _ = Batch.objects.get_or_create(
            course=btech_cse, name="2026-2030 Batch",
            defaults={
                "college": apex_college, "academic_year": "2026-2027",
                "start_date": date(2026, 8, 1), "status": "ACTIVE"
            }
        )

        sem3, _ = Semester.objects.get_or_create(
            batch=batch_2026, semester_number=3,
            defaults={"college": apex_college, "name": "Semester 3", "is_current": True}
        )

        # 8. Students
        student_rahul, _ = Student.objects.get_or_create(
            user=users["student.rahul@apex.edu"],
            defaults={
                "college": apex_college, "student_number": "STU-2026-0042",
                "roll_number": "2026-CSE-042", "department": apex_depts["CSE"],
                "course": btech_cse, "batch": batch_2026, "current_semester": sem3,
                "mentor": faculty_mentor, "admission_date": date(2026, 8, 1),
                "date_of_birth": date(2005, 4, 12), "gender": "MALE",
                "blood_group": "O+", "status": "ACTIVE"
            }
        )

        student_ananya, _ = Student.objects.get_or_create(
            user=users["ananya.sen@apex.edu"],
            defaults={
                "college": apex_college, "student_number": "STU-2026-0015",
                "roll_number": "2026-CSE-015", "department": apex_depts["CSE"],
                "course": btech_cse, "batch": batch_2026, "current_semester": sem3,
                "mentor": faculty_mentor, "admission_date": date(2026, 8, 1),
                "gender": "FEMALE", "status": "ACTIVE"
            }
        )

        student_rohan, _ = Student.objects.get_or_create(
            user=users["rohan.gupta@apex.edu"],
            defaults={
                "college": apex_college, "student_number": "STU-2026-0028",
                "roll_number": "2026-CSE-028", "department": apex_depts["CSE"],
                "course": btech_cse, "batch": batch_2026, "current_semester": sem3,
                "mentor": faculty_priya, "admission_date": date(2026, 8, 1),
                "gender": "MALE", "status": "ACTIVE"
            }
        )

        # 9. Subjects for Semester 3
        subjects_data = [
            ("Data Structures & Algorithms", "CS301", "HYBRID", 4, 3, "Arrays, Linked Lists, Trees, Graphs, Sorting, Dynamic Programming."),
            ("Advanced Python Programming", "CS302", "PRACTICAL", 4, 3, "Object-oriented patterns, decorators, generators, async I/O, Web Frameworks."),
            ("Database Management Systems", "CS303", "THEORY", 4, 3, "Relational algebra, SQL, Normalization, ACID transactions, Indexing."),
            ("Computer Organization & Architecture", "CS304", "THEORY", 3, 3, "Instruction sets, Pipelining, Memory hierarchy, Cache coherence."),
            ("Software Engineering & Architecture", "CS305", "THEORY", 3, 3, "SDLC methodologies, Agile, UML modeling, Microservices, Clean Code."),
        ]

        subjects = {}
        for name, code, stype, creds, sem_num, syllabus in subjects_data:
            subj, _ = Subject.objects.get_or_create(
                course=btech_cse, code=code,
                defaults={
                    "college": apex_college, "department": apex_depts["CSE"],
                    "name": name, "subject_type": stype, "credits": creds,
                    "semester_number": sem_num, "syllabus": syllabus, "status": "ACTIVE"
                }
            )
            subjects[code] = subj

        # 10. Faculty Subject Assignments
        FacultySubject.objects.get_or_create(
            subject=subjects["CS301"], faculty=faculty_priya, batch=batch_2026, academic_year="2026-2027",
            defaults={"college": apex_college, "is_primary": True}
        )
        FacultySubject.objects.get_or_create(
            subject=subjects["CS302"], faculty=faculty_priya, batch=batch_2026, academic_year="2026-2027",
            defaults={"college": apex_college, "is_primary": True}
        )
        FacultySubject.objects.get_or_create(
            subject=subjects["CS303"], faculty=faculty_hod, batch=batch_2026, academic_year="2026-2027",
            defaults={"college": apex_college, "is_primary": True}
        )
        FacultySubject.objects.get_or_create(
            subject=subjects["CS304"], faculty=faculty_mentor, batch=batch_2026, academic_year="2026-2027",
            defaults={"college": apex_college, "is_primary": True}
        )
        FacultySubject.objects.get_or_create(
            subject=subjects["CS305"], faculty=faculty_mentor, batch=batch_2026, academic_year="2026-2027",
            defaults={"college": apex_college, "is_primary": True}
        )

        # 11. Timetable for Monday through Friday
        timetable_slots = [
            (time(9, 0), time(10, 0), "CS301", faculty_priya, "Hall 304"),
            (time(10, 15), time(11, 15), "CS304", faculty_mentor, "Seminar Hall 1"),
            (time(11, 30), time(12, 30), "CS303", faculty_hod, "Hall 201"),
            (time(14, 0), time(15, 30), "CS302", faculty_priya, "Computer Lab 2"),
        ]

        for day in range(1, 6):  # Monday to Friday
            for st, et, scode, fac, room in timetable_slots:
                TimetableEntry.objects.get_or_create(
                    course=btech_cse, batch=batch_2026, semester=sem3, subject=subjects[scode],
                    faculty=fac, day_of_week=day, start_time=st, end_time=et,
                    defaults={"college": apex_college, "room": room}
                )

        # 12. Examinations & Results
        exam_midterm, _ = Exam.objects.get_or_create(
            batch=batch_2026, semester=sem3, name="Mid-Term Examination Fall 2026",
            defaults={
                "college": apex_college, "exam_type": "INTERNAL",
                "start_date": date(2026, 9, 1), "end_date": date(2026, 9, 5),
                "is_published": True, "status": "COMPLETED",
                "description": "Mid-term comprehensive assessments covering modules 1 & 2."
            }
        )

        es_cs301, _ = ExamSubject.objects.get_or_create(
            exam=exam_midterm, subject=subjects["CS301"],
            defaults={"exam_date": date(2026, 9, 1), "start_time": time(10, 0), "end_time": time(12, 0), "maximum_marks": 100, "passing_marks": 40, "room": "Hall 304"}
        )
        es_cs302, _ = ExamSubject.objects.get_or_create(
            exam=exam_midterm, subject=subjects["CS302"],
            defaults={"exam_date": date(2026, 9, 2), "start_time": time(10, 0), "end_time": time(12, 0), "maximum_marks": 100, "passing_marks": 40, "room": "Computer Lab 2"}
        )
        es_cs303, _ = ExamSubject.objects.get_or_create(
            exam=exam_midterm, subject=subjects["CS303"],
            defaults={"exam_date": date(2026, 9, 3), "start_time": time(10, 0), "end_time": time(12, 0), "maximum_marks": 100, "passing_marks": 40, "room": "Hall 201"}
        )

        # Results for Rahul Kumar
        Result.objects.get_or_create(
            exam_subject=es_cs301, student=student_rahul,
            defaults={"college": apex_college, "marks_obtained": 88.0, "grade": "A", "entered_by": users["faculty.priya@apex.edu"]}
        )
        Result.objects.get_or_create(
            exam_subject=es_cs302, student=student_rahul,
            defaults={"college": apex_college, "marks_obtained": 94.0, "grade": "A+", "entered_by": users["faculty.priya@apex.edu"]}
        )
        Result.objects.get_or_create(
            exam_subject=es_cs303, student=student_rahul,
            defaults={"college": apex_college, "marks_obtained": 82.0, "grade": "A", "entered_by": users["hod.cs@apex.edu"]}
        )

        # Results for Ananya Sen
        Result.objects.get_or_create(
            exam_subject=es_cs301, student=student_ananya,
            defaults={"college": apex_college, "marks_obtained": 91.0, "grade": "A+", "entered_by": users["faculty.priya@apex.edu"]}
        )
        Result.objects.get_or_create(
            exam_subject=es_cs302, student=student_ananya,
            defaults={"college": apex_college, "marks_obtained": 89.0, "grade": "A", "entered_by": users["faculty.priya@apex.edu"]}
        )

        # 13. Assignments & Submissions
        assign1, _ = Assignment.objects.get_or_create(
            subject=subjects["CS301"], faculty=faculty_priya, batch=batch_2026, title="Implement Balanced AVL Search Trees",
            defaults={
                "college": apex_college,
                "description": "Construct an auto-balancing AVL tree in C++ or Python. Implement LL, RR, LR, and RL rotations. Include unit tests for randomized insertions.",
                "maximum_marks": 100,
                "due_date": timezone.now() - timedelta(days=2),
                "status": "ACTIVE"
            }
        )

        assign2, _ = Assignment.objects.get_or_create(
            subject=subjects["CS303"], faculty=faculty_hod, batch=batch_2026, title="Relational Schema Normalization & Query Tuning",
            defaults={
                "college": apex_college,
                "description": "Normalize the provided University ERP schema into 3NF/BCNF. Write EXPLAIN ANALYZE queries demonstrating index efficiency on compound foreign keys.",
                "maximum_marks": 100,
                "due_date": timezone.now() + timedelta(days=4),
                "status": "ACTIVE"
            }
        )

        # Submission for Rahul Kumar (Graded)
        AssignmentSubmission.objects.get_or_create(
            assignment=assign1, student=student_rahul,
            defaults={
                "file_url": "https://campyteq.local/storage/assignments/rahul_avl_tree.pdf",
                "submission_text": "Completed AVL balancing routines with recursive height recomputation and 100% test coverage.",
                "status": "GRADED",
                "marks_awarded": 92.0,
                "feedback": "Outstanding implementation of rotation algorithms and clean amortized analysis.",
                "graded_by": faculty_priya,
                "graded_at": timezone.now() - timedelta(days=1)
            }
        )

        # 14. Phase 4: Attendance Management Data
        # Create 10 lecture sessions over the past two weeks
        base_date = date.today() - timedelta(days=12)
        session_configs = [
            (subjects["CS301"], faculty_priya, time(9, 0), time(10, 0), "Binary Search Trees & Balancing", "REGULAR"),
            (subjects["CS302"], faculty_priya, time(14, 0), time(15, 30), "Python Asyncio & Concurrency", "LAB"),
            (subjects["CS303"], faculty_hod, time(11, 30), time(12, 30), "Relational Algebra & Normal Forms", "REGULAR"),
            (subjects["CS304"], faculty_mentor, time(10, 15), time(11, 15), "Pipelining & Branch Prediction", "REGULAR"),
            (subjects["CS301"], faculty_priya, time(9, 0), time(10, 0), "Graph Traversals DFS/BFS", "REGULAR"),
            (subjects["CS302"], faculty_priya, time(14, 0), time(15, 30), "FastAPI REST Endpoints", "LAB"),
            (subjects["CS303"], faculty_hod, time(11, 30), time(12, 30), "ACID Transactions & Isolation Levels", "REGULAR"),
            (subjects["CS304"], faculty_mentor, time(10, 15), time(11, 15), "Memory Hierarchy & Caching", "REGULAR"),
            (subjects["CS301"], faculty_priya, time(9, 0), time(10, 0), "Dijkstra and A* Shortest Path", "REGULAR"),
            (subjects["CS305"], faculty_mentor, time(12, 0), time(13, 0), "Clean Architecture & Domain Driven Design", "REGULAR"),
        ]

        created_sessions = []
        for idx, (subj, fac, st, et, topic, stype) in enumerate(session_configs):
            s_date = base_date + timedelta(days=idx)
            # Skip Sunday
            if s_date.weekday() == 6:
                s_date += timedelta(days=1)
            sess, _ = AttendanceSession.objects.get_or_create(
                subject=subj,
                semester=sem3,
                date=s_date,
                start_time=st,
                defaults={
                    "college": apex_college,
                    "faculty": fac,
                    "end_time": et,
                    "session_type": stype,
                    "topic_covered": topic,
                }
            )
            created_sessions.append(sess)

        # Mark Student Attendance:
        # Rahul Kumar: 9 Present, 1 Late (100% attendance rate)
        # Ananya Sen: 8 Present, 1 Excused, 1 Absent (90% attendance rate)
        # Rohan Gupta: 4 Present, 6 Absent (40% attendance rate -> Defaulter Alert!)
        for i, sess in enumerate(created_sessions):
            # Rahul
            r_status = "LATE" if i == 2 else "PRESENT"
            StudentAttendance.objects.get_or_create(
                session=sess, student=student_rahul,
                defaults={"college": apex_college, "status": r_status, "marked_by": sess.faculty.user}
            )
            # Ananya
            a_status = "ABSENT" if i == 4 else ("EXCUSED" if i == 7 else "PRESENT")
            StudentAttendance.objects.get_or_create(
                session=sess, student=student_ananya,
                defaults={"college": apex_college, "status": a_status, "marked_by": sess.faculty.user}
            )
            # Rohan (Defaulter)
            ro_status = "PRESENT" if i in [0, 1, 5, 8] else "ABSENT"
            StudentAttendance.objects.get_or_create(
                session=sess, student=student_rohan,
                defaults={
                    "college": apex_college,
                    "status": ro_status,
                    "marked_by": sess.faculty.user,
                    "remarks": "Frequent unexcused absence" if ro_status == "ABSENT" else ""
                }
            )

        # Faculty Attendance (Punches & Working Hours)
        today = date.today()
        # Priya Nair: Today checked in at 08:55, checked out at 17:30 (515 mins = 8h 35m)
        FacultyAttendance.objects.get_or_create(
            faculty=faculty_priya, date=today,
            defaults={
                "college": apex_college,
                "check_in": time(8, 55),
                "check_out": time(17, 30),
                "punch_source": "WEB_PORTAL",
                "status": "PRESENT",
                "remarks": "On campus full day lectures and lab supervision.",
            }
        )
        # Anil Verma: Today checked in at 09:10
        FacultyAttendance.objects.get_or_create(
            faculty=faculty_mentor, date=today,
            defaults={
                "college": apex_college,
                "check_in": time(9, 10),
                "check_out": None,
                "punch_source": "WEB_PORTAL",
                "status": "PRESENT",
                "remarks": "Morning mentor reviews and lecture.",
            }
        )

        # Past days faculty attendance
        for day_offset in range(1, 6):
            past_d = today - timedelta(days=day_offset)
            if past_d.weekday() < 5:  # Mon-Fri
                FacultyAttendance.objects.get_or_create(
                    faculty=faculty_priya, date=past_d,
                    defaults={
                        "college": apex_college,
                        "check_in": time(9, 0),
                        "check_out": time(17, 15),
                        "punch_source": "BIOMETRIC",
                        "status": "PRESENT",
                    }
                )
                FacultyAttendance.objects.get_or_create(
                    faculty=faculty_mentor, date=past_d,
                    defaults={
                        "college": apex_college,
                        "check_in": time(9, 5),
                        "check_out": time(17, 0),
                        "punch_source": "BIOMETRIC",
                        "status": "PRESENT",
                    }
                )

        # 15. Phase 5: Finance, Fees, Invoices & Payments
        # Fee Categories
        cat_tuition, _ = FeeCategory.objects.get_or_create(
            college=apex_college, code="TUITION",
            defaults={"name": "Academic Tuition Fee", "description": "Core course semester tuition and classroom instruction fee"}
        )
        cat_lab, _ = FeeCategory.objects.get_or_create(
            college=apex_college, code="LAB",
            defaults={"name": "Laboratory & Practical Consumables", "description": "Computing and hardware laboratory usage fee"}
        )
        cat_lib, _ = FeeCategory.objects.get_or_create(
            college=apex_college, code="LIBRARY",
            defaults={"name": "Digital & Physical Library Fee", "description": "Access to IEEE Xplore, journals, and campus library"}
        )

        # Fee Structure for B.Tech Semester 3
        fee_struct, _ = FeeStructure.objects.get_or_create(
            college=apex_college, course=btech_cse, semester_number=3, academic_year="2026-2027",
            defaults={
                "batch": batch_2026,
                "title": "B.Tech CSE - Semester 3 Standard Academic Fee",
                "total_amount": Decimal("55000.00"),
                "breakdown": {
                    "Tuition Fee": 45000,
                    "Computer Laboratory Fee": 5000,
                    "Library & Digital Access": 2500,
                    "Examination Fee": 2500,
                }
            }
        )

        # Student Invoices:
        # 1. Rahul Kumar: Paid ₹55,000 via UPI (Fully Paid)
        inv_rahul, _ = StudentInvoice.objects.get_or_create(
            college=apex_college, student=student_rahul, title="B.Tech CSE Sem 3 Regular Tuition",
            defaults={
                "invoice_number": "INV-2026-00101",
                "fee_structure": fee_struct,
                "subtotal": Decimal("55000.00"),
                "discount_amount": Decimal("0.00"),
                "final_amount": Decimal("55000.00"),
                "paid_amount": Decimal("55000.00"),
                "balance_due": Decimal("0.00"),
                "due_date": date(2026, 8, 30),
                "status": "PAID",
                "remarks": "Tuition fees paid in full on registration."
            }
        )
        pay_rahul, _ = Payment.objects.get_or_create(
            college=apex_college, invoice=inv_rahul, student=student_rahul,
            defaults={
                "amount": Decimal("55000.00"),
                "payment_method": "UPI",
                "transaction_reference": "UPI/20260815/99881122",
                "status": "SUCCESS",
                "received_by": users["principal@apex.edu"],
                "remarks": "Verified via Bank UPI Settlement Gateway."
            }
        )
        PaymentReceipt.objects.get_or_create(
            college=apex_college, payment=pay_rahul, student=student_rahul, invoice=inv_rahul,
            defaults={"receipt_number": "RCP-2026-00101"}
        )

        # 2. Ananya Sen: Partially Paid ₹30,000 (Balance: ₹25,000)
        inv_ananya, _ = StudentInvoice.objects.get_or_create(
            college=apex_college, student=student_ananya, title="B.Tech CSE Sem 3 Regular Tuition",
            defaults={
                "invoice_number": "INV-2026-00102",
                "fee_structure": fee_struct,
                "subtotal": Decimal("55000.00"),
                "discount_amount": Decimal("0.00"),
                "final_amount": Decimal("55000.00"),
                "paid_amount": Decimal("30000.00"),
                "balance_due": Decimal("25000.00"),
                "due_date": date(2026, 9, 15),
                "status": "PARTIALLY_PAID",
                "remarks": "First installment paid via NetBanking. Balance due before mid-terms."
            }
        )
        pay_ananya, _ = Payment.objects.get_or_create(
            college=apex_college, invoice=inv_ananya, student=student_ananya,
            defaults={
                "amount": Decimal("30000.00"),
                "payment_method": "NET_BANKING",
                "transaction_reference": "HDFC-NEFT-88331100",
                "status": "SUCCESS",
                "received_by": users["principal@apex.edu"],
                "remarks": "Part payment installment 1"
            }
        )
        PaymentReceipt.objects.get_or_create(
            college=apex_college, payment=pay_ananya, student=student_ananya, invoice=inv_ananya,
            defaults={"receipt_number": "RCP-2026-00102"}
        )

        # 3. Rohan Gupta: Unpaid / Overdue (Balance: ₹55,000)
        StudentInvoice.objects.get_or_create(
            college=apex_college, student=student_rohan, title="B.Tech CSE Sem 3 Regular Tuition",
            defaults={
                "invoice_number": "INV-2026-00103",
                "fee_structure": fee_struct,
                "subtotal": Decimal("55000.00"),
                "discount_amount": Decimal("0.00"),
                "final_amount": Decimal("55000.00"),
                "paid_amount": Decimal("0.00"),
                "balance_due": Decimal("55000.00"),
                "due_date": date(2026, 8, 25),
                "status": "OVERDUE",
                "remarks": "Payment pending notice dispatched to registered guardian."
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeded Phase 5: Fee Categories, Fee Structures, Invoices, Payments, and Receipts."))

        # ==========================================
        # Phase 6: Communication & Leave Management
        # ==========================================
        self.stdout.write(self.style.NOTICE("==> Seeding Phase 6 Communication & Leave Management Data..."))

        # 1. Announcements
        ann_1, _ = Announcement.objects.get_or_create(
            college=apex_college,
            title="Annual Tech Symposium & Hackathon 2026",
            defaults={
                "content": "Apex Institute of Technology is pleased to announce HackApex 2026 on October 24-25. Registrations are open for students of all engineering departments.",
                "category": Announcement.Category.EVENT,
                "priority": Announcement.Priority.HIGH,
                "target_audience": Announcement.TargetAudience.ENTIRE_COLLEGE,
                "created_by": users["principal@apex.edu"],
                "is_pinned": True,
            }
        )

        ann_2, _ = Announcement.objects.get_or_create(
            college=apex_college,
            title="Mid-Term & End-Semester Examination Schedules Released",
            defaults={
                "content": "The exam timetables for Semester 3 and Semester 5 have been published on the student portal. Download your hall tickets starting next Monday.",
                "category": Announcement.Category.EXAM,
                "priority": Announcement.Priority.URGENT,
                "target_audience": Announcement.TargetAudience.STUDENTS_ONLY,
                "created_by": faculty_hod.user,
                "is_pinned": True,
            }
        )

        ann_3, _ = Announcement.objects.get_or_create(
            college=apex_college,
            title="Faculty Development Program: Generative AI & Autonomous Agents",
            defaults={
                "content": "A 3-day Faculty Development Workshop will be conducted in Seminar Hall B from Oct 5-7. All Computer Science faculty members are encouraged to attend.",
                "category": Announcement.Category.ACADEMIC,
                "priority": Announcement.Priority.NORMAL,
                "target_audience": Announcement.TargetAudience.FACULTY_ONLY,
                "created_by": faculty_hod.user,
            }
        )

        ann_4, _ = Announcement.objects.get_or_create(
            college=apex_college,
            title="CSE Department: Capstone Project Phase 1 Synopsis Submission",
            defaults={
                "content": "All B.Tech CSE Semester 3 students must submit their capstone synopsis report in PDF format to their respective mentors by Friday 5:00 PM.",
                "category": Announcement.Category.ACADEMIC,
                "priority": Announcement.Priority.HIGH,
                "target_audience": Announcement.TargetAudience.DEPARTMENT,
                "department": apex_depts["CSE"],
                "created_by": faculty_mentor.user,
            }
        )

        # 2. Notifications
        notifications_data = [
            (student_rahul.user, "Fee Payment Confirmed", "Your Semester 3 Tuition fee payment of ₹75,000 was processed successfully (RCP-2026-0001).", Notification.NotificationType.PAYMENT_SUCCESS, "/dashboard/finance"),
            (student_rahul.user, "Internal Exam Results Published", "Mid-term examination grades for Data Structures & Python Lab are now available.", Notification.NotificationType.EXAM_RESULT, "/dashboard/academics"),
            (student_rahul.user, "Leave Approved", "Your leave request for Hackathon attendance was approved by Prof. Anil Verma.", Notification.NotificationType.LEAVE_STATUS, "/dashboard/leave"),
            (student_rohan.user, "Attendance Shortage Alert", "Your current attendance is 40.0%, which is below the mandatory 75% threshold. Please meet your mentor immediately.", Notification.NotificationType.ATTENDANCE_ALERT, "/dashboard/attendance"),
            (faculty_mentor.user, "Leave Request Pending Review", "Student Ananya Sen submitted a casual leave application for review.", Notification.NotificationType.LEAVE_STATUS, "/dashboard/leave"),
            (faculty_priya.user, "New Announcement: AI Faculty Program", "A new FDP notice has been published by HOD Dr. Aruna Sundaram.", Notification.NotificationType.ANNOUNCEMENT, "/dashboard/announcements"),
        ]

        for u, title, msg, n_type, action_url in notifications_data:
            Notification.objects.get_or_create(
                college=apex_college,
                recipient=u,
                title=title,
                defaults={
                    "message": msg,
                    "notification_type": n_type,
                    "action_url": action_url,
                    "is_read": False,
                }
            )

        # 4. Documents & Certificates
        Document.objects.get_or_create(
            college=apex_college,
            title="Bonafide Certificate — Rahul Kumar",
            defaults={
                "document_type": Document.DocumentType.BONAFIDE_CERTIFICATE,
                "student": student_rahul,
                "uploaded_by": faculty_hod.user,
                "file_url": "/documents/bonafide_APEX_2025_001.pdf",
                "status": Document.VerificationStatus.VERIFIED,
                "issued_date": date(2026, 8, 15),
            }
        )
        Document.objects.get_or_create(
            college=apex_college,
            title="Official Grade Sheet (Semester 2) — Rahul Kumar",
            defaults={
                "document_type": Document.DocumentType.GRADE_SHEET,
                "student": student_rahul,
                "uploaded_by": faculty_hod.user,
                "file_url": "/documents/gradesheet_sem2_APEX_2025_001.pdf",
                "status": Document.VerificationStatus.VERIFIED,
                "issued_date": date(2026, 7, 20),
            }
        )
        Document.objects.get_or_create(
            college=apex_college,
            title="B.Tech Computer Science Syllabus & Curriculum Regulations (2025-2029)",
            defaults={
                "document_type": Document.DocumentType.SYLLABUS_COPY,
                "uploaded_by": users["principal@apex.edu"],
                "file_url": "/documents/syllabus_cse_2025_2029.pdf",
                "status": Document.VerificationStatus.VERIFIED,
                "issued_date": date(2025, 8, 1),
            }
        )
        Document.objects.get_or_create(
            college=apex_college,
            title="Bonafide Certificate Request — Rohan Gupta",
            defaults={
                "document_type": Document.DocumentType.BONAFIDE_CERTIFICATE,
                "student": student_rohan,
                "uploaded_by": student_rohan.user,
                "file_url": "/documents/req_bonafide_APEX_2025_003.pdf",
                "status": Document.VerificationStatus.PENDING,
                "issued_date": date.today(),
            }
        )

        # 5. Leave Requests
        LeaveRequest.objects.get_or_create(
            college=apex_college,
            user=student_rahul.user,
            from_date=date(2026, 10, 10),
            to_date=date(2026, 10, 11),
            defaults={
                "leave_type": LeaveRequest.LeaveType.CASUAL,
                "reason": "Attending Smart India Hackathon zonal round at IIT Madras with college tech club.",
                "status": LeaveRequest.LeaveStatus.APPROVED,
                "approved_by": faculty_mentor.user,
                "approval_remarks": "Granted. Valid inter-college competition event.",
                "reviewed_at": timezone.now(),
            }
        )

        LeaveRequest.objects.get_or_create(
            college=apex_college,
            user=student_ananya.user,
            from_date=date.today() + timedelta(days=2),
            to_date=date.today() + timedelta(days=3),
            defaults={
                "leave_type": LeaveRequest.LeaveType.PERSONAL,
                "reason": "Attending family function out of state.",
                "status": LeaveRequest.LeaveStatus.PENDING,
            }
        )

        LeaveRequest.objects.get_or_create(
            college=apex_college,
            user=faculty_priya.user,
            from_date=date(2026, 10, 15),
            to_date=date(2026, 10, 16),
            defaults={
                "leave_type": LeaveRequest.LeaveType.ACADEMIC_DUTY,
                "reason": "Presenting research paper titled 'Multi-Tenant Microservice Resilience' at IEEE CloudCon 2026.",
                "status": LeaveRequest.LeaveStatus.APPROVED,
                "approved_by": faculty_hod.user,
                "approval_remarks": "Approved with recommendation for duty leave.",
                "reviewed_at": timezone.now(),
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeded Phase 6: Announcements, Notifications, Messages, Documents, and Leave Requests."))

        # ==========================================
        # Phase 7: Campus Print Shop & Library
        # ==========================================
        self.stdout.write(self.style.NOTICE("==> Seeding Phase 7 Print Shop & Library Data..."))

        # 1. Print Pricing
        pricing_apex, _ = PrintPricing.objects.get_or_create(
            college=apex_college,
            defaults={
                "bw_per_page": Decimal("2.00"),
                "color_per_page": Decimal("10.00"),
                "duplex_discount_percent": Decimal("10.00"),
                "spiral_binding_cost": Decimal("30.00"),
                "hard_binding_cost": Decimal("150.00"),
                "lamination_per_page": Decimal("15.00"),
            }
        )

        # 2. Print Orders
        # Order 1: Algorithms Lab Manual for Rahul
        po1, _ = PrintOrder.objects.get_or_create(
            college=apex_college,
            order_number="PRT-20260901-A491F0",
            defaults={
                "user": student_rahul.user,
                "document_name": "CS301_Algorithms_Lab_Manual_Full.pdf",
                "file_url": "/printshop/CS301_Algorithms_Lab_Manual_Full.pdf",
                "page_count": 35,
                "copies": 1,
                "print_color": PrintOrder.PrintColor.BW,
                "print_side": PrintOrder.PrintSide.DUPLEX,
                "paper_size": PrintOrder.PaperSize.A4,
                "binding_type": PrintOrder.BindingType.SPIRAL,
                "lamination": False,
                "special_instructions": "Please bind with transparent plastic sheet on front and blue card on back.",
                "total_amount": Decimal("93.00"),
                "payment_status": PrintOrder.PaymentStatus.PAID,
                "status": PrintOrder.OrderStatus.READY_FOR_PICKUP,
                "handled_by": users["printstaff.dev@apex.edu"],
            }
        )

        # Order 2: Hackathon Presentation Deck for Rahul
        po2, _ = PrintOrder.objects.get_or_create(
            college=apex_college,
            order_number="PRT-20260902-88B1C2",
            defaults={
                "user": student_rahul.user,
                "document_name": "SmartIndiaHackathon_PitchDeck_Final.pdf",
                "file_url": "/printshop/SmartIndiaHackathon_PitchDeck_Final.pdf",
                "page_count": 12,
                "copies": 3,
                "print_color": PrintOrder.PrintColor.COLOR,
                "print_side": PrintOrder.PrintSide.SINGLE,
                "paper_size": PrintOrder.PaperSize.A4,
                "binding_type": PrintOrder.BindingType.STAPLE,
                "lamination": False,
                "special_instructions": "High quality glossy print for jury review.",
                "total_amount": Decimal("360.00"),
                "payment_status": PrintOrder.PaymentStatus.PAID,
                "status": PrintOrder.OrderStatus.COMPLETED,
                "handled_by": users["printstaff.dev@apex.edu"],
                "completed_at": timezone.now() - timedelta(days=2),
            }
        )

        # Order 3: Mid-Term Question Paper Copies for Prof. Priya
        po3, _ = PrintOrder.objects.get_or_create(
            college=apex_college,
            order_number="PRT-20260906-44D991",
            defaults={
                "user": faculty_priya.user,
                "document_name": "CS301_MidTerm_Exam_Questions_Sept2026.pdf",
                "file_url": "/printshop/CS301_MidTerm_Exam_Questions_Sept2026.pdf",
                "page_count": 4,
                "copies": 60,
                "print_color": PrintOrder.PrintColor.BW,
                "print_side": PrintOrder.PrintSide.DUPLEX,
                "paper_size": PrintOrder.PaperSize.A4,
                "binding_type": PrintOrder.BindingType.STAPLE,
                "lamination": False,
                "special_instructions": "Confidential exam print. Keep sealed in yellow envelope.",
                "total_amount": Decimal("432.00"),
                "payment_status": PrintOrder.PaymentStatus.PAID,
                "status": PrintOrder.OrderStatus.PRINTING,
                "handled_by": users["printstaff.dev@apex.edu"],
            }
        )

        # Order 4: Queued Assignment Submission for Rahul
        po4, _ = PrintOrder.objects.get_or_create(
            college=apex_college,
            order_number="PRT-20260906-90EF31",
            defaults={
                "user": student_rahul.user,
                "document_name": "Distributed_Systems_Assignment_2.pdf",
                "file_url": "/printshop/Distributed_Systems_Assignment_2.pdf",
                "page_count": 8,
                "copies": 1,
                "print_color": PrintOrder.PrintColor.BW,
                "print_side": PrintOrder.PrintSide.SINGLE,
                "paper_size": PrintOrder.PaperSize.A4,
                "binding_type": PrintOrder.BindingType.STAPLE,
                "lamination": False,
                "special_instructions": "",
                "total_amount": Decimal("16.00"),
                "payment_status": PrintOrder.PaymentStatus.ON_PICKUP,
                "status": PrintOrder.OrderStatus.QUEUED,
            }
        )

        # 3. Library Bookings (Section 8 spec: Faculty requests, LIBRARY_FACULTY approves/rejects)
        LibraryBooking.objects.get_or_create(
            college=apex_college,
            requested_by=faculty_ramesh,
            date=date.today() + timedelta(days=2),
            start_time="10:00:00",
            end_time="12:00:00",
            defaults={
                "purpose": "Digital Library CS Research Session",
                "status": LibraryBooking.Status.APPROVED,
                "decided_by": users["librarystaff.anita@apex.edu"],
                "decided_at": timezone.now(),
            }
        )

        LibraryBooking.objects.get_or_create(
            college=apex_college,
            requested_by=faculty_priya,
            date=date.today() + timedelta(days=3),
            start_time="14:00:00",
            end_time="16:00:00",
            defaults={
                "purpose": "Algorithm Study Circle",
                "status": LibraryBooking.Status.PENDING,
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeded Phase 7: Print Pricing, Print Queue Orders, and Library Bookings."))

        # =========================================================================
        # PHASE 8: AI / COMPUTER VISION CAMERA INTELLIGENCE & SECURITY
        # =========================================================================
        self.stdout.write(self.style.NOTICE("==> Seeding Phase 8: Camera Zones, Stationary Cameras, Biometrics, and Sighting Detections..."))

        # 1. Camera Zones
        zones_data = [
            ("ZONE-GATE-1", "Main Entrance Gate 1", "Gatehouse & Security Checkpoint", 0, "Primary campus vehicular and pedestrian turnstile gate."),
            ("ZONE-BLKA-ENT", "Block A Foyer & Main Entrance", "Academic Block A", 0, "Central reception and student circulation foyer on Ground Floor."),
            ("ZONE-CR-204", "Classroom 204 (CSE Lecture Hall)", "Academic Block A", 2, "Senior undergraduate multimedia lecture theater."),
            ("ZONE-CSE-LAB2", "Computer Science Systems Lab 2", "Academic Block A", 2, "Specialized High-Performance Computing & Software Systems Laboratory."),
            ("ZONE-LIB-ENT", "Central Library Turnstiles", "Learning Resource Center", 1, "Turnstile entrance and circulation desk foyer."),
            ("ZONE-CAFE", "Central Cafeteria Quadrangle", "Student Center", 0, "Open dining space and student recreational courtyard."),
        ]

        created_zones = {}
        for code, name, bldg, flr, desc in zones_data:
            zone, _ = CameraZone.objects.get_or_create(
                college=apex_college,
                code=code,
                defaults={
                    "name": name,
                    "building": bldg,
                    "floor": flr,
                    "description": desc,
                    "is_active": True,
                }
            )
            created_zones[code] = zone

        # 2. Stationary Cameras
        cameras_data = [
            ("CAM-GATE-01", "Gate 1 Inbound HD-1", "ZONE-GATE-1", "BULLET", "192.168.10.11", "rtsp://edge.apex.edu:554/live/gate-01-in", "Overhead gantry facing north inbound pedestrian walkway", "ONLINE", 30, "1080p"),
            ("CAM-GATE-02", "Gate 1 Outbound HD-2", "ZONE-GATE-1", "BULLET", "192.168.10.12", "rtsp://edge.apex.edu:554/live/gate-02-out", "Overhead gantry facing south outbound vehicle lane", "ONLINE", 30, "1080p"),
            ("CAM-BLKA-01", "Block A Foyer Overview", "ZONE-BLKA-ENT", "DOME", "192.168.10.21", "rtsp://edge.apex.edu:554/live/blka-foyer", "Ceiling-mounted 360 wide-angle dome facing main staircase", "ONLINE", 30, "1080p"),
            ("CAM-CR204-01", "Classroom 204 Front View", "ZONE-CR-204", "DOME", "192.168.10.31", "rtsp://edge.apex.edu:554/live/cr204-front", "Mounted adjacent to smart podium facing lecture seating rows", "ONLINE", 25, "1080p"),
            ("CAM-LAB2-01", "CSE Lab 2 Interior North", "ZONE-CSE-LAB2", "DOME", "192.168.10.41", "rtsp://edge.apex.edu:554/live/lab2-north", "North aisle monitoring workstation rows 1 through 6", "ONLINE", 30, "1080p"),
            ("CAM-LAB2-02", "CSE Lab 2 Interior South", "ZONE-CSE-LAB2", "DOME", "192.168.10.42", "rtsp://edge.apex.edu:554/live/lab2-south", "South aisle monitoring workstation rows 7 through 12", "ONLINE", 30, "1080p"),
            ("CAM-LIB-01", "Library Turnstile Scanner", "ZONE-LIB-ENT", "PTZ", "192.168.10.51", "rtsp://edge.apex.edu:554/live/lib-entry", "Turnstile speed-gate face capture camera", "ONLINE", 30, "1080p"),
            ("CAM-CAFE-01", "Cafeteria Courtyard East", "ZONE-CAFE", "FISHEYE", "192.168.10.61", "rtsp://edge.apex.edu:554/live/cafe-east", "Courtyard canopy monitoring seating area", "MAINTENANCE", 15, "1080p"),
        ]

        created_cameras = {}
        now = timezone.now()
        for ccode, cname, zcode, ctype, ip, rtsp, loc_desc, cstatus, fps, res in cameras_data:
            cam, _ = Camera.objects.get_or_create(
                college=apex_college,
                code=ccode,
                defaults={
                    "name": cname,
                    "zone": created_zones[zcode],
                    "camera_type": ctype,
                    "ip_address": ip,
                    "rtsp_url": rtsp,
                    "location_description": loc_desc,
                    "status": cstatus,
                    "last_heartbeat": now - timedelta(minutes=2) if cstatus == "ONLINE" else now - timedelta(days=2),
                    "fps": fps,
                    "resolution": res,
                    "is_active": True,
                }
            )
            created_cameras[ccode] = cam

        # 3. Biometric Profiles
        principal_officer = users["principal@apex.edu"]
        bio_students = [
            (student_rahul, "e9b4f2c019a778e3451bcdae8902ff31245a7b8c9d0e1f2a3b4c5d6e7f8a9b0c", "ACTIVE"),
            (student_ananya, "7d8a9b0c1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b", "ACTIVE"),
            (student_rohan, "4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a", "ACTIVE"),
        ]

        for s_obj, f_hash, b_status in bio_students:
            BiometricProfile.objects.get_or_create(
                college=apex_college,
                student=s_obj,
                defaults={
                    "status": b_status,
                    "enrolled_by": principal_officer,
                    "representation_hash": f_hash,
                    "notes": f"Institutional biometric facial template verified during academic onboarding.",
                }
            )

        # 4. Realistic Detection Events for Rahul Kumar (Chronological Morning Breadcrumbs)
        # Spec from prompt:
        # 08:48 -> Main Entrance (Gate 1)
        # 09:05 -> Classroom 204
        # 09:26 -> Block A Corridor / Foyer
        # 09:42 -> Computer Lab 2
        today_morning = timezone.now().replace(hour=8, minute=48, second=0, microsecond=0)
        rahul_sightings = [
            ("CAM-GATE-01", "ZONE-GATE-1", today_morning, Decimal("0.9740"), "FACE_RECOGNITION"),
            ("CAM-CR204-01", "ZONE-CR-204", today_morning + timedelta(minutes=17), Decimal("0.9680"), "FACE_RECOGNITION"),
            ("CAM-BLKA-01", "ZONE-BLKA-ENT", today_morning + timedelta(minutes=38), Decimal("0.9520"), "PASSING_DETECTION"),
            ("CAM-LAB2-01", "ZONE-CSE-LAB2", today_morning + timedelta(minutes=54), Decimal("0.9860"), "FACE_RECOGNITION"),
        ]

        for cam_code, z_code, d_time, conf, ev_type in rahul_sightings:
            DetectionEvent.objects.get_or_create(
                college=apex_college,
                camera=created_cameras[cam_code],
                zone=created_zones[z_code],
                student=student_rahul,
                detected_at=d_time,
                defaults={
                    "confidence_score": conf,
                    "event_type": ev_type,
                    "processing_status": "PROCESSED",
                    "snapshot_url": f"/media/detections/{student_rahul.student_number}_{cam_code}.jpg",
                }
            )

        # Set Rahul Kumar's Latest Location to CSE Lab 2
        StudentLatestLocation.objects.update_or_create(
            student=student_rahul,
            defaults={
                "college": apex_college,
                "camera": created_cameras["CAM-LAB2-01"],
                "zone": created_zones["ZONE-CSE-LAB2"],
                "detected_at": today_morning + timedelta(minutes=54),
                "confidence_score": Decimal("0.9860"),
            }
        )

        # Ananya Sen: Detected at Library Turnstile at 09:15 AM
        ananya_time = today_morning + timedelta(minutes=27)
        DetectionEvent.objects.get_or_create(
            college=apex_college,
            camera=created_cameras["CAM-LIB-01"],
            zone=created_zones["ZONE-LIB-ENT"],
            student=student_ananya,
            detected_at=ananya_time,
            defaults={
                "confidence_score": Decimal("0.9810"),
                "event_type": "FACE_RECOGNITION",
                "processing_status": "PROCESSED",
            }
        )
        StudentLatestLocation.objects.update_or_create(
            student=student_ananya,
            defaults={
                "college": apex_college,
                "camera": created_cameras["CAM-LIB-01"],
                "zone": created_zones["ZONE-LIB-ENT"],
                "detected_at": ananya_time,
                "confidence_score": Decimal("0.9810"),
            }
        )

        # Rohan Gupta: Detected at Main Gate at 08:35 AM
        rohan_time = today_morning - timedelta(minutes=13)
        DetectionEvent.objects.get_or_create(
            college=apex_college,
            camera=created_cameras["CAM-GATE-01"],
            zone=created_zones["ZONE-GATE-1"],
            student=student_rohan,
            detected_at=rohan_time,
            defaults={
                "confidence_score": Decimal("0.9550"),
                "event_type": "FACE_RECOGNITION",
                "processing_status": "PROCESSED",
            }
        )
        StudentLatestLocation.objects.update_or_create(
            student=student_rohan,
            defaults={
                "college": apex_college,
                "camera": created_cameras["CAM-GATE-01"],
                "zone": created_zones["ZONE-GATE-1"],
                "detected_at": rohan_time,
                "confidence_score": Decimal("0.9550"),
            }
        )

        # 5. Tracking Access Logs (Sample Privacy Audit Records)
        mentor_anil = users["mentor.anil@apex.edu"]
        TrackingAccessLog.objects.get_or_create(
            college=apex_college,
            user=mentor_anil,
            student=student_rahul,
            action="SEARCH_LAST_SEEN",
            defaults={
                "reason": "Bi-weekly mentorship cohort progress check and attendance follow-up.",
                "ip_address": "192.168.1.104",
            }
        )

        TrackingAccessLog.objects.get_or_create(
            college=apex_college,
            user=users["hod.cs@apex.edu"],
            student=student_rohan,
            action="SEARCH_LAST_SEEN",
            defaults={
                "reason": "Department HOD security and student exam attendance check.",
                "ip_address": "192.168.10.5",
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeded Phase 8: Camera Zones, Cameras, Biometrics, Sighting Trajectories, and Privacy Audit Logs."))

        # =========================================================================
        # PHASE 9: REPORTS, ANALYTICS & AI STUDENT RISK EVALUATIONS
        # =========================================================================
        self.stdout.write(self.style.NOTICE("==> Seeding Phase 9: AI Academic Risk Early-Warning Assessments & Interventions..."))

        # 1. Rohan Gupta: High Risk (Attendance Defaulter 62.5%, 2 Missing Assignments)
        StudentAIAnalysis.objects.update_or_create(
            college=apex_college,
            student=student_rohan,
            is_latest=True,
            defaults={
                "risk_level": "HIGH",
                "score": Decimal("76.00"),
                "analysis_type": "ACADEMIC_EARLY_WARNING",
                "attendance_rate": Decimal("62.50"),
                "missing_assignments_count": 2,
                "average_marks_percentage": Decimal("52.00"),
                "leave_days_count": 3,
                "key_risk_drivers": [
                    "Chronic attendance shortage: current attendance is 62.5% (defaulter under mandatory 75% statutory rule).",
                    "2 mandatory coursework assignments are missing or unsubmitted in Advanced Data Structures.",
                    "Below-average examination performance: midterm exam average is 52.0%.",
                    "Outstanding overdue library fine (₹55.00) pending settlement."
                ],
                "suggested_interventions": [
                    "Schedule mandatory 1-on-1 mentor academic review & counseling session.",
                    "Enroll in departmental remedial tutorial classes in Data Structures.",
                    "Issue formal attendance advisory letter to parent/guardian regarding exam eligibility.",
                    "Settle outstanding campus library fine to release grade card hold."
                ],
                "input_snapshot": {
                    "total_attendance_sessions": 24,
                    "present_sessions": 15,
                    "attendance_rate": 62.50,
                    "missing_assignments": 2,
                    "average_marks": 52.00,
                    "total_leave_days": 3,
                },
                "reviewed_by": None,
                "reviewed_at": None,
                "review_notes": "",
                "review_action_taken": "",
            }
        )

        # 2. Rahul Kumar: Medium Risk (Reviewed by Mentor Anil Verma)
        StudentAIAnalysis.objects.update_or_create(
            college=apex_college,
            student=student_rahul,
            is_latest=True,
            defaults={
                "risk_level": "MEDIUM",
                "score": Decimal("46.50"),
                "analysis_type": "ACADEMIC_EARLY_WARNING",
                "attendance_rate": Decimal("78.40"),
                "missing_assignments_count": 1,
                "average_marks_percentage": Decimal("68.00"),
                "leave_days_count": 2,
                "key_risk_drivers": [
                    "Marginal attendance 78.4% approaching the mandatory 75% clearance threshold.",
                    "1 course assignment is overdue and unsubmitted in Algorithm Analysis.",
                    "Slight downward trend in recent Algorithms midterm test score."
                ],
                "suggested_interventions": [
                    "Conduct mentor check-in regarding pending coursework and lab assignments.",
                    "Recommend peer study group participation for upcoming evaluations."
                ],
                "input_snapshot": {
                    "total_attendance_sessions": 25,
                    "present_sessions": 19,
                    "attendance_rate": 78.40,
                    "missing_assignments": 1,
                    "average_marks": 68.00,
                    "total_leave_days": 2,
                },
                "reviewed_by": users["mentor.anil@apex.edu"],
                "reviewed_at": timezone.now() - timedelta(days=2),
                "review_notes": "Discussed lab submission backlog with Rahul during Tuesday mentorship hour. Student committed to submitting by Friday.",
                "review_action_taken": "COUNSELING_SCHEDULED",
            }
        )

        # 3. Ananya Sen: Low Risk (Excellent Standing, Reviewed)
        StudentAIAnalysis.objects.update_or_create(
            college=apex_college,
            student=student_ananya,
            is_latest=True,
            defaults={
                "risk_level": "LOW",
                "score": Decimal("12.00"),
                "analysis_type": "ACADEMIC_EARLY_WARNING",
                "attendance_rate": Decimal("94.20"),
                "missing_assignments_count": 0,
                "average_marks_percentage": Decimal("88.50"),
                "leave_days_count": 1,
                "key_risk_drivers": [
                    "Satisfactory attendance standing (94.2%).",
                    "Course assignments are completely up to date.",
                    "Strong academic examination trajectory (88.5% average)."
                ],
                "suggested_interventions": [
                    "Maintain existing academic consistency and attendance discipline.",
                    "Eligible for advanced research electives and honors hackathon track."
                ],
                "input_snapshot": {
                    "total_attendance_sessions": 26,
                    "present_sessions": 24,
                    "attendance_rate": 94.20,
                    "missing_assignments": 0,
                    "average_marks": 88.50,
                    "total_leave_days": 1,
                },
                "reviewed_by": users["mentor.anil@apex.edu"],
                "reviewed_at": timezone.now() - timedelta(days=5),
                "review_notes": "Excellent academic trajectory. Nominated for department competitive programming hackathon cohort.",
                "review_action_taken": "NO_ACTION",
            }
        )

        self.stdout.write(self.style.SUCCESS("Seeded Phase 9: AI Academic Risk Assessments, Explainable Drivers, and Mentor Reviews."))

        # 10. Facilities & Mentor Bookings
        seminar_hall, _ = Facility.objects.get_or_create(
            college=apex_college,
            name="APEX Central Seminar Hall",
            defaults={
                "facility_type": "SEMINAR_HALL",
                "capacity": 450,
                "location": "Academic Block A, 3rd Floor",
                "amenities": "Dolby Surround, Dual 4K Projectors, Stage Lighting, AC",
                "description": "State-of-the-art auditorium for symposiums, guest keynotes, and academic conferences.",
                "is_active": True,
            }
        )

        sports_turf, _ = Facility.objects.get_or_create(
            college=apex_college,
            name="APEX Arena Sports Turf",
            defaults={
                "facility_type": "TURF",
                "capacity": 200,
                "location": "North Campus Sports Pavilion",
                "amenities": "Floodlights, All-Weather Synthetic AstroTurf, Player Dugouts",
                "description": "FIFA-approved multi-sport turf for football, box cricket, and athletic tournaments.",
                "is_active": True,
            }
        )

        # Sample bookings raised by Mentor Anil Verma
        mentor_user = users.get("mentor.anil@apex.edu")
        hod_user = users.get("hod.cs@apex.edu")
        cs_dept = Department.objects.filter(college=apex_college).first()

        if mentor_user and hod_user:
            FacilityBooking.objects.get_or_create(
                college=apex_college,
                facility=seminar_hall,
                booking_date=timezone.now().date() + timedelta(days=3),
                start_time=time(10, 0),
                end_time=time(13, 0),
                defaults={
                    "requested_by": mentor_user,
                    "department": cs_dept,
                    "purpose": "Inter-Department AI Hackathon & Mentorship Workshop",
                    "expected_attendees": 120,
                    "status": "APPROVED",
                    "reviewed_by": hod_user,
                    "review_remarks": "Approved. AV team notified to configure projectors and microphones.",
                    "reviewed_at": timezone.now() - timedelta(days=1),
                }
            )

            FacilityBooking.objects.get_or_create(
                college=apex_college,
                facility=sports_turf,
                booking_date=timezone.now().date() + timedelta(days=5),
                start_time=time(16, 0),
                end_time=time(19, 0),
                defaults={
                    "requested_by": mentor_user,
                    "department": cs_dept,
                    "purpose": "CS Dept Annual Box Cricket & Football League",
                    "expected_attendees": 80,
                    "status": "PENDING",
                    "notes": "Floodlights required from 6:00 PM onwards.",
                }
            )

        # 11. Library Requests submitted by Mentor
        sample_book = Book.objects.filter(college=apex_college).first()
        if mentor_user and sample_book:
            LibraryRequest.objects.get_or_create(
                college=apex_college,
                user=mentor_user,
                book=sample_book,
                defaults={
                    "request_type": "RESERVATION",
                    "status": "PENDING",
                    "notes": "Reserved reference copy for semester coursework mentoring sessions.",
                }
            )

        self.stdout.write(self.style.SUCCESS("Seeded Facility Bookings (Seminar Hall, Turf) and Mentor Library Requests."))
