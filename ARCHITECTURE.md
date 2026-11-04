# CampyTeq — Architecture & Design Document

## 1. High-Level System Architecture

```text
                                  +-----------------------+
                                  |   Web Browser / SPA   |
                                  |     (React + Vite)    |
                                  +-----------+-----------+
                                              |
                                              | HTTPS / JSON (JWT)
                                              v
                                  +-----------+-----------+         +-----------------------+
                                  |    Django REST API    |<--------+  Python AI / Edge CV  |
                                  |     (/api/v1/...)     |         |  (Detection Metadata) |
                                  +-----+-----------+-----+         +-----------------------+
                                        |
                                        v
                                   +----+---+
                                   |Postgres|
                                   |   DB   |
                                   +--------+
```

## 2. Multi-Tenancy Design

- **Concept**: A single database shared across multiple institutions with row-level logical separation.
- **Tenant Entity**: `College`
  - Attributes: `id` (UUID), `name`, `code` (e.g. `TECH-ENG`), `slug`, `domain`, `status`, `address`, `phone`, `email`.
- **Tenant Scope Enforcement**:
  - All institutional entities inherit from `TenantModel` (`common.models.TenantModel`), which automatically attaches `college_id`.
  - `TenantManager` automatically filters querysets by `request.college`.
  - The active college is determined purely from the authenticated `request.user.college`.
  - Super Admins can optionally switch tenant context using a verified `X-College-ID` header.
  - No client-supplied parameter in the body can override the authenticated tenant context.

## 3. RBAC & Permissions Matrix

### 11 Base Roles
- `SUPER_ADMIN`: Cross-college system governance (no routine student data)
- `PRINCIPAL`: Executive college administration, oversight, and escalations
- `HOD`: Department-level academic leadership and timetable authoring
- `FACULTY`: Class, attendance, assignment, and marks management
- `LAB_FACULTY`: Laboratory batches, practical attendance, and marks
- `ACCOUNTANT`: Fee structures, invoices, offline payments, and receipts
- `LIBRARY_FACULTY`: Library study chamber and seminar room booking approvals
- `PRINT_STAFF`: Campus print shop job queue & dispatch with PIN verification
- `SECURITY`: Campus gate & authorized perimeter camera monitoring (student search blocked)
- `STUDENT`: Academic portals, attendance, marks, fees, submissions, and print jobs
- `PARENT`: Verified linked ward progress and fee status

### Dynamic Assignment Modes
- `CLASS_INCHARGE`: Whole-section attendance, multi-subject risk roster, and cross-subject views
- `MENTOR`: 360° profile and confidential counseling notes for assigned mentees only

## 4. API Design & Uniformity

- Base path: `/api/v1/`
- Standard response schema:
  - Success: `{"success": true, "message": "...", "data": ...}`
  - Error: `{"success": false, "message": "...", "code": "...", "errors": {...}}`
- Documentation: OpenAPI 3.0 via `drf-spectacular` at `/api/docs/`.

## 5. DPDP Act 2023 Privacy & Biometric Architecture

- **Consent-First Architecture**: Biometric face enrollment (`FaceEnrollment`) requires verified digital consent. For students under 18, verified guardian consent (`ParentWardLink.is_verified=True`) is mandatory.
- **Irreversible Cryptographic Embeddings**: The system strictly extracts and stores 128-dimensional mathematical feature vectors. Raw face images or video frames are never stored.
- **Immediate Vector Deletion on Consent Withdrawal**: Withdrawing consent via `POST /api/v1/tracking/face-enrollment/{id}/withdraw/` immediately sets `embedding = []`, revokes active status, and logs a tamper-evident audit event.
- **Time-Bounded Scoped Locator**: Searches are limited strictly to active class periods (+30 minutes margin) for students marked `ABSENT` in the active period. Security personnel, administrators, and unauthorized staff are blocked with HTTP 403.
- **Sighting Auto-Pruning**: Camera sightings automatically expire and are purged by scheduled task after 24 hours.
- **Statutory DPDP Act 2023 Notice**: Institutional biometric consent forms, parental notices for minors under 18, and data retention rules must undergo formal legal review by the institution's legal counsel or Data Protection Officer (DPO) prior to deployment.
