# SRATS — API CONTRACT
**RESTful Endpoints, Request/Response Payloads, and Error Standards**
*Revision: 1.0.0 (Phase 0 Baseline)*

---

## 1. General Conventions

- **Base URI**: `/api/v1`
- **Content Type**: `application/json` (except `/resumes/upload` which uses `multipart/form-data`)
- **Authentication**: `Authorization: Bearer <access_token>`
- **Timestamps**: ISO-8601 UTC strings (e.g. `2026-10-06T12:00:00.000Z`)

---

## 2. Standard Response Envelopes

### 2.1 Success Item Response
```json
{
  "success": true,
  "data": { ... }
}
```

### 2.2 Success Paginated List Response
```json
{
  "content": [ ... ],
  "page": 0,
  "size": 20,
  "totalElements": 42,
  "totalPages": 3
}
```

### 2.3 Standard Error Envelope
```json
{
  "timestamp": "2026-10-06T12:00:00.000Z",
  "status": 400,
  "error": "BAD_REQUEST",
  "message": "Descriptive human-readable error message",
  "path": "/api/v1/jobs/123/apply",
  "traceId": "srats-req-4a8b29c"
}
```

---

## 3. Core Endpoint Catalog

### 3.0 System Infrastructure & Diagnostic
- `GET /api/v1/health` — Returns real-time health verification of the backend service and relational database ping latency.
  - **Response 200 (Healthy)**:
    ```json
    {
      "status": "UP",
      "service": "SRATS",
      "version": "1.0.0",
      "timestamp": "2026-10-06T12:00:00.000Z",
      "database": "UP",
      "uptimeSeconds": 42,
      "checks": {
        "database": {
          "status": "UP",
          "latencyMs": 0.4
        }
      }
    }
    ```
  - **Response 503 (Unhealthy)**:
    Returned when database ping fails or server is impaired.

- `GET /api/v1/test/error` *(Development/Testing only)* — Returns intentional 400 error verifying standard error envelope format.

### 3.1 Authentication & Profile (VERIFIED Phase 3)
- `POST /api/v1/auth/register` — Self-registration for Applicant (or access request for Recruiter/Interviewer/HR). Public Admin registration returns 403 Forbidden.
  - **Request Body**:
    ```json
    {
      "email": "applicant@example.com",
      "password": "Password123!",
      "confirmPassword": "Password123!",
      "firstName": "John",
      "lastName": "Doe",
      "role": "APPLICANT"
    }
    ```
  - **Response 201 Created**:
    ```json
    {
      "message": "Account successfully registered.",
      "user": {
        "id": "usr-...",
        "email": "applicant@example.com",
        "role": "APPLICANT",
        "accountStatus": "ACTIVE",
        "firstName": "John",
        "lastName": "Doe",
        "companyId": null
      }
    }
    ```

- `POST /api/v1/auth/login` — Login with email, password, and expected role context.
  - **Request Body**:
    ```json
    {
      "email": "applicant@example.com",
      "password": "Password123!",
      "expectedRole": "APPLICANT"
    }
    ```
  - **Response 200 OK**:
    ```json
    {
      "user": {
        "id": "usr-...",
        "email": "applicant@example.com",
        "role": "APPLICANT",
        "accountStatus": "ACTIVE",
        "firstName": "John",
        "lastName": "Doe",
        "companyId": null
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "64_char_hex_token...",
      "expiresIn": 900
    }
    ```

- `POST /api/v1/auth/refresh` — Exchange refresh token for rotated token pair.
  - **Request Body**: `{ "refreshToken": "..." }`
  - **Response 200 OK**: `{ "user": { ... }, "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }`

- `POST /api/v1/auth/logout` — Revokes refresh token in database.
  - **Request Body**: `{ "refreshToken": "..." }`
  - **Response 200 OK**: `{ "message": "Successfully logged out." }`

- `GET /api/v1/auth/me` — Retrieve current authenticated user profile. Requires `Authorization: Bearer <access_token>`.
  - **Response 200 OK**: `{ "user": { "id": "...", "email": "...", "role": "...", "accountStatus": "ACTIVE", "firstName": "...", "lastName": "...", "companyId": null } }`

### 3.2 Applicant Profile, Skills & Resumes (VERIFIED Phase 4)
All endpoints require `Authorization: Bearer <access_token>` with `role: "APPLICANT"`. Ownership is strictly derived from the authenticated principal token (`req.user.sub`).

- `GET /api/v1/applicant/profile` — Retrieve current applicant profile and deterministic completeness rating.
  - **Response 200 OK**:
    ```json
    {
      "profile": {
        "userId": "usr-...",
        "email": "applicant@example.com",
        "firstName": "Alice",
        "lastName": "Applicant",
        "phone": "+1 555-0199",
        "headline": "Full-Stack Engineer",
        "summary": "Experienced engineer...",
        "location": "San Francisco, CA",
        "website": "https://example.com",
        "completeness": {
          "percentage": 80,
          "missingFields": ["Uploaded Resume"]
        }
      }
    }
    ```

- `PUT /api/v1/applicant/profile` — Update applicant profile details.
  - **Request Body**:
    ```json
    {
      "headline": "Senior Software Architect",
      "summary": "Summary text...",
      "phone": "+1 555-0199",
      "location": "Austin, TX",
      "website": "https://example.com"
    }
    ```
  - **Response 200 OK**: `{ "message": "Profile updated successfully", "profile": { ... } }`

- `GET /api/v1/applicant/skills` — List recorded skills for authenticated applicant.
  - **Response 200 OK**: `{ "skills": [ { "id": "skl-...", "skill_name": "TypeScript", "level": "EXPERT" } ] }`

- `POST /api/v1/applicant/skills` — Add new skill. Duplicates are rejected with 409 Conflict.
  - **Request Body**: `{ "skill_name": "TypeScript", "level": "EXPERT" }`
  - **Response 201 Created**: `{ "message": "Skill added successfully", "skill": { ... } }`

- `DELETE /api/v1/applicant/skills/:id` — Delete skill. Protected by principal ownership check.
  - **Response 200 OK**: `{ "success": true, "message": "Skill successfully removed." }`

- `GET /api/v1/applicant/resumes` — List uploaded resumes for authenticated applicant.
  - **Response 200 OK**:
    ```json
    {
      "resumes": [
        {
          "id": "res-...",
          "applicantId": "usr-...",
          "fileName": "Alice_Resume.pdf",
          "fileMime": "application/pdf",
          "fileSize": 1048576,
          "isPrimary": true,
          "isActive": true,
          "createdAt": "2026-10-06T12:00:00.000Z"
        }
      ]
    }
    ```

- `POST /api/v1/applicant/resumes` — Upload resume (`multipart/form-data`, key `file`). Max 5MB. PDF/DOC/DOCX only. Atomically deactivates previous resumes and activates new upload.
  - **Response 201 Created**: `{ "message": "Resume uploaded successfully", "resume": { ... } }`
  - **Response 400**: Unsupported extension or spoofed magic byte header.
  - **Response 413**: File exceeds 5MB limit.

- `GET /api/v1/applicant/resumes/:id/file` — Secure authenticated binary download.
  - **Response 200 OK**: Binary payload with `Content-Disposition: inline; filename="..."` and `Cache-Control: private, no-cache, no-store, must-revalidate`.
  - **Response 404 / 403**: Denied for unauthenticated requests or other applicants' resumes (IDOR defense).

- `DELETE /api/v1/applicant/resumes/:id` — Archive resume (soft-delete). Preserves historical integrity for existing applications.
  - **Response 200 OK**: `{ "success": true, "message": "Resume successfully archived." }`

### 3.3 Jobs & Organization Management (VERIFIED Phase 5)

- `GET /api/v1/jobs` — Public universal job discovery. Excludes drafts. Supports parameterized queries, filters, safe sorting, and pagination.
  - **Query Parameters**:
    - `query` (optional string): Keyword match across title, description, requirements, company name, location.
    - `location` (optional string): Location filter.
    - `employment_type` (optional string): `FULL_TIME` | `PART_TIME` | `CONTRACT` | `INTERNSHIP` | `REMOTE`.
    - `experience_level` (optional string): `ENTRY` | `MID` | `SENIOR` | `LEAD` | `EXECUTIVE`.
    - `company_id` (optional string): Filter by organization ID.
    - `department_id` (optional string): Filter by department ID.
    - `sort` (optional string): `newest` (default) | `oldest` | `deadline` | `title` | `title_desc` | `salary_desc`.
    - `page` (optional integer, default 0): 0-indexed page number.
    - `size` (optional integer, default 20, max 100): Page size.
  - **Response 200 OK**:
    ```json
    {
      "content": [
        {
          "id": "job-...",
          "title": "Principal Distributed Systems Architect",
          "company_name": "Alpha Technologies Inc",
          "company_location": "San Francisco, CA",
          "department_name": "Backend Systems",
          "location": "San Francisco, CA",
          "employment_type": "FULL_TIME",
          "experience_level": "SENIOR",
          "description": "...",
          "requirements": "...",
          "salary_min": 160000,
          "salary_max": 240000,
          "status": "PUBLISHED",
          "deadline_utc": "2026-11-06T12:00:00.000Z",
          "created_at": "2026-10-06T12:00:00.000Z"
        }
      ],
      "page": 0,
      "size": 20,
      "totalElements": 1,
      "totalPages": 1
    }
    ```

- `GET /api/v1/jobs/:id` — Retrieve job details.
  - Public / Applicant caller: Returns sanitized `PublicJob` projection. Draft jobs return 404 NOT_FOUND.
  - Authorized Recruiter / HR / Admin caller: Returns full internal job details.

- `POST /api/v1/jobs` — Create job requisition in DRAFT status. Requires `RECRUITER`, `HR_MANAGER`, or `ADMIN`.
  - Authoritative company scope is derived from `req.user.companyId`.
  - **Request Body**:
    ```json
    {
      "title": "Senior Distributed Systems Engineer",
      "department_id": "dept-...",
      "location": "San Francisco, CA",
      "employment_type": "FULL_TIME",
      "experience_level": "SENIOR",
      "salary_min": 160000,
      "salary_max": 210000,
      "deadline_utc": "2026-11-06T12:00:00.000Z",
      "description": "Design and build high-throughput systems...",
      "requirements": "5+ years distributed systems..."
    }
    ```
  - **Response 201 Created**: `{ "message": "Job draft successfully created.", "job": { ... } }`

- `PUT /api/v1/jobs/:id` — Update job requisition. Protected by company scope IDOR verification.
  - DRAFT: All fields editable.
  - PUBLISHED: Description, requirements, location, salary, deadline editable; status cannot be mutated.
  - CLOSED: Rejected with 400 `CLOSED_JOB_IMMUTABLE`.
  - **Response 200 OK**: `{ "message": "Job successfully updated.", "job": { ... } }`

- `POST /api/v1/jobs/:id/publish` — Publish job. Transition from DRAFT to PUBLISHED. Enforces server-side validation (title $\ge 5$, description $\ge 20$, requirements $\ge 10$, valid future deadline).
  - **Response 200 OK**: `{ "message": "Job position has been successfully published.", "job": { ... } }`

- `POST /api/v1/jobs/:id/close` — Close job. Transition to CLOSED. Preserves DB record; removes from open public discovery.
  - **Response 200 OK**: `{ "message": "Job position has been successfully closed.", "job": { ... } }`

- `GET /api/v1/recruiter/jobs` — List jobs for recruiter's company (query param: `?status=DRAFT|PUBLISHED|CLOSED|ALL`).
  - **Response 200 OK**: `{ "jobs": [ ... ] }`

- `GET /api/v1/recruiter/company` — Retrieve organization profile.
  - **Response 200 OK**: `{ "company": { ... } }`

- `GET /api/v1/recruiter/departments` — List organization departments.
  - **Response 200 OK**: `{ "departments": [ ... ] }`

- `POST /api/v1/recruiter/departments` — Add department.
  - **Request Body**: `{ "name": "Platform Infrastructure" }`
  - **Response 201 Created**: `{ "message": "Department successfully created.", "department": { ... } }`

- `POST /api/v1/recruiter/setup-company` — Initialize organization profile if unassigned.
  - **Request Body**: `{ "name": "Acme Corp", "industry": "Technology", "location": "Austin, TX" }`
  - **Response 201 Created**: `{ "message": "Company organization profile successfully initialized.", "company": { ... } }`

### 3.4 Applications & Pipeline
- `POST   /api/v1/applications` — Submit application to a published job
- `GET    /api/v1/applications/my` — List applicant's own applications
- `GET    /api/v1/applications` — List applications for recruiter's company (filterable by jobId, status)
- `GET    /api/v1/applications/:id` — Get full application details with history
- `PUT    /api/v1/applications/:id/status` — Change status (Kanban movement with validation & history)

### 3.5 Interviews
- `GET    /api/v1/interviews` — List interviews (role-scoped: applicant sees own, interviewer sees assigned, recruiter sees company)
- `POST   /api/v1/interviews` — Schedule an interview (Recruiter/HR)
- `PUT    /api/v1/interviews/:id/reschedule` — Reschedule interview with reason
- `PUT    /api/v1/interviews/:id/cancel` — Cancel interview
- `POST   /api/v1/interviews/:id/feedback` — Submit feedback and rating (Assigned interviewer only)

### 3.6 Notifications & Audit
- `GET    /api/v1/notifications` — List user notifications
- `POST   /api/v1/notifications/:id/read` — Mark notification read
- `POST   /api/v1/notifications/mark-all-read` — Mark all notifications read
- `GET    /api/v1/notifications/unread-count` — Retrieve honest unread count

### 3.7 Role Dashboards & Query Analytics (VERIFIED Phase 10)
- `GET    /api/v1/analytics/applicant` (or `/api/v1/applicant/analytics`) — Authenticated candidate metrics (applications by status, upcoming interviews, unread notifications, readiness percent)
- `GET    /api/v1/analytics/recruiter` (or `/api/v1/recruiter/analytics`) — Recruiter company metrics (active jobs, candidate status distribution, upcoming interviews, pending feedback, 30-day trends)
- `GET    /api/v1/analytics/interviewer` (or `/api/v1/interviewer/analytics`) — Assigned interviewer metrics (upcoming/past interviews, completed evaluations, pending feedback)
- `GET    /api/v1/analytics/hr` (or `/api/v1/hr/analytics`) — HR organizational oversight (total/active jobs, candidates, department hiring metrics, 30-day hiring trends)
- `GET    /api/v1/analytics/admin` (or `/api/v1/admin/analytics`) — Platform governance metrics (total/active/deactivated users, registered/active companies, total requisitions, audit events, users by role)

### 3.8 Administration & Forensic Audit (VERIFIED Phase 11)
- `GET    /api/v1/admin/users` — Paginated user listing with search, role, status, and company filters (sensitive hashes omitted)
- `PUT    /api/v1/admin/users/:id/status` — Activate or deactivate user (`ACTIVE` | `PENDING` | `DEACTIVATED`) with self-protection & last-admin safeguards
- `PUT    /api/v1/admin/users/:id/role` — Update user security role with last-admin downgrade protection
- `PUT    /api/v1/admin/users/:id/company` — Bind user to tenant company
- `GET    /api/v1/admin/companies` — List all registered companies with user & job tallies
- `POST   /api/v1/admin/companies` — Register new organization tenant
- `PUT    /api/v1/admin/companies/:id/status` — Toggle company active/inactive status
- `GET    /api/v1/admin/audit-logs` — Query forensic audit logs with pagination, actor, action, entity, and date filters

### 3.9 AI Endpoints (Server-Side)
- `POST   /api/v1/ai/resume/analyze` — Parse resume and extract structured profile data
  - **Authorization**: Authenticated `APPLICANT` owning the targeted resume
  - **Request Body**:
    ```json
    {
      "resumeId": "res-12345",
      "consentAccepted": true
    }
    ```
  - **Response 200 OK**:
    ```json
    {
      "success": true,
      "message": "Resume analysis completed successfully.",
      "analysis": {
        "analysisId": "ranal-...",
        "resumeId": "res-12345",
        "applicantId": "usr-...",
        "consentGiven": true,
        "status": "COMPLETED",
        "modelUsed": "gemini-3.8-flash",
        "promptVersion": "resume-extraction-v1.0.0",
        "extracted": {
          "headline": "Senior Full-Stack Engineer",
          "summary": "Experienced software architect...",
          "skills": [
            {
              "skillName": "TypeScript",
              "level": "EXPERT",
              "evidenceQuote": "Over 5 years building production TypeScript...",
              "isDirectFact": true
            }
          ],
          "experience": [ ... ],
          "education": [ ... ],
          "certifications": [ ... ],
          "overallConfidenceScore": 0.94,
          "confidenceExplanation": "Directly grounded against document text."
        },
        "isConfirmed": false,
        "injectionDetected": false
      }
    }
    ```
  - **Response 400 Bad Request**: When `consentAccepted` is false or missing.
  - **Response 403 Forbidden**: When `resumeId` belongs to another candidate.
  - **Response 404 Not Found**: When `resumeId` does not exist.

- `GET    /api/v1/ai/resume/:resumeId` — Retrieve existing completed analysis for resume
  - **Authorization**: Authenticated `APPLICANT` owning the resume
  - **Response 200 OK**: `{ "success": true, "analysis": { ... } }`

- `POST   /api/v1/ai/resume/confirm` — Candidate explicitly applies extracted skills and profile details
  - **Authorization**: Authenticated `APPLICANT`
  - **Request Body**:
    ```json
    {
      "resumeId": "res-12345",
      "analysisId": "ranal-...",
      "headline": "Senior Full-Stack Engineer",
      "summary": "Experienced software architect...",
      "selectedSkills": [
        { "skill_name": "TypeScript", "level": "EXPERT" }
      ]
    }
    ```
  - **Response 200 OK**: `{ "success": true, "message": "Resume analysis successfully confirmed and profile updated.", "addedSkillsCount": 1 }`

- `POST   /api/v1/ai/tools/execute` — Execute approved AI backend tool with role and tenancy check
  - **Authorization**: Authenticated users; permitted roles enforced per tool
  - **Request Body**:
    ```json
    {
      "name": "get_applicant_profile",
      "arguments": { "applicantId": "usr-..." }
    }
    ```
  - **Response 200 OK**: `{ "success": true, "tool": "get_applicant_profile", "result": { ... } }`
  - **Response 400 Bad Request**: Invalid arguments schema
  - **Response 403 Forbidden**: Insufficient role or cross-tenant IDOR violation
  - **Response 404 Not Found**: Unregistered tool name

- `POST   /api/v1/ai/jobs/recommend` — Recommend published jobs based on applicant signals (Phase 14)
- `POST   /api/v1/ai/interview/questions` — Generate job-aligned interview questions (Phase 15)
- `POST   /api/v1/ai/assistant/chat` — Role-aware natural language assistant with authorized tool calling (Phase 15)

