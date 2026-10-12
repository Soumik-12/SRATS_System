# SRATS — PROJECT CONTRACT
**Smart Recruitment and Applicant Tracking System**
*Revision: 1.0.0 (Phase 0 Baseline)*

---

## 1. Standing Non-Negotiable Rules

1. **Never create fake functionality.** Every interactive control, form submission, and status transition must be wired to real backend endpoints and persistent storage. No dead buttons, no unhandled handlers.
2. **Never fabricate business records.** No mock jobs, applicants, companies, applications, or interviews. If no records exist, return and render a clean, truthful empty state.
3. **Never fabricate metrics.** Dashboard counters, charts, pipeline tallies, and analytics must derive strictly from real database queries and aggregations.
4. **Never create UI controls without backend behavior where backend behavior is required.** Every state-changing button or action must call the API, apply validation, enforce authorization, and persist changes.
5. **Every state-changing operation must persist correctly.** Changes must survive browser refresh, session changes, and service restarts.
6. **Never silently invent requirements.** Adhere strictly to the master specification and documented domain rules.
7. **Document assumptions explicitly.** If an architectural constraint requires adjustment (e.g., container runtime adaptation), record it immediately in `ARCHITECTURE.md` and `PROJECT_CONTRACT.md`.
8. **Never add unrelated features simply to make the system impressive.** Do not add arbitrary widgets, fluff, crypto, fake notifications, or superfluous complexity.
9. **Never overwrite working functionality unnecessarily.** Protect regression test coverage and existing working flows.
10. **Never create duplicate implementations of the same domain behavior.** Single source of truth for all business entities and transitions.
11. **Never mark a workflow complete without testing the complete chain.** Verification requires UI → API → Controller → Service → Repository → DB → Response → UI.
12. **Never hide errors behind fake fallback values.** When an API or AI call fails, return and display a controlled, structured error message.
13. **Development seed data must be isolated and clearly identified.** Never present seed or test fixtures as production records, and provide clean isolation.
14. **Preserve referential integrity.** Foreign keys, unique constraints, and cascade/restrict rules must be strictly enforced.
15. **Backend authorization is the actual security boundary.** Frontend route guards and conditional rendering are merely UX conveniences; every backend request must enforce identity, role, and tenancy/ownership.
16. **Validate critical input on frontend and backend.** Frontend validates for immediate feedback (Zod / React Hook Form), backend validates authoritatively.
17. **AI output is untrusted input until validated.** AI responses must conform to strict schemas, reference existing database IDs, and never bypass business validation.
18. **Do not allow AI to bypass system business rules.** AI cannot directly modify databases, change roles, approve candidates, or alter application states.
19. **If verification fails, stop.** Never proceed to the next phase on a failing gate.
20. **Do not claim success without evidence.** Every completion report requires automated test execution or structured verification logs.

---

## 2. Priority Hierarchy
1. Correct functionality
2. Correct business logic
3. Data integrity
4. Security
5. Privacy
6. Authorization
7. Reliability
8. AI correctness and grounding
9. Maintainability
10. Performance
11. Accessibility
12. UI/UX polish

---

## 3. Five-Role Security Matrix

| Role | Self-Registration | Primary Scope | Authorized Operations |
|---|---|---|---|
| **APPLICANT** | Permitted (Immediate) | Own Profile, Own Resumes, Own Applications, Own Interviews | Browse published jobs, search/filter all published jobs, submit application, manage profile & resume, trigger AI resume analysis, view AI recommendations, view assigned interviews |
| **RECRUITER** | Request / Registration (Assigned to Company) | Company Jobs, Candidate Applications, Pipeline | Create/draft/publish/close jobs, review applications, transition candidate status (Kanban pipeline), schedule/reschedule interviews, request AI assistance |
| **INTERVIEWER** | Request / Assignment | Assigned Interviews Only | View assigned candidate profile details, submit interview ratings & feedback, request AI question ideas based on job requirements |
| **HR_MANAGER** | Company Scoped | Organization-wide Recruitment, Jobs, Applications, Analytics | Manage organization jobs, review full pipeline, company-level hiring analytics, export reports, request AI analytics summaries |
| **ADMIN** | Sign-In Only (Bootstrap/Controlled) | System-wide Platform | User management, company management, role management, audit log inspection, system health monitoring |

---

## 4. Human-In-The-Loop Principle
All recruitment outcomes (shortlisting, rejection, interview scoring, selection, hiring) are human decisions executed by authorized staff. Gemini acts as an advisory document-understanding, summarization, and query-translation engine only.
