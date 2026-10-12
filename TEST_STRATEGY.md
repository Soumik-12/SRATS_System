# SRATS — TEST STRATEGY & VERIFICATION PLAN
**Comprehensive Quality Assurance and Verification Framework**
*Revision: 1.0.0 (Phase 0 Baseline)*

---

## 1. Testing Philosophy & Verification Principles

1. **End-to-End Chain Validation**:
   No workflow is considered verified until the entire loop succeeds:
   `UI User Action → Frontend Request → API Endpoint → Authorization Check → Domain Logic → Database Persistence → HTTP Response → UI State Update`.
2. **Zero Fake Data Verification**:
   All tests assert against real relational database queries. No synthetic mock entities masquerading as production records.
3. **Strict Authorization Assertions**:
   Every role boundary (Applicant, Recruiter, Interviewer, HR Manager, Admin) is subjected to negative permission tests (401 Unauthorized, 403 Forbidden).
4. **IDOR & Multi-Tenant Isolation Testing**:
   Applicant A cannot access Applicant B's data; Recruiter from Company A cannot query Company B records; Interviewer cannot view unassigned interviews.

---

## 2. Test Execution Matrix

### 2.0 Phase 1 Foundation & Runtime Verification Suite (VERIFIED)
- [x] **Relational Migration Execution**: Clean database executes `V1__initial_schema.sql` and populates `schema_migrations`.
- [x] **Migration Determinism**: Re-executing migrations idempotently succeeds without duplicate modifications or failures.
- [x] **Foreign-Key Enforcement**: PRAGMA `foreign_keys = ON` strictly verified; inserting orphan child records throws foreign key constraint violation.
- [x] **Foreign-Key Cascading**: Deleting parent row cascade-deletes related child configurations.
- [x] **Transaction Atomic Rollback**: Unhandled exception inside `withTransaction` rolls back all mutations; state remains intact.
- [x] **Honest Health Check**: `/api/v1/health` reports true database status and measured ping latency (zero fabricated metrics).
- [x] **Request Correlation**: Server generates and propagates `X-Trace-Id` across requests and logs.
- [x] **404 Route Handling**: Non-existent route produces standard error envelope (`timestamp`, `status: 404`, `error: NOT_FOUND`, `traceId`).
- [x] **Controlled Error Handling**: AppError produces standard error envelope with status 400 and structured details.
- [x] **Server Error Isolation**: 500 error sanitizes internal stack traces and secrets from client responses.
- [x] **Secrets Hygiene**: Verified zero real API keys in source or `.env.example`, zero `@google/genai` imports in client code.
- [x] **Full-Stack Runtime**: Dev server starts Express and Vite on port 3000; production build succeeds in <1s.

### 2.1 Phase 2 Database & Domain Relational Schema Suite (VERIFIED)
- [x] **Blank DB Migration V2**: Applied `V2__core_recruitment_domain.sql` creating all 13 core domain tables.
- [x] **Unique Constraint Enforcement**: Attempting duplicate user email or duplicate job application by same applicant throws SQL unique constraint error.
- [x] **Foreign Key Integrity**: Inserting orphan child records (e.g. resume without applicant profile) is blocked with FOREIGN KEY constraint failure.
- [x] **Cascade Deletion**: Hard deletion of user cascade-deletes profile, uploaded resumes, and skills.
- [x] **Full Workflow Progression**: Company -> Department -> Recruiter -> Job (DRAFT -> PUBLISHED) -> Candidate Application -> Shortlist -> Interview -> Feedback -> Selected -> Hired.
- [x] **State Machine Transition Invariants**: Invalid transitions (e.g. HIRED back to APPLIED) rejected by domain validator.
- [x] **Closed Job Protection**: Jobs in CLOSED status reject new incoming applications.
- [x] **Interviewer Role Security**: Feedback submission restricted to assigned interviewer only.

### 2.2 Authentication & RBAC Suite
- [ ] Valid credentials generate valid JWT access & refresh tokens.
- [ ] Invalid password returns 401 with standard error envelope.
- [ ] Inactive/suspended user is denied access.
- [ ] Expired or tampered access token is rejected with 401.
- [ ] Valid refresh token successfully rotates access token.
- [ ] Cross-role denial: Applicant denied on Recruiter/Admin endpoints.
- [ ] Public admin registration is strictly impossible (403/404).

### 2.2 Applicant & Resume Security Suite
- [ ] Applicant profile update persists to database.
- [ ] Resume upload validates file size ($\le 5\text{MB}$) and MIME type (`pdf`, `docx`).
- [ ] Oversized file ($> 5\text{MB}$) is rejected with descriptive error.
- [ ] Unsupported file type (`.exe`, `.sh`) is rejected with 400.
- [ ] Applicant B cannot download Applicant A's resume (IDOR test).

### 2.3 Job Management & Lifecycle Suite
- [ ] Recruiter can create job in `DRAFT` state.
- [ ] `DRAFT` jobs do not appear in public applicant job discovery.
- [ ] Recruiter can publish job to `PUBLISHED` state.
- [ ] `PUBLISHED` jobs appear in applicant search, filter, and sort queries.
- [ ] Closed jobs reject new application submissions.
- [ ] Past-deadline jobs reject new application submissions.

### 2.4 Application & Pipeline Workflow Suite
- [ ] Applicant can apply with uploaded resume to published job.
- [ ] Duplicate application to same job is rejected (409 Conflict).
- [ ] Recruiter moves card across Kanban pipeline (`APPLIED` → `SHORTLISTED` → `INTERVIEW_SCHEDULED` → `SELECTED` → `HIRED` or `REJECTED`).
- [ ] State transition persists to database and records `ApplicationStatusHistory`.
- [ ] Invalid state transition (e.g., `HIRED` → `APPLIED`) is rejected by business validator.

### 2.5 Interview Management Suite
- [ ] Recruiter schedules interview referencing valid application.
- [ ] Assigned interviewer can submit rating and feedback.
- [ ] Unassigned interviewer is denied from submitting feedback (403 Forbidden).
- [ ] Applicant has read-only view of own interview schedule.
- [ ] UTC timestamps stored accurately and formatted for local user view.

### 2.6 Domain Notification & Audit Suite
- [ ] State transition triggers domain notification to applicant.
- [ ] Sensitive actions (login, role change, job publication, status change) write `AuditLog` records.
- [ ] Admin query returns audit log entries; non-admin query is rejected (403).

### 2.7 Phase 10: Role Dashboards & Query Analytics Precision Suite (VERIFIED)
- [x] Unauthenticated request to `/api/v1/analytics/applicant` returns 401.
- [x] APPLICANT accessing recruiter analytics returns 403 FORBIDDEN.
- [x] APPLICANT accessing HR analytics returns 403 FORBIDDEN.
- [x] RECRUITER accessing admin analytics returns 403 FORBIDDEN.
- [x] INTERVIEWER accessing HR analytics returns 403 FORBIDDEN.
- [x] Applicant A retrieves exact database-derived metrics (applications by status, interviews, notifications).
- [x] Applicant B receives honest zero-state metrics (No data leakage from Applicant A).
- [x] Applicant A cannot retrieve Applicant B metrics via query or headers (Strict caller-bound scope).
- [x] Recruiter A retrieves Company A metrics (active jobs, applications, upcoming interviews).
- [x] Recruiter B retrieves Company B metrics (isolated tenant scope).
- [x] Recruiter A passing `?companyId=comp-beta` is locked to Company A (No cross-company spoofing).
- [x] Interviewer A sees 1 assigned upcoming interview; Interviewer B sees 0.
- [x] HR Manager A gets company department breakdown and hiring metrics.
- [x] System Administrator retrieves platform-wide analytics.
- [x] Transitioning application status reactively updates metrics on next query.
- [x] Direct role routes (`/api/v1/applicant/analytics`, `/api/v1/recruiter/analytics`, `/api/v1/interviewer/analytics`, `/api/v1/hr/analytics`, `/api/v1/admin/analytics`) return identical verified data.
- [x] SQL injection payloads in query params fail safely without leaking other tenant records.

### 2.8 Phase 11: Administration & Forensic Audit Suite (VERIFIED)
- [x] Unauthenticated request to `/api/v1/admin/users` returns 401.
- [x] Direct API negative test: APPLICANT calling admin endpoints returns 403.
- [x] Direct API negative test: RECRUITER calling admin endpoints returns 403.
- [x] Direct API negative test: INTERVIEWER calling admin endpoints returns 403.
- [x] Direct API negative test: HR_MANAGER calling admin endpoints returns 403.
- [x] ADMIN can successfully access admin endpoints (200 OK).
- [x] Admin lists users without leaking password hashes or internal secrets (data minimization).
- [x] Admin filters users by search keyword and role.
- [x] Admin deactivates user and verifies audit log emission.
- [x] Deactivated user is blocked from logging in (403 ACCOUNT_DEACTIVATED).
- [x] Admin reactivates user to ACTIVE status.
- [x] Admin self-protection: Admin cannot deactivate own account (400 CANNOT_DEACTIVATE_SELF).
- [x] Last active Admin protection: Cannot deactivate the final remaining active admin (400 CANNOT_DEACTIVATE_LAST_ADMIN).
- [x] Last active Admin protection: Cannot downgrade role of the last active admin (400 CANNOT_DOWNGRADE_LAST_ADMIN).
- [x] Admin updates candidate role to INTERVIEWER and verifies audit log.
- [x] Admin binds user to company and verifies audit log.
- [x] Binding user to non-existent company returns 404 COMPANY_NOT_FOUND.
- [x] Admin creates new company organization and verifies audit log.
- [x] Creating company with duplicate name returns 409 conflict.
- [x] Admin toggles company active/inactive status and verifies audit log.
- [x] Admin retrieves paginated audit logs with metadata.
- [x] Admin filters audit logs by action and entity type.
- [x] Audit logs immutability: No DELETE or modification endpoints exist for audit logs (404).
- [x] SQL injection payloads in audit filter query params are safely parameterized.

### 2.8 AI Integration & Grounding Suite
- [ ] Resume analysis produces structured JSON matching validated schema.
- [ ] Job recommendation returns only IDs of currently `PUBLISHED` jobs in database.
- [ ] Job recommendation never auto-applies or blocks access to unrelated job categories.
- [ ] AI prompt injection test: Resume containing malicious system prompt override is handled safely as passive text.
- [ ] AI failure test: When API key is invalid or service is down, system returns controlled degradation without fabricating results.
- [ ] AI tool execution enforces caller's role permissions (cannot execute admin tools from applicant query).

### 2.9 Phase 4: Applicant Module & Secure Resume Storage Suite (VERIFIED)
- [x] Profile authorization: Unauthenticated request to `/api/v1/applicant/profile` returns 401.
- [x] Role authorization: Recruiter or other non-applicant role accessing applicant endpoints returns 403 Forbidden.
- [x] Profile CRUD: Authenticated applicant reads own profile and updates fields (headline, summary, phone, location, website).
- [x] Profile validation: Rejects invalid website URL and oversized text fields (400 validation error envelope).
- [x] IDOR defense: Applicant B querying `/api/v1/applicant/profile` receives only own profile data, never Applicant A data.
- [x] Skills inventory: Applicant adds skills with proficiency levels (`BEGINNER`, `INTERMEDIATE`, `EXPERT`).
- [x] Duplicate prevention: Duplicate skill addition is rejected with 409 Conflict.
- [x] Skill IDOR protection: Applicant B cannot delete Applicant A's skills.
- [x] File upload validation: Valid PDF, DOC, and DOCX uploads succeed.
- [x] File type enforcement: Unsupported file extensions (.exe, .sh, etc.) are rejected with 400.
- [x] Magic number header inspection: Spoofed MIME types lacking binary header signatures are rejected.
- [x] File size limits: Payloads exceeding 5 MB are rejected with 413.
- [x] Path traversal protection: Malicious filenames (`../../../../etc/passwd.pdf`) are sanitized to base names and resolved within storage root.
- [x] Deterministic resume replacement: New active upload atomically deactivates previous resume (exactly 1 current active resume).
- [x] Historical reference preservation: Deactivated previous resumes remain preserved in database for application referencing.
- [x] Secure file download: Authenticated owner downloads binary file with private non-cacheable headers.
- [x] Resume IDOR protection: Applicant B cannot download Applicant A's resume file (404/403).
- [x] Static asset isolation: Storage directory is not served publicly or as static assets.
- [x] Storage service isolation: StorageService unit tests pass in isolated test directory.
- [x] Transactional rollback: Failed database persistence deletes stored physical file (zero orphaned files).
- [x] Profile completeness formula: Deterministically verified from persisted fields.

### 2.10 Phase 5: Job Management & Real Public Job Discovery Suite (VERIFIED)
- [x] Real Job Creation: Recruiter A creates real job requisition persisting in relational SQLite with derived `company_id`.
- [x] Initial State Invariant: Job starts strictly as `DRAFT` upon creation.
- [x] Unassigned Recruiter Rejection: Recruiter with null `company_id` is rejected with 403 `NO_COMPANY_ASSIGNED`.
- [x] Foreign Department Integrity: Creating job with department belonging to another company is rejected with 400 `INVALID_DEPARTMENT`.
- [x] Salary Range Invariant: Rejects min salary exceeding max salary with 400 `INVALID_SALARY_RANGE`.
- [x] Draft Public Isolation: `GET /api/v1/jobs` strictly excludes all `DRAFT` jobs (returns 0 elements when only drafts exist).
- [x] Draft Detail Probing Defense: Direct `GET /api/v1/jobs/:id` for draft returns 404 to public and applicant callers.
- [x] Internal Draft Access: Authorized Recruiter A can retrieve own draft job through management endpoints.
- [x] Cross-Company IDOR Defense (Edit): Recruiter B cannot edit Recruiter A's draft job (403 `FORBIDDEN_COMPANY_SCOPE`).
- [x] Draft Editing: Recruiter A can update draft fields (title, description, requirements, salary, deadline).
- [x] Cross-Company IDOR Defense (Publish): Recruiter B cannot publish Recruiter A's job (403 `FORBIDDEN_COMPANY_SCOPE`).
- [x] Server-Side Publishing Validation: Rejects publication of jobs lacking required content or future deadlines with 400.
- [x] Valid Publishing Transition: Authorized Recruiter A transitions draft to `PUBLISHED`.
- [x] Republishing Prevention: Attempting to republish already published job returns 400 `ALREADY_PUBLISHED`.
- [x] Public Discovery Visibility: Published jobs immediately appear in public `GET /api/v1/jobs` with company and department names.
- [x] Public Metadata Minimization: Public job details expose only sanitized fields (omits recruiter user IDs, audit metadata).
- [x] Parameterized Keyword Search: Searches across title, description, requirements, and company name.
- [x] SQL Injection Resistance: Malicious queries containing SQL injection characters (`'; DROP TABLE jobs; --`) are safely bound and execute zero unauthorized SQL.
- [x] Controlled Sorting Security: Whitelist-backed sorting (`newest`, `oldest`, `deadline`, `title`, `salary_desc`) succeeds; raw arbitrary sort injection returns 400 `INVALID_SORT_FIELD`.
- [x] Deterministic Pagination: Verified `page`, `size`, `totalElements`, `totalPages` across multiple pages with zero duplicate records.
- [x] Published Job Editing: Recruiter A can update descriptive fields on published job; status remains `PUBLISHED`.
- [x] Cross-Company IDOR Defense (Close): Recruiter B cannot close Recruiter A's published job (403 `FORBIDDEN_COMPANY_SCOPE`).
- [x] Closing Transition: Recruiter A closes published job -> transitions to `CLOSED`.
- [x] Public Removal on Close: Closed job is immediately excluded from active public discovery.
- [x] Historical Preservation: Closed job remains permanently stored in relational database (zero deletions).
- [x] Closed Immutability: Attempting to modify or publish a closed job is strictly rejected with 400.
- [x] Role Security (Interviewer): Interviewer role is denied from job management endpoints (403 `FORBIDDEN`).
- [x] Role Security (Applicant): Applicant role is denied from job management endpoints (403 `FORBIDDEN`).
- [x] Organization Management: Recruiter can query and add organizational departments.
- [x] Admin Supervision: System administrator has platform-level authority to inspect jobs across organizations.

