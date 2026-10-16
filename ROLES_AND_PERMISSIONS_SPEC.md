# Campus360 Roles & Permissions Specification & Audit Summary

## 1. Audit Summary: Pre-existing Gaps vs Institutional Spec

| Spec Requirement | Initial Repository State | Fix Implemented |
|---|---|---|
| **Base Roles (11 total)** | Dynamic assignment modes (`CLASS_INCHARGE`, `MENTOR`) were conflated with base roles. | Established strictly **11 base roles**: `SUPER_ADMIN`, `PRINCIPAL`, `HOD`, `FACULTY`, `LAB_FACULTY`, `ACCOUNTANT`, `LIBRARY_FACULTY`, `PRINT_STAFF`, `SECURITY`, `STUDENT`, `PARENT`. `CLASS_INCHARGE` and `MENTOR` are dynamic assignment-based modes. |
| **Payroll Removal** | Entire payroll app was present (`backend/payroll`, models, views, payslips, frontend page). | **Completely deleted** all payroll models, endpoints, views, urls, serializers, menu items, and tests. |
| **Library Overhaul** | Catalog, book circulation, borrowing history, fines, acquisitions. | Replaced with **Library Booking only** (`LibraryBooking`). `LIBRARY_FACULTY` has one function: approve/reject requests. |
| **Student Library Access** | Students had catalog browsing, renewals, and fine tracking. | **Completely removed** student and parent access to library routes and endpoints. |
| **Active-Role-Only Enforcement** | Permissions permitted union of permissions across held roles. | Enforced **strictly active-role scoping**. `HasGranularPermission` re-verifies `UserRole.is_active` on every request. |
| **Revoked Assignment Handling** | Session caching allowed users to retain access after assignments ended. | Live check against `UserRole` table ensures instant access revocation without re-login. |
| **Shared Scoping Helper** | Risk Radar, attendance, and marks had separate, drifting access filters. | Unified under `risk_queryset(user, class_section, request)` in `academics/scoping.py`. |
| **Attendance Scoping** | HOD had arbitrary class marking; students could query peer records. | HOD attendance is department read-only; students see self only; parents see linked ward only. |
| **Absent Student Finder** | Unrestricted location search and possible photo search leaks. | Period-bound (current period to +30 min), consent-gated (`FaceEnrollment`), no photos/routes leaked, immutable audit logged. |
| **Approval Conflicts of Interest** | HODs could approve their own leave or facility requests. | **No self-approvals**: HOD requests escalate to the Principal. |
| **Facility Booking Approval** | Principal previously approved "high-tier" facilities. | Booking department HOD decides all departmental bookings; Principal decides HOD requests. Overlap prevented via `select_for_update()`. |
| **Parent Ward Security** | Arbitrary student ID access could return 403 (leaking student existence). | Scoped strictly via `ParentWardLink`; returns **HTTP 404** for unlinked student IDs. |

---

## 2. The 11 Base Roles & Dynamic Assignment Modes

### 11 Base Roles
1. `SUPER_ADMIN`: Multi-tenant infrastructure administration; no routine student record access.
2. `PRINCIPAL`: Institutional chief executive; full college oversight, override approvals, and HOD request decisions.
3. `HOD`: Departmental academic head; department timetable authoring, attendance oversight, and departmental facility approvals.
4. `FACULTY`: Academic instruction, marks entry for taught subjects, attendance marking for own periods.
5. `LAB_FACULTY`: Laboratory instruction and session marking for assigned lab batches.
6. `ACCOUNTANT`: Fee structure configuration, dues management, and payment receipts.
7. `LIBRARY_FACULTY`: Dedicated booking manager; approves or rejects library booking requests.
8. `PRINT_STAFF`: Print queue processing, print job execution, and pickup status updates.
9. `SECURITY`: Campus gate operations, visitor logging, live perimeter camera monitoring (individual student searches BLOCKED).
10. `STUDENT`: Self-service portal for timetable, attendance, marks, fees, and print orders.
11. `PARENT`: Read-only ward portal for linked verified student's attendance, timetable, marks, remarks, and fee ledger.

### Dynamic Assignment Modes
- `CLASS_INCHARGE`: Auto-assigned to a `FACULTY` or `HOD` via `ClassIncharge`. Unlocks whole-class risk overview and subject-wise attendance aggregation across all subjects.
- `MENTOR`: Auto-assigned via `MentorAssignment`. Unlocks 360° profile, confidential counseling notes, and reason-audited location search for assigned mentees.

---

## 3. Dynamic Multi-Role Switching & Session Management

- **Model**: `UserRole(user, college, role, source['base'|'assignment'], is_active)`
- **Auto-Sync**:
  - Creating `ClassIncharge` auto-creates/activates `UserRole(role="CLASS_INCHARGE", source="assignment")`.
  - Ending or deleting `ClassIncharge` sets `is_active=False`.
  - Creating `MentorAssignment` auto-creates/activates `UserRole(role="MENTOR", source="assignment")`.
  - Ending `MentorAssignment` deactivates the role if no other active mentees remain.
- **Switch Role Endpoint**: `POST /api/v1/accounts/switch-role/` with payload `{"role": "<TARGET_ROLE>"}`
  1. Validates user holds that role and it is active in `UserRole`.
  2. Updates `user.last_active_role`.
  3. Writes immutable `AuditLog` entry with `action='ROLE_SWITCH'`, `acting_role`, IP address, and timestamp.
  4. Returns fresh JWT containing `active_role` claim.
- **Live Re-verification**: `HasGranularPermission` verifies on every HTTP request that the `acting_role` has not been revoked in `UserRole`.
- **Default Role at Login**: Last active role, otherwise `HOD` > `CLASS_INCHARGE` > `MENTOR` > `FACULTY`.

---

## 4. Permission Matrix & Permission Codes

| Module | SA | PR | HOD | FAC | LAB | ACC | LIB | PRT | SEC | STU | PAR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Multi-college admin | Full | – | – | – | – | – | – | – | – | – | – |
| Institution dashboard | Aggregate | Full | Dept | – | – | Fees only | – | – | – | – | – |
| Timetable | View | Approve | Author | Own | Own | – | – | – | – | Own | Ward |
| Mark attendance | – | – | Own periods | Own periods | Own labs | – | – | – | – | – | – |
| View attendance | – | All | Dept class & subj | Section 4 | Own labs | – | – | – | – | Self only | Ward only |
| Enter marks | – | – | Approve | Own subj | Lab marks | – | – | – | – | View | Ward (view) |
| AI Risk Radar | – | Full | Dept summary | Section 4 / Mentor | – | – | – | – | – | – | – |
| Mentee 360° profile & notes | – | Full | – | Mentees only (Mentor) | – | – | – | – | – | – | – |
| Find absent student (current) | – | – | Via Faculty mode | Yes (own class/period) | Own lab periods | – | – | – | BLOCKED | – | – |
| Student location search | Audit | Full* | Via Principal | Mentees only* | – | – | – | – | BLOCKED | – | – |
| Face enrollment management | – | Manage | – | – | – | – | – | – | – | – | – |
| Live camera feeds | Health | Yes | – | – | – | – | – | – | Yes | – | – |
| Fee config and dues | – | View / Waivers | – | – | – | Full | – | – | – | Pay/view | Pay/view |
| Leave approval | – | HOD & Staff | Faculty & Lab | – | – | – | – | – | – | – | – |
| Facility request | – | – | Via Faculty mode | Yes | Yes | – | – | – | – | – | – |
| Facility approval | – | HOD requests | Own Dept | – | – | – | – | – | – | – | – |
| Facility availability | – | – | View | View | View | – | – | – | – | – | – |
| Facility bookings (all) | – | View (read-only) | – | – | – | – | – | – | – | – | – |
| Print queue | – | Reports | Order | Order | Order | – | – | Full | – | Order | – |
| Library booking request | – | – | Via Faculty mode | Yes | Yes | – | – | – | – | – | – |
| Library booking approval | – | – | – | – | – | – | Approve/Reject | – | – | – | – |
| Library availability | – | – | View | View | View | – | Full | – | – | – | – |
| Audit logs | Full | College | – | – | – | – | – | – | – | – | – |

*\* Requires permanent audit log entry with typed justification of >= 5 characters, subject to rate limits and daily principal notification.*

### Active Permission Codes
`attendance.mark`, `attendance.dept.view`, `attendance.self.view`, `attendance.ward.view`, `class.risk.view`, `class.attendance.view_all_subjects`, `subject.risk.view`, `subject.attendance.view`, `mentee.view`, `mentee.profile.view`, `mentee.notes.write`, `mentee.assign`, `class.roster.view`, `student.find_absent`, `face.enroll.manage`, `location.search`, `camera.view`, `camera.health`, `fee.manage`, `fee.waiver.approve`, `leave.approve`, `facility.booking.request`, `facility.availability.view`, `facility.booking.decide`, `facility.booking.view_all`, `library.booking.request`, `library.availability.view`, `library.booking.decide`, `audit.view`.

---

## 5. Unified Faculty Scoping Helper (`risk_queryset`)

All Risk Radar, Attendance, and Marks endpoints share the exact same access evaluation:
```python
def risk_queryset(user, class_section, request=None):
    # Returns ("class", None) or ("subject", [subject_ids]) or raises PermissionDenied
```
- **Own Class (Class Incharge mode)**: `("class", None)` -> Full visibility over all subjects, overall class risk, and student attendance across subjects.
- **Other Class Taught**: `("subject", [subject_id])` -> Scoped strictly to taught subject data. Never leaks whole-class overall score or other subjects.
- **Unassigned Class**: Raises DRF `PermissionDenied` (HTTP 403).

---

## 6. Absent Student Finder & Privacy Safeguards (DPDP Act 2023)

- **Endpoint**: `POST /api/v1/faculty/periods/{period_id}/absent/{student_id}/find/`
- **Eligibility**:
  - Requester must be teaching the period or class incharge.
  - Student must be marked `ABSENT` in the period roster (other students or non-rostered students return 404).
  - Time window: period start until **30 minutes after completion**.
  - No image uploads or arbitrary text searches permitted.
- **Biometric Consent (`FaceEnrollment`)**:
  - Gated by `FaceEnrollment.consent_given=True` recorded by parent/guardian or principal.
  - Absence of consent returns HTTP 400 (no matching attempted).
  - 3-year statutory data retention limit.
- **Output Sanitization**:
  - Returns last-seen camera zone, timestamp, and confidence only.
  - No trajectories, no route histories, and no raw video streams.
  - Labeled `"possible match, verify manually"`.
  - Immutable audit logged with user, `acting_role`, student, IP, and timestamp. Daily summary sent to Principal.

---

## 7. Facility & Library Booking Workflows

### Facility Booking
- **Requesters**: `FACULTY`, `LAB_FACULTY`, `HOD` (in Faculty mode).
- **Approval Hierarchy**:
  - Departmental faculty requests approved by the **HOD of `booking.department`**.
  - HOD requests approved by the **PRINCIPAL**.
  - **No self-approval**: Requesters can never approve their own booking.
- **Concurrency & Overlap**:
  - Slot collision checked inside database transactions with `select_for_update()`.
  - First approved booking claims the slot; conflicting pending requests return `"Slot already booked"`.
- **Rejection**: Strictly requires `reject_reason`.

### Library Booking
- **Requesters**: `FACULTY`, `LAB_FACULTY`, `HOD` (in Faculty mode).
- **Decision**: Strictly decided by `LIBRARY_FACULTY`.
- **Availability Calendar**: Shows Free/Pending/Booked slots. Requester identity and purpose are scrubbed from public availability.

---

## 8. Parent Ward Security & Multi-Tenant Isolation

- **Model**: `ParentWardLink(college, parent, student, relation, is_verified, is_active)`
- **Verification**: Only Principal or HOD can verify or activate parent-ward links.
- **Scoping**:
  - All endpoints under `/api/v1/parent/wards/{student_id}/...`.
  - Unlinked student IDs return **HTTP 404 (Not Found)** to prevent student existence enumeration.
  - Unverified or inactive links yield 404.
  - Strict exclusion: Parents never receive peer data, class rankings, Risk Radar, counseling notes, location tracking, or camera feeds.
- **Tenant Isolation**: Every database query enforces `college=request.user.college`.

---

## 9. Automated Test Verification Results

All 56 test cases across the test suite execute cleanly and pass 100%:

```
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
