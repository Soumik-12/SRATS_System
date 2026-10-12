# SRATS — SECURITY POLICIES & CONTROLS
**Smart Recruitment and Applicant Tracking System**
*Revision: 1.0.0 (Phase 0 Baseline)*

---

## 1. Authentication & Token Architecture

- **Token Pair Model**:
  - `Access Token`: Signed with `JWT_SECRET`, 15-minute expiration window. Carried via `Authorization: Bearer <token>` header. Contains `{ userId, role, companyId, email }`.
  - `Refresh Token`: Cryptographically random 64-character token stored with hashed verification in the database, 7-day expiration. Used to obtain new access tokens.
- **Password Security**:
  - Passwords hashed using standard BCrypt or PBKDF2 with high work factor (salt rounds $\ge$ 10).
  - Passwords are NEVER logged, returned in API responses, or stored in plaintext.
- **Account State Verification**:
  - Inactive or suspended accounts are rejected during token verification.

---

## 2. Authorization & Multi-Tenancy Protection

- **Role Boundaries**:
  - APPLICANT: Can only access own profile, resumes, applications, and public jobs. Cannot access recruiter, interviewer, or admin endpoints.
  - RECRUITER: Can only access jobs and applications belonging to their assigned company.
  - INTERVIEWER: Can only access interviews explicitly assigned to them.
  - HR_MANAGER: Company-scoped oversight. Cannot access other companies' data.
  - ADMIN: Platform administration, user deactivation, audit logs. Sign-in only; no public registration.
- **Object-Level Authorization (IDOR Defense)**:
  - Every endpoint accepting an entity ID (`/applications/:id`, `/resumes/:id`, `/interviews/:id`) verifies ownership or company tenancy before reading or mutating records.
- **No Client-Side Authority**:
  - Frontend route protection is UX only. All security decisions are enforced on the backend.

---

## 3. Data Privacy & Minimization

- **Sensitive Attributes**:
  - Race, religion, gender, sexual orientation, disability, caste, health records, or political affiliations are neither collected nor permitted in recruitment decisions or AI prompts.
- **Resume Access**:
  - Resume files are stored securely and accessible only via authenticated, authorized endpoints with ownership verification. Unauthenticated public URLs are prohibited.

---

## 4. AI Security & Prompt Injection Mitigation

- **Untrusted Input Treatment**:
  - All user-supplied data (resume text, candidate notes, feedback) is treated as untrusted data.
- **Prompt Isolation Architecture**:
  - Prompts clearly separate system instructions from candidate content payloads using strict delimiters:
    `<<<BEGIN_UNTRUSTED_DOCUMENT_CONTENT>>>\n...content...\n<<<END_UNTRUSTED_DOCUMENT_CONTENT>>>`.
  - System instructions explicitly forbid following instructions or overrides contained within candidate text.
  - Heuristic scanner (`promptSanitizer.ts`) proactively identifies prompt injection patterns (e.g. `ignore previous instructions`, `system:`, `jailbreak`, `override policy`) and flags them without system failure.
- **Tool Privilege Enforcement**:
  - AI tool calls are executed by server-side handlers (`toolRegistry.ts`) that authenticate the invoking user and enforce role permissions (`TOOL_UNAUTHORIZED`).
  - Argument payloads are strictly revalidated using Zod schemas (`TOOL_ARGUMENTS_INVALID`).
  - Multi-tenant company boundaries and applicant ownership (IDOR defense) are authoritatively enforced server-side.
- **Secret Isolation**:
  - `GEMINI_API_KEY` is strictly server-side. It is never exposed in browser bundles, environment dumps, or client responses.
  - Telemetry User-Agent header `'aistudio-build'` is injected strictly via server-side `@google/genai` client initialization.
- **Applicant Consent & Data Minimization**:
  - Resumes are only sent to Google Gemini after the authenticated applicant provides explicit consent (`consentAccepted: true`).
  - Only text required for profile extraction is forwarded. Account authentication secrets, tokens, and password hashes are never included in prompts.
  - Audit logs record operation metadata (`RESUME_AI_ANALYZED`, `RESUME_AI_CONFIRMED`) while excluding complete resume texts.

---

## 5. Input Validation & Error Sanitization

- Strict schema validation on all incoming request bodies using Zod / schema validators.
- SQL injection prevention via parameterized queries and prepared statements.
- Cross-Site Scripting (XSS) prevention via output encoding and HTML sanitization.
- Standardized error envelopes without exposing internal database stack traces or system filepaths.
- CORS policy configured via `CORS_ALLOWED_ORIGINS` environment variables, defaulting safely with sanitized origin callbacks.
- Server-side secret policy: `GEMINI_API_KEY`, database credentials, and signing secrets are strictly confined to the backend server environment. Verified that client code contains zero GenAI SDK imports or API key references.
- Traceability: Every request is stamped with a sanitized correlation ID (`X-Trace-Id`) for audit log binding and debugging without exposing internal server identifiers.

---

## 6. Resume Upload Security & File Handling Controls (Phase 4 Verified)

- **File Type Whitelisting**:
  - Strictly limited to `.pdf`, `.doc`, and `.docx`.
  - Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
  - Executable files, shell scripts, batch files, and macro-enabled documents are rejected.
- **Magic Number Binary Header Inspection**:
  - In addition to client-reported MIME types and extensions, the backend verifies initial magic byte signatures:
    - PDF: Requires `%PDF-` header signature.
    - DOCX: Requires ZIP container signature (`PK\x03\x04`).
    - DOC: Requires OLE Compound Document signature (`\xD0\xCF\x11\xE0`).
  - Mismatches or spoofed headers are rejected immediately with HTTP 400.
- **Size Limitation**:
  - Maximum upload size is strictly capped at 5 MB (5,242,880 bytes) at both the middleware (`multer.limits.fileSize`) and service layer. Oversized payloads return HTTP 413.
- **Path Traversal Defense**:
  - Original filenames provided by users are never used as internal storage paths. Filenames are stripped of null bytes (`\0`), newlines, and directory separators.
  - Storage paths are generated deterministically using internal identifiers (`applicantId/resumeId.ext`). Canonical path resolution validates that paths strictly remain within the configured `baseDir`.
- **Private Access & Non-Cacheable Delivery**:
  - Resumes are served exclusively through `GET /api/v1/applicant/resumes/:id/file` requiring active JWT authentication and principal ownership verification (`resume.applicant_id === req.user.sub`).
  - Responses include `Cache-Control: private, no-cache, no-store, must-revalidate` and `X-Content-Type-Options: nosniff`. Public static directory serving is prohibited.
- **Compensating Storage Cleanup**:
  - File writes and database record insertions are coordinated: if database persistence fails after a file write, the storage service automatically purges the physical file to eliminate orphaned disk artifacts.

---

## 7. Job Management Security Controls & Tenancy Isolation (Phase 5 Verified)

- **Authoritative Company Derivation**:
  - On `POST /api/v1/jobs`, the backend ignores any `company_id` passed in the request body and enforces `req.user.companyId` as the immutable tenant identifier.
  - If a recruiter account is unassigned (`company_id === null`), job operations are rejected with HTTP 403 `NO_COMPANY_ASSIGNED`.
- **Object-Level Authorization & IDOR Defense**:
  - Every job modification (`PUT /api/v1/jobs/:id`), publication (`POST /api/v1/jobs/:id/publish`), and closure (`POST /api/v1/jobs/:id/close`) validates that the target job's `company_id` matches the authenticated caller's `req.user.companyId`.
  - Cross-tenant tampering attempts return HTTP 403 `FORBIDDEN_COMPANY_SCOPE`.
- **Public Visibility Invariant & Draft Isolation**:
  - Draft jobs are strictly isolated to internal management endpoints. The public search endpoint (`GET /api/v1/jobs`) explicitly filters `status = 'PUBLISHED' AND is_active = 1 AND deleted_at IS NULL`.
  - Direct retrieval of draft jobs via `GET /api/v1/jobs/:id` by applicants or unauthenticated clients returns HTTP 404 `JOB_NOT_FOUND`, preventing resource existence probing or enumeration.
- **SQL Injection Prevention & Safe Sorting**:
  - Public search and filtering use parameterized SQLite queries with `?` bind variables for all user inputs.
  - Sorting parameters are strictly validated against a whitelist of server-defined order clauses (`newest`, `oldest`, `deadline`, `title`, `title_desc`, `salary_desc`). Arbitrary SQL fragments are rejected with HTTP 400 `INVALID_SORT_FIELD`.
- **Public Metadata Minimization**:
  - Public job responses expose only necessary recruitment fields: `id`, `title`, `company_name`, `company_location`, `department_name`, `location`, `employment_type`, `experience_level`, `description`, `requirements`, `salary_min`, `salary_max`, `deadline_utc`, and `created_at`.
  - Internal metadata (recruiter `created_by` user ID, soft-delete flags, internal storage paths, and private audit trails) are omitted from public projections.

---

## 8. Analytics Security & Multi-Tenancy Isolation (Phase 10 Verified)

- **Caller-Derived Scope**: All metrics endpoints (`/api/v1/analytics/*`, `/api/v1/*/analytics`) derive target scope exclusively from the verified JWT token (`req.user.sub` or `req.user.companyId`). Client-supplied query identifiers (`?applicantId=...`, `?companyId=...`) are rejected or ignored for non-administrative callers.
- **Cross-Tenant IDOR Prevention**:
  - Applicant A cannot query Applicant B metrics.
  - Recruiter/HR from Company A cannot retrieve Company B metrics.
  - Interviewer A cannot view unassigned interviews or another interviewer's metrics.
- **SQL Injection Defenses**: All aggregation and date grouping use parameterized SQL statements. Arbitrary injection payloads in query parameters fail safely without exposing unauthorized records.
- **Zero Sensitive Field Leakage**: Passwords, cryptographic salts, API secrets, and raw refresh tokens are strictly excluded from analytics and dashboard payloads.

---

## 9. Administrator Security & Forensic Audit Controls (Phase 11 Verified)

- **Administrator RBAC Enforcement**:
  - All `/api/v1/admin/*` endpoints require `role === 'ADMIN'`. Requests from APPLICANT, RECRUITER, INTERVIEWER, and HR_MANAGER return HTTP 403 `FORBIDDEN`.
- **Privilege Escalation & Body Tampering Defense**:
  - Client attempts to escalate role or bind unauthorized companies are blocked via server-side validation and schema checks.
- **Administrative Data Minimization**:
  - User listings omit `password_hash`, tokens, and internal security materials.
- **Administrator Self-Protection**:
  - Administrators cannot deactivate their own active session (`400 CANNOT_DEACTIVATE_SELF`).
  - The final active administrator cannot be deactivated or downgraded to a lower role (`400 CANNOT_DEACTIVATE_LAST_ADMIN`, `400 CANNOT_DOWNGRADE_LAST_ADMIN`).
- **Forensic Audit Log Immutability**:
  - No `DELETE`, `PUT`, or custom `POST` endpoints exist for audit logs. Records are immutable and append-only.


