# SRATS — ARCHITECTURE
**Smart Recruitment and Applicant Tracking System**
*Revision: 1.0.0 (Phase 0 Baseline)*

---

## 1. System Overview

SRATS is a secure, multi-tenant capable, enterprise-grade recruitment and applicant tracking platform. It unifies five distinct role operational workflows:
1. **Applicant**: Profile, resume management, AI resume parsing review, AI job recommendations, universal job discovery, application tracking, interview schedule viewing.
2. **Recruiter**: Job posting lifecycle (Draft/Published/Closed), candidate application review, Kanban recruitment pipeline, interview scheduling, AI assistant.
3. **Interviewer**: Assigned interview schedule, candidate qualification details, structured scoring & feedback submission, AI question generator.
4. **HR Manager**: Department-wide job management, full hiring pipeline visibility, organization-scoped recruitment analytics, AI analytics insights.
5. **Administrator**: User provisioning & status control, company bindings, system audit log inspection, platform health.

---

## 2. Technical Stack and Compatibility Adaptations

### 2.2 Relational Database Architecture & Environment Segregation

**Local Development & Test Environments:**
- Relational SQL engine utilizing ACID mode with strict foreign key constraints enabled on every connection (`PRAGMA foreign_keys = ON;`) and WAL journaling.
- Reusable `withTransaction` abstraction providing atomic execution and verified rollback on failure.
- In-memory execution (`:memory:`) utilized for automated test suites to ensure clean, isolated, deterministic test runs without leaving stale state.

**Production Deployment Database Architecture:**
- **Critical Policy**: A local database file in a Cloud Run container is ephemeral and MUST NOT be used as the authoritative production database.
- The platform uses a pluggable repository and database adapter abstraction (`DatabaseAdapter`). In production deployments, connection parameters (`DATABASE_URL`, `DATABASE_TYPE`) connect to an external managed relational database service (e.g., Google Cloud SQL MySQL 8.x / PostgreSQL 16).
- All domain repositories (`Repository<T, ID>`) interact exclusively with the abstract database interface, allowing zero business logic changes when switching between local development and managed production database backends.

### 2.3 Migration System & Schema Evolution
- Deterministic Flyway-style SQL migration engine (`server/db/migrator.ts`).
- Migrations reside in `/migrations` matching versioned filenames (`V1__initial_schema.sql`, `V2__...`).
- A dedicated `schema_migrations` table records version, migration name, applied timestamp, and SHA-256 content checksum.
- Tampering or retroactive modifications to applied migrations trigger an immediate startup failure to protect schema integrity.
- Each migration script runs within an atomic transaction.

### 2.4 Request Correlation & Traceability
- Every incoming request passes through `correlationMiddleware`.
- Accepts client-supplied `X-Trace-Id` / `X-Request-Id` (validated for sanitization) or generates an unpredictable identifier (`srats-<timestamp>-<random>`).
- Trace IDs are bound to `req.traceId`, returned via `X-Trace-Id` response header, recorded in structured server logs, and stamped in all error envelopes.

---

## 3. Layered Architectural Model

```
┌─────────────────────────────────────────────────────────────┐
│                      REACT FRONTEND                         │
│  - 5 Role Entry & Authentication UX (Applicant, Recruiter, │
│    Interviewer, HR Manager, Admin)                          │
│  - ProtectedRoute & Role Guards                             │
│  - Session Restoration via /auth/me & Refresh Token        │
│  - Clean Enterprise UI (Zero-Pill, WCAG AA, Responsive)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON (Bearer JWT)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXPRESS BACKEND REST API                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Security & Auth Layer                                 │  │
│  │ - JWT Token Verification (Access 15m + Refresh 7d)    │  │
│  │ - PBKDF2 Password Hashing (100k rounds, unique salt)  │  │
│  │ - Role-Based Access Control (requireRole)             │  │
│  │ - Object-Level Authorization (requireOwnership IDOR)  │  │
│  │ - Company Scope Isolation (requireCompanyScope)       │  │
│  │ - Idempotent Server-Side Admin Bootstrapping          │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Controllers & Routers (/api/v1/...)                   │  │
│  │ - /auth: register, login, refresh, logout, me         │  │
│  │ - /health: honest database ping latency               │  │
│  │ - /jobs, /applications, /interviews (Phases 5-8)      │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Domain Service Layer                                  │  │
│  │ - AuthService, JobService, ApplicationService...      │  │
│  │ - Account Status Machine (ACTIVE, PENDING, DEACTIVATED)│ │
│  └───────────────┬───────────────────────┬───────────────┘  │
│                  │                       │                  │
│                  ▼                       ▼                  │
│  ┌────────────────────────┐    ┌────────────────────────┐   │
│  │ Repository & Storage   │    │ AI Orchestrator        │   │
│  │ - Relational Queries   │    │ - Disabled for Phase 3 │   │
│  │ - RefreshTokenRepo     │    │   (Deterministic Auth) │   │
│  └───────────────┬────────┘    └────────────────────────┘   │
└──────────────────┼──────────────────────────────────────────┘
                   ▼
        ┌──────────────────────┐
        │  RELATIONAL DATABASE │
        │  - Migrations V1,V2,V3│
        │  - refresh_tokens    │
        │  - users             │
        └──────────────────────┘
```

### 3.1 Five-Role Authentication Context Model
1. **Public Role Entry Screen**: User selects single role context (`APPLICANT`, `RECRUITER`, `INTERVIEWER`, `HR_MANAGER`, `ADMIN`).
2. **Context Hint Security Rule**: Selected role is passed as `expectedRole`. The backend resolves actual role from credentials and enforces match. If credentials belong to an Applicant while Recruiter context is selected, authentication returns safe 401 `ROLE_MISMATCH`.
3. **Account Lifecycle Matrix**:
   - `APPLICANT`: Self-registration -> `ACTIVE` immediately.
   - `RECRUITER`, `INTERVIEWER`, `HR_MANAGER`: Registration/Request -> `PENDING` awaiting organizational authorization. Privileged actions blocked until approved.
   - `ADMIN`: Public registration is strictly forbidden. Created solely via idempotent server-side `bootstrapAdmin()`.
   - `DEACTIVATED`: Denied all authentication and protected endpoint access.

---

## 4. Core Domain Entities & Relationships

```
User (id, email, passwordHash, role, firstName, lastName, companyId, isActive, createdAt)
 │
 ├── ApplicantProfile (userId, phone, headline, summary, location, website)
 │    ├── Resume (id, applicantId, fileName, fileMime, fileSize, fileContent, parsedAt)
 │    ├── ApplicantSkill (applicantId, skillName, level, verified)
 │    └── Application (id, jobId, applicantId, resumeId, status, appliedAt)
 │         ├── ApplicationStatusHistory (id, applicationId, fromStatus, toStatus, changedBy, note, changedAt)
 │         └── Interview (id, applicationId, interviewerId, scheduledAtUtc, status, locationUrl)
 │              └── InterviewFeedback (id, interviewId, interviewerId, rating, notes, recommendations, submittedAt)
 │
 ├── RecruiterProfile (userId, title, department)
 └── Company (id, name, domain, industry, size, location)
      └── Department (id, companyId, name)
           └── Job (id, companyId, departmentId, title, description, requirements,
                   location, type, experienceLevel, salaryMin, salaryMax,
                   status [DRAFT|PUBLISHED|CLOSED], deadlineUtc, createdBy, createdAt)

System Entities:
 - Notification (id, userId, type, title, message, read, createdAt)
 - AuditLog (id, actorId, action, entityType, entityId, metadataJson, ipAddress, createdAt)
 - AiAuditLog (id, userId, operation, model, tokensUsed, success, createdAt)
```

---

## 5. Storage Architecture (Phase 4 Verified)

Resumes and candidate documents are processed through the `IStorageService` interface abstraction:
```
Applicant
   ↓
/api/v1/applicant/resumes (Multer Memory Storage + 5MB limit)
   ↓
Validation (MIME + Extension + Magic Byte Headers: %PDF-, PK\x03\x04, \xD0\xCF\x11\xE0)
   ↓
ApplicantService (generates internal key: applicantId/resumeId.ext)
   ↓
StorageService.save(key, buffer, mimeType)
   ↓
ResumeRepository.replaceActiveResume(...) [ACID Transaction]
   ├─ Step 1: UPDATE resumes SET is_primary = 0, is_active = 0 WHERE applicant_id = ?
   └─ Step 2: INSERT INTO resumes (id, ..., is_primary = 1, is_active = 1)
   ↓
Compensating Storage Cleanup: If DB transaction fails, saved physical file is automatically purged.
```

### 5.1 Storage Implementations & Cloud Run Persistence Strategy
- **Local Development / Testing**: `LocalStorageService` manages files in `./storage/resumes` or `STORAGE_DIR` with strict path traversal checking (`path.resolve` verifying canonical paths remain within `baseDir`).
- **Production Architecture**: In production Cloud Run environments, container filesystem writes are ephemeral. The `IStorageService` interface (`save`, `read`, `delete`, `exists`) decouples domain services from local disk, allowing seamless configuration of Google Cloud Storage (`@google-cloud/storage`) without altering domain logic.
- **Historical Reference Preservation**: Replacing an active resume never deletes older rows. Prior resumes are marked `is_primary = 0, is_active = 0` (archived), preserving immutable audit and historical links required for job applications submitted under that resume version.
- **Zero Public Exposure**: Resume files are never placed under Vite public assets or static folders. File access requires `GET /api/v1/applicant/resumes/:id/file` guarded by JWT authentication, role check, and principal ownership verification (`resume.applicant_id === req.user.sub`). Cache-Control is strictly set to `private, no-cache, no-store, must-revalidate`.

---

## 6. AI Orchestration & Tool Registry Architecture
All AI interactions operate through server-side `AiOrchestrator`:
1. Authenticated user and role context are attached to the AI session.
2. The model is given a tool registry filtered strictly to the caller's authorized scope.
3. When the model outputs a tool call, the tool executor validates permissions against the caller's identity before querying database services.
4. Tool results are formatted and returned to the model for explanation.
5. All AI interactions and tool calls are audited in `AiAuditLog`.

---

## 7. Job Management & Public Discovery Architecture (Phase 5 Verified)

```
Recruiter / HR / Admin                     Applicant / Public
       │                                           │
       ▼                                           ▼
/api/v1/jobs [POST/PUT/publish/close]       /api/v1/jobs [GET / GET :id]
       │                                           │
       ├─ Authenticate & Role Guard                ├─ Unauthenticated or Applicant
       ├─ Authoritative Company Scope              ├─ Strict Status Filter:
       │  (derived from req.user.companyId)        │  WHERE status = 'PUBLISHED'
       ├─ Invariant Validation (Future Deadline)   │  AND is_active = 1
       └─ State Machine:                           │  AND deleted_at IS NULL
          DRAFT ──► PUBLISHED ──► CLOSED           ├─ Parameterized SQL Search
                                                   ├─ Controlled Sort Mapping
                                                   └─ Sanitized Public Projection
                                                      (Strips internal IDs & notes)
```

### 7.1 Job Lifecycle State Machine
1. **DRAFT**:
   - Initial state for all newly created job requisitions.
   - Visible strictly to authorized internal recruiters and HR managers within the assigned organization (`req.user.companyId`).
   - Completely invisible in public job discovery (`GET /api/v1/jobs`). Direct public retrieval via `GET /api/v1/jobs/:id` returns HTTP 404 (zero leakage).
   - Fully editable by authorized managers.
2. **PUBLISHED**:
   - Transition requires calling `POST /api/v1/jobs/:id/publish`.
   - Server-side business rule validation enforces that title ($\ge 5$ chars), description ($\ge 20$ chars), requirements ($\ge 10$ chars), location, department, and a valid future application deadline (`deadline_utc > Date.now()`) are present.
   - Visible to all applicants in public discovery and search.
   - Editable only for non-structural descriptive fields (description, requirements, location, salary, deadline); status cannot be mutated through general edit endpoints.
3. **CLOSED**:
   - Transition via `POST /api/v1/jobs/:id/close`.
   - Position is archived from open public discovery.
   - Never deleted from database (`deleted_at` remains NULL, row preserved for referential integrity of applications).
   - Immutable: cannot be edited or transitioned back to DRAFT/PUBLISHED.

### 7.2 Organizational Scoping & Multi-Tenancy (IDOR Defense)
- **Authoritative Derivation**: The backend derives the job's `company_id` from `req.user.companyId`. Client-supplied company identifiers are ignored.
- **Cross-Organization Protection**: Before modifying, publishing, or closing any job, `JobService` asserts `job.company_id === req.user.companyId`. Cross-company attempts are rejected with HTTP 403 `FORBIDDEN_COMPANY_SCOPE`.
- **Admin Supervision**: Users with role `ADMIN` have system-level oversight to inspect jobs across all organizations.

### 7.3 Public Search, Filter, Sort & Pagination Strategy
- **Parameterized SQL Queries**: All search terms (`query`, `location`, `employment_type`, `experience_level`) use parameterized SQL statements (`?` placeholders) preventing SQL injection attacks.
- **Controlled Sort Mapping**: Sort parameters are mapped to an immutable server-side dictionary (`newest`, `oldest`, `deadline`, `title`, `title_desc`, `salary_desc`). Arbitrary SQL fragments or column names are rejected with HTTP 400 `INVALID_SORT_FIELD`.
- **Deterministic Pagination**: Paginated responses return `{ content, page, size, totalElements, totalPages }`. Page indices are 0-based and capped at maximum size 100.

---

## 8. Role Dashboards & Analytics Architecture (Phase 10 Verified)

### 8.1 Core Principles
- **Database Source of Truth**: All metrics and distributions are computed directly from relational SQLite tables (`applications`, `jobs`, `interviews`, `notifications`, `users`, `companies`, `departments`) using SQL aggregate functions (`COUNT`, `GROUP BY`, conditional `CASE WHEN`).
- **Zero Fabrication**: Zero hardcoded stats, zero simulated curves, zero AI-guessed metrics. Zero is treated as a truthful count.
- **Strict Role Scoping & Tenancy Isolation**:
  - `APPLICANT`: Queries scoped exclusively to `applicant_id = req.user.sub`.
  - `RECRUITER`: Queries scoped to `company_id = req.user.companyId`. Client-supplied `companyId` query parameters are ignored for non-admins to block IDOR.
  - `INTERVIEWER`: Queries scoped to `interviewer_id = req.user.sub`.
  - `HR_MANAGER`: Queries scoped to assigned company organizations (`req.user.companyId`).
  - `ADMIN`: Platform-wide queries across all tenants.

### 8.2 Metric Definitions & Closed Job Policy
- **Active Jobs**: `COUNT(jobs)` WHERE `status = 'PUBLISHED' AND deleted_at IS NULL AND company_id = ?`.
- **Closed Jobs**: Counted separately as historical records (`status = 'CLOSED'`).
- **Total Applications**: All historical applications submitted across company jobs, preserving historical compliance even after job requisitions close.
- **Upcoming Interviews**: `COUNT(interviews)` WHERE `status = 'SCHEDULED' AND scheduled_at_utc >= CURRENT_TIMESTAMP`.
- **Application Trends**: Aggregated by ISO date (`substr(applied_at, 1, 10)`) within the last 30 UTC days.

---

## 9. Administration & Forensic Audit Architecture (Phase 11 Verified)

### 9.1 Administrator Capabilities
- **User Management**: Filtered, paginated listing with account status toggling (`ACTIVE`, `PENDING`, `DEACTIVATED`), dynamic role mutation, and company binding.
- **Organization Management**: Creation, profile inspection, and activation toggling (`ACTIVE`/`INACTIVE`).
- **Forensic Audit Log Explorer**: Search and filter by actor, action, entity type, and date range with immutable storage.

### 9.2 Administrator Self-Protection Invariants
- **Self-Deactivation Protection**: An active administrator cannot deactivate their own account (`400 CANNOT_DEACTIVATE_SELF`).
- **Last Active Admin Protection**: The system enforces that the final active administrator cannot be deactivated or downgraded to a non-admin role (`400 CANNOT_DEACTIVATE_LAST_ADMIN`, `400 CANNOT_DOWNGRADE_LAST_ADMIN`).

### 9.3 Forensic Audit Trail Architecture & Immutability
- **Forensic Coverage**: Critical state mutations (authentication successes/failures, user status/role updates, company creations, job publication/closure, application status transitions, interview scheduling/cancellation) emit structured `AuditLog` records.
- **Log Immutability**: Audit records have zero update or delete endpoints exposed in the API. Entries are append-only.
- **Data Minimization**: Passwords, tokens, JWT secrets, and unnecessary PII are excluded from audit metadata payloads.


