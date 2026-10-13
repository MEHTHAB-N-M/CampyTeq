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

### Roles
- `SUPER_ADMIN`: Cross-college system governance
- `PRINCIPAL`: Executive college administration
- `MANAGEMENT`: Financial & institutional oversight
- `HOD`: Department-level academic leadership
- `MENTOR`: Student cohort mentorship & tracking
- `FACULTY`: Class, attendance, assignment, and marks management
- `ACCOUNTANT`: Fee structures, invoices, payments, payroll
- `STUDENT`: Academic portals, attendance, fees, submissions
- `PARENT`: Student progress and fee status
- `SECURITY`: Campus gate & authorized camera detection monitoring
- `PRINT_STAFF`: Campus print shop job queue & dispatch
- `LIBRARY_STAFF`: Cataloging, circulation, and fines

## 4. API Design & Uniformity

- Base path: `/api/v1/`
- Standard response schema:
  - Success: `{"success": true, "message": "...", "data": ...}`
  - Error: `{"success": false, "message": "...", "code": "...", "errors": {...}}`
- Documentation: OpenAPI 3.0 via `drf-spectacular` at `/api/docs/`.
