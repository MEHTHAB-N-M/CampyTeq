# CampyTeq — Full-Stack Multi-College Digital Ecosystem

> **One Campus. One Platform. One Digital Ecosystem.**

**CampyTeq** is an enterprise-grade, production-quality multi-tenant Higher Education SaaS ecosystem that unifies students, parents, faculty, mentors, HODs, principals, finance officers, library faculty, print-shop managers, and campus security forces under strict multi-tenant isolation (`college=request.user.college`), active-role RBAC, and responsive web user experiences.

---

## Ecosystem Architecture

```text
campyteq/
├── backend/            # Django 5.1 REST Framework, SimpleJWT, drf-spectacular, PostgreSQL
│   ├── accounts/       # Custom UUID user, 11 Base Roles, UserRole dynamic switching, AuditLog
│   ├── colleges/       # Multi-tenant College model & comprehensive demo seed command
│   ├── departments/    # Academic departments & HOD assignments
│   ├── academics/      # Courses, Batches, ClassSections, ClassIncharge, SubjectAssignments, Timetables, Shared Scoping
│   ├── students/       # Student directory, MentorAssignment, ParentWardLink, Mentee Counseling Notes
│   ├── faculty/        # Faculty directory, qualifications, shared scoping helper, Absent Student Finder
│   ├── attendance/     # Department HOD attendance, Faculty scoped attendance, Student & Parent attendance
│   ├── exams/          # Examination series, exam subjects, confidential grade results publishing
│   ├── assignments/    # Assignments, document attachments, submissions & grading
│   ├── fees/           # Fee structures, student billing invoices, fee waivers & digital receipts
│   ├── communication/  # Scoped announcements, in-app notifications, official documents, multi-tier leaves
│   ├── printshop/      # Digital print queue manager, cost estimator, kiosk pickup PINs
│   ├── library/        # Facility & resource library booking, approval workflow (LIBRARY_FACULTY)
│   ├── facilities/     # Multi-purpose facility booking (gym, turf, auditorium, seminar hall, project rooms)
│   ├── cameras/        # Campus CCTV registry, camera zones, operational health monitoring
│   ├── tracking/       # Biometric FaceEnrollment (DPDP Act 2023), last seen locations, privacy audit logs
│   └── analytics/      # Institutional analytics & AI Academic Early Warning Radar
├── frontend/           # React 18 (Vite), React Router, TypeScript, Tailwind CSS, Lucide icons
├── cv-service/         # Python Edge Computer Vision & AI detection pipeline
├── ROLES_AND_PERMISSIONS_SPEC.md # Full institutional role & permission specification & audit summary
└── README.md
```

---

## 11 Base Institutional Roles & Dynamic Assignment Modes

CampyTeq implements strictly **11 base roles** with dynamic assignment modes:

### Base Roles (11)
1. `SUPER_ADMIN` — Multi-tenant platform operator; global system health and tenant management (no routine student data access).
2. `PRINCIPAL` — Chief institutional executive with complete college oversight, waiver approvals, and HOD request decisions.
3. `HOD` — Head of Department; timetable authoring, department-level attendance oversight, and departmental facility approvals.
4. `FACULTY` — Course instructor; class teaching, marks entry for taught subjects, and attendance marking for own periods.
5. `LAB_FACULTY` — Laboratory instructor; practical sessions, lab attendance, and lab marks entry.
6. `ACCOUNTANT` — Finance officer; fee structures, invoices, payment recording, and fee receipt management.
7. `LIBRARY_FACULTY` — Dedicated library booking manager; approves or rejects library facility and room booking requests.
8. `PRINT_STAFF` — Print kiosk operator; queue processing, order fulfillment, and pickup PIN verification.
9. `SECURITY` — Campus security team; live perimeter CCTV monitoring and gate control (individual student tracking is strictly BLOCKED).
10. `STUDENT` — Enrolled student; personal timetable, attendance, marks, fees, and print shop orders.
11. `PARENT` — Guardian; scoped read-only portal for linked verified ward's attendance, timetable, marks, remarks, and fee ledger.

### Dynamic Assignment Modes (Not Base Roles)
- `CLASS_INCHARGE` — Automatically granted/revoked when assigned to run a class section. Unlocks overall class attendance across all subjects and whole-class Risk Radar.
- `MENTOR` — Automatically granted/revoked when assigned mentees. Unlocks 360° mentee profile, confidential counseling notes, and reason-audited location search.

---

## Core Institutional Architecture Principles

### 1. Active-Role-Only Scoping & Instant Revocation
- Users may hold multiple roles (e.g. an HOD who is also a Class Incharge and Mentor).
- Roles are tracked in `UserRole(user, college, role, source["base"|"assignment"], is_active)`.
- Switching roles (`POST /api/v1/accounts/switch-role/`) updates `active_role` claim in short-lived JWT and logs an immutable audit trail.
- **Only the active role grants permissions** (never the union of held roles). `HasGranularPermission` verifies on every HTTP request that the active role is currently active in `UserRole`—revoked assignments lose access immediately without requiring re-login.

### 2. Unified Faculty Scoping Helper (`risk_queryset`)
- Risk Radar, attendance marking/viewing, and marks entry share one canonical helper in `backend/academics/scoping.py`:
  - **Own class (Class Incharge mode)**: Full visibility over all subjects, overall class risk, and student attendance across subjects.
  - **Other class taught**: Scoped strictly to taught subject data. Never leaks whole-class overall score or other subjects.
  - **Unassigned class**: Strictly raises `PermissionDenied` (HTTP 403).

### 3. Absent Student Finder (India DPDP Act 2023 Compliant)
- Faculty can locate students marked `ABSENT` during an active period they are teaching.
- Allowed only from period start until **30 minutes after completion**.
- Gated by `FaceEnrollment.consent_given=True` recorded by parent/guardian or principal.
- No photo uploads or free-text search permitted. Returns last-seen camera zone, timestamp, and confidence only (`"possible match, verify manually"`). No route trajectories or raw video feeds.

### 4. Conflict-of-Interest & Overlap Controls
- **No Self-Approval**: HOD's own leave and facility requests escalate to the Principal.
- **Overlap Prevention**: Concurrency locks (`select_for_update`) ensure double-booking of rooms or facilities is impossible.
- **Required Reasons**: Rejection of facility or library bookings strictly requires a documented reason.

### 5. Scoped Parent Security
- Parents see only verified linked wards via `ParentWardLink`.
- Arbitrary student ID access returns **HTTP 404 (Not Found)** to prevent student existence enumeration.
- Parents never see peer data, class rankings, Risk Radar, counseling notes, location tracking, or camera feeds.

---

## Demo Personas (One-Click Login on Local Dev)

All accounts use the default password: **`Password123!`**

| # | Persona | Email | Scope & Purpose |
|---|---|---|---|
| 1 | **Super Admin** | `superadmin@campyteq.io` | Global Platform Operator & Multi-Tenant Administration |
| 2 | **Principal** | `principal@apex.edu` | Apex Tech Executive Oversight, Approvals & HOD Decisions |
| 3 | **HOD (CS)** | `hod.cs@apex.edu` | Department Roster, Attendance Oversight & Facility Approvals |
| 4 | **Faculty** | `faculty.priya@apex.edu` | Class Teaching, Attendance Marking (Class Incharge & Mentor modes) |
| 5 | **Lab Faculty** | `labfaculty.vikram@apex.edu` | Assigned Lab Batches, Lab Attendance & Practical Marks |
| 6 | **Accountant** | `accountant.raman@apex.edu` | Fees, Invoices, Fee Waivers & Receipts |
| 7 | **Library Faculty** | `librarystaff.anita@apex.edu` | Dedicated Library Resource & Room Booking Approvals |
| 8 | **Print Staff** | `printstaff.dev@apex.edu` | Print Queue Processing, Fulfillment & Pickup |
| 9 | **Campus Security** | `security.chief@apex.edu` | Live Perimeter Camera Feeds & Gate Control |
| 10 | **Student** | `student.rahul@apex.edu` | Academic Hub, Timetable, Self Attendance & Marks |
| 11 | **Parent** | `parent.sharma@apex.edu` | Scoped Ward Portal: Ward Attendance, Marks & Fees |

---

## Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```
- API Root: `http://localhost:8000/api/v1/`
- Interactive OpenAPI Docs: `http://localhost:8000/api/docs/`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:3000` (features 1-click persona switcher on login screen).

---

## Automated Verification Suite

Run the full backend test suite:
```bash
cd backend
pytest -v
```

All 56 test cases across 11 test modules pass cleanly:
```text
tests\test_academics_workflow.py ...                                     [  5%]
tests\test_analytics_and_ai_workflow.py ......                           [ 16%]
tests\test_attendance_workflow.py ....                                   [ 23%]
tests\test_auth.py .....                                                 [ 32%]
tests\test_camera_and_tracking_workflow.py ......                        [ 42%]
tests\test_communication_workflow.py ....                                [ 50%]
tests\test_facilities_and_library_requests.py ..                         [ 53%]
tests\test_finance_workflow.py ..                                        [ 57%]
tests\test_people.py ......                                              [ 67%]
tests\test_printshop_and_library_workflow.py ...                         [ 73%]
tests\test_rbac.py ..                                                    [ 76%]
tests\test_roles_and_permissions_spec.py ..........                      [ 94%]
tests\test_tenant_isolation.py ...                                       [100%]

======================= 56 passed in 240.43s (0:04:00) ========================
```

Verify the frontend production build:
```bash
cd frontend
npm run build
```
Builds cleanly with 0 errors (`✓ built in 7.88s`).
