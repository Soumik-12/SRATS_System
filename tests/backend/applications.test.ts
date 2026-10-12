import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createExpressApp } from '../../server/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { authService } from '../../server/services/authService.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { companyRepository, departmentRepository } from '../../server/repositories/companyRepository.js';
import { jobRepository } from '../../server/repositories/jobRepository.js';
import { resumeRepository, applicantProfileRepository } from '../../server/repositories/applicantProfileRepository.js';
import { applicationRepository } from '../../server/repositories/applicationRepository.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 6 & 7: Application Workflow, State Machine & Recruiter Pipeline Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let recruiterAToken: string;
  let recruiterBToken: string;
  let applicantAToken: string;
  let applicantBToken: string;
  let interviewerToken: string;
  let adminToken: string;

  const companyAId = 'comp-app-alpha';
  const departmentAId = 'dept-app-alpha-eng';
  const companyBId = 'comp-app-beta';
  const departmentBId = 'dept-app-beta-eng';

  let applicantAId: string;
  let applicantBId: string;
  let recruiterAId: string;
  let recruiterBId: string;

  let resumeAId: string;
  let resumeBId: string;

  let draftJobId: string;
  let closedJobId: string;
  let expiredJobId: string;
  let publishedJobAId: string;
  let publishedJobBId: string;

  let submittedApplicationId: string;

  before(async () => {
    initDatabase(':memory:');
    runMigrations();
    await authService.bootstrapAdmin();

    const app = createExpressApp();
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    // Seed companies and departments
    await companyRepository.create({
      id: companyAId,
      name: 'Alpha Systems Inc',
      domain: 'alphasystems.io',
      industry: 'Cloud Infrastructure',
      size: '200-500',
      location: 'Seattle, WA',
    });

    await departmentRepository.create({
      id: departmentAId,
      company_id: companyAId,
      name: 'Platform Engineering',
    });

    await companyRepository.create({
      id: companyBId,
      name: 'Beta Global Health',
      domain: 'betaglobal.org',
      industry: 'Healthcare Technology',
      size: '50-100',
      location: 'Boston, MA',
    });

    await departmentRepository.create({
      id: departmentBId,
      company_id: companyBId,
      name: 'Data Science',
    });

    // Seed users
    const pwdHash = await hashPassword('Password123!');

    // 1. Recruiter A (Alpha Systems)
    const recA = await userRepository.create({
      id: 'usr-recruiter-alpha-1',
      email: 'recruiter.alpha@alphasystems.io',
      password_hash: pwdHash,
      role: 'RECRUITER',
      first_name: 'Rachel',
      last_name: 'Alpha',
      company_id: companyAId,
    });
    recruiterAId = recA.id;
    recruiterAToken = createAccessToken({
      sub: recA.id,
      email: recA.email,
      role: recA.role,
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: recA.first_name,
      lastName: recA.last_name,
    });

    // 2. Recruiter B (Beta Global)
    const recB = await userRepository.create({
      id: 'usr-recruiter-beta-1',
      email: 'recruiter.beta@betaglobal.org',
      password_hash: pwdHash,
      role: 'RECRUITER',
      first_name: 'Robert',
      last_name: 'Beta',
      company_id: companyBId,
    });
    recruiterBId = recB.id;
    recruiterBToken = createAccessToken({
      sub: recB.id,
      email: recB.email,
      role: recB.role,
      accountStatus: 'ACTIVE',
      companyId: companyBId,
      firstName: recB.first_name,
      lastName: recB.last_name,
    });

    // 3. Applicant A
    const appA = await userRepository.create({
      id: 'usr-cand-alice-1',
      email: 'alice.candidate@domain.test',
      password_hash: pwdHash,
      role: 'APPLICANT',
      first_name: 'Alice',
      last_name: 'Candidate',
      company_id: null,
    });
    applicantAId = appA.id;
    applicantAToken = createAccessToken({
      sub: appA.id,
      email: appA.email,
      role: appA.role,
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: appA.first_name,
      lastName: appA.last_name,
    });

    await applicantProfileRepository.upsert({
      user_id: appA.id,
      headline: 'Principal Backend Engineer',
      phone: '+1 555-0101',
      location: 'Seattle, WA',
      summary: '10+ years architecting high-scale distributed systems.',
    });

    const resA = await resumeRepository.create({
      id: 'res-alice-primary',
      applicant_id: appA.id,
      file_name: 'Alice_Resume_2026.pdf',
      file_mime: 'application/pdf',
      file_size: 102400,
      storage_path: '/storage/alice_resume.pdf',
      raw_text: 'Go, TypeScript, PostgreSQL, Distributed Systems',
    });
    resumeAId = resA.id;

    // 4. Applicant B
    const appB = await userRepository.create({
      id: 'usr-cand-bob-2',
      email: 'bob.candidate@domain.test',
      password_hash: pwdHash,
      role: 'APPLICANT',
      first_name: 'Bob',
      last_name: 'Candidate',
      company_id: null,
    });
    applicantBId = appB.id;
    applicantBToken = createAccessToken({
      sub: appB.id,
      email: appB.email,
      role: appB.role,
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: appB.first_name,
      lastName: appB.last_name,
    });

    await applicantProfileRepository.upsert({
      user_id: appB.id,
      headline: 'Software Engineer',
      phone: '+1 555-0202',
      location: 'Boston, MA',
      summary: 'Data and web developer.',
    });

    const resB = await resumeRepository.create({
      id: 'res-bob-primary',
      applicant_id: appB.id,
      file_name: 'Bob_Resume_2026.pdf',
      file_mime: 'application/pdf',
      file_size: 98000,
      storage_path: '/storage/bob_resume.pdf',
      raw_text: 'Python, React, SQL',
    });
    resumeBId = resB.id;

    // 5. Interviewer
    const interviewer = await userRepository.create({
      id: 'usr-eval-alpha-1',
      email: 'evaluator@alphasystems.io',
      password_hash: pwdHash,
      role: 'INTERVIEWER',
      first_name: 'Ian',
      last_name: 'Interviewer',
      company_id: companyAId,
    });
    interviewerToken = createAccessToken({
      sub: interviewer.id,
      email: interviewer.email,
      role: interviewer.role,
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: interviewer.first_name,
      lastName: interviewer.last_name,
    });

    // 6. Admin
    adminToken = createAccessToken({
      sub: 'usr-admin-root',
      email: 'admin@srats.local',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'System',
      lastName: 'Administrator',
    });

    // Seed Jobs
    // DRAFT Job
    const draftJob = await jobRepository.create({
      id: 'job-app-draft-1',
      company_id: companyAId,
      department_id: departmentAId,
      created_by: recruiterAId,
      title: 'Draft Cloud Infrastructure Architect',
      description: 'Design resilient multitenant infrastructure.',
      requirements: 'Experience with Kubernetes and Terraform.',
      location: 'Seattle, WA',
      employment_type: 'FULL_TIME',
      experience_level: 'SENIOR',
      salary_min: 150000,
      salary_max: 200000,
      deadline_utc: null,
      status: 'DRAFT',
    });
    draftJobId = draftJob.id;

    // CLOSED Job
    const closedJob = await jobRepository.create({
      id: 'job-app-closed-1',
      company_id: companyAId,
      department_id: departmentAId,
      created_by: recruiterAId,
      title: 'Closed Distributed Systems Role',
      description: 'Historical closed position for verification.',
      requirements: 'Historical qualifications.',
      location: 'Remote',
      employment_type: 'FULL_TIME',
      experience_level: 'SENIOR',
      salary_min: null,
      salary_max: null,
      deadline_utc: null,
      status: 'CLOSED',
    });
    closedJobId = closedJob.id;

    // EXPIRED Deadline Job
    const expiredJob = await jobRepository.create({
      id: 'job-app-expired-1',
      company_id: companyAId,
      department_id: departmentAId,
      created_by: recruiterAId,
      title: 'Expired Deadline Engineer',
      description: 'Position with expired deadline.',
      requirements: 'Fast application turnaround.',
      location: 'Remote',
      employment_type: 'CONTRACT',
      experience_level: 'MID',
      salary_min: null,
      salary_max: null,
      status: 'PUBLISHED',
      deadline_utc: '2026-01-01T00:00:00.000Z',
    });
    expiredJobId = expiredJob.id;

    // PUBLISHED Job A (Company Alpha)
    const pubJobA = await jobRepository.create({
      id: 'job-app-published-alpha',
      company_id: companyAId,
      department_id: departmentAId,
      created_by: recruiterAId,
      title: 'Principal Distributed Systems Engineer',
      description: 'Lead engineering for transactional services and storage engines.',
      requirements: 'Strong database internals, concurrency, and high throughput.',
      location: 'Seattle, WA',
      employment_type: 'FULL_TIME',
      experience_level: 'LEAD',
      salary_min: 180000,
      salary_max: 240000,
      status: 'PUBLISHED',
      deadline_utc: '2026-12-31T23:59:59.000Z',
    });
    publishedJobAId = pubJobA.id;

    // PUBLISHED Job B (Company Beta)
    const pubJobB = await jobRepository.create({
      id: 'job-app-published-beta',
      company_id: companyBId,
      department_id: departmentBId,
      created_by: recruiterBId,
      title: 'Senior Clinical Data Scientist',
      description: 'Develop analytics pipelines on medical datasets.',
      requirements: 'Python, statistics, and HIPAA data pipelines.',
      location: 'Boston, MA',
      employment_type: 'FULL_TIME',
      experience_level: 'SENIOR',
      salary_min: null,
      salary_max: null,
      status: 'PUBLISHED',
      deadline_utc: '2026-12-31T23:59:59.000Z',
    });
    publishedJobBId = pubJobB.id;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
  });

  test('1. Application submission to DRAFT job is strictly rejected (400 JOB_NOT_PUBLISHED)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: draftJobId,
        resume_id: resumeAId,
        cover_letter: 'I want to apply to this draft job',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'JOB_NOT_PUBLISHED');
  });

  test('2. Application submission to CLOSED job is strictly rejected (400 JOB_NOT_PUBLISHED)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: closedJobId,
        resume_id: resumeAId,
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'JOB_NOT_PUBLISHED');
  });

  test('3. Application submission past deadline is strictly rejected (400 APPLICATION_DEADLINE_EXPIRED)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: expiredJobId,
        resume_id: resumeAId,
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'APPLICATION_DEADLINE_EXPIRED');
  });

  test('4. Candidate cannot submit application with another candidate’s resume (400 INVALID_RESUME IDOR)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobAId,
        resume_id: resumeBId, // Belongs to Bob!
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'INVALID_RESUME');
  });

  test('5. Non-APPLICANT role cannot submit job application (403 FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobAId,
        resume_id: resumeAId,
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'FORBIDDEN');
  });

  test('6. Authorized applicant submits valid application to PUBLISHED job -> 201 Created', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobAId,
        resume_id: resumeAId,
        cover_letter: 'I have deep expertise with distributed consensus and database storage layers.',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.message, 'Application successfully submitted.');
    assert.ok(body.application.id);
    assert.strictEqual(body.application.status, 'APPLIED');
    assert.strictEqual(body.application.applicant_id, applicantAId);
    assert.strictEqual(body.application.job_id, publishedJobAId);

    submittedApplicationId = body.application.id;
  });

  test('7. Relational database verifies atomic status history record for initial APPLIED status', async () => {
    const history = await applicationRepository.getStatusHistory(submittedApplicationId);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].from_status, null);
    assert.strictEqual(history[0].to_status, 'APPLIED');
    assert.strictEqual(history[0].changed_by, applicantAId);
  });

  test('8. Duplicate application prevention: Second application to same job is rejected (409 DUPLICATE_APPLICATION)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobAId,
        resume_id: resumeAId,
        cover_letter: 'Trying to apply again',
      }),
    });

    assert.strictEqual(res.status, 409);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'DUPLICATE_APPLICATION');
  });

  test('9. Candidate can list their own submitted applications (GET /api/v1/applications/my)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/my`, {
      headers: {
        Authorization: `Bearer ${applicantAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.applications));
    assert.strictEqual(body.applications.length, 1);
    assert.strictEqual(body.applications[0].id, submittedApplicationId);
    assert.strictEqual(body.applications[0].job_title, 'Principal Distributed Systems Engineer');
    assert.strictEqual(body.applications[0].company_name, 'Alpha Systems Inc');
    assert.strictEqual(body.applications[0].status, 'APPLIED');
  });

  test('10. Other applicant B sees 0 applications under their own profile', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/my`, {
      headers: {
        Authorization: `Bearer ${applicantBToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.applications.length, 0);
  });

  test('11. Applicant B cannot view Applicant A’s application details (403 FORBIDDEN IDOR)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}`, {
      headers: {
        Authorization: `Bearer ${applicantBToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'FORBIDDEN');
  });

  test('12. Recruiter A can list applications for their company pipeline (GET /api/v1/applications)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      headers: {
        Authorization: `Bearer ${recruiterAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.applications));
    assert.strictEqual(body.applications.length, 1);
    assert.strictEqual(body.applications[0].id, submittedApplicationId);
    assert.strictEqual(body.applications[0].applicant_name, 'Alice Candidate');
  });

  test('13. Recruiter B cannot view Recruiter A’s candidate application (403 FORBIDDEN_COMPANY_SCOPE)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}`, {
      headers: {
        Authorization: `Bearer ${recruiterBToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'FORBIDDEN_COMPANY_SCOPE');
  });

  test('14. Recruiter A views application details with full audit timeline (GET /api/v1/applications/:id)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}`, {
      headers: {
        Authorization: `Bearer ${recruiterAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.application);
    assert.ok(body.history);
    assert.strictEqual(body.application.id, submittedApplicationId);
    assert.strictEqual(body.history.length, 1);
    assert.strictEqual(body.history[0].to_status, 'APPLIED');
  });

  test('15. Recruiter A transitions candidate: APPLIED -> SHORTLISTED (allowed)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'SHORTLISTED',
        note: 'Candidate meets all backend distributed systems criteria.',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.application.status, 'SHORTLISTED');

    // Verify history recorded in database
    const history = await applicationRepository.getStatusHistory(submittedApplicationId);
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[1].from_status, 'APPLIED');
    assert.strictEqual(history[1].to_status, 'SHORTLISTED');
    assert.strictEqual(history[1].changed_by, recruiterAId);
  });

  test('16. Recruiter B cannot change status on Recruiter A’s candidate (403 FORBIDDEN_COMPANY_SCOPE)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterBToken}`,
      },
      body: JSON.stringify({
        status: 'SELECTED',
        note: 'Unauthorized cross-tenant attempt',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'FORBIDDEN_COMPANY_SCOPE');
  });

  test('17. Invalid status transition: SHORTLISTED -> APPLIED is rejected (400 INVALID_STATUS_TRANSITION)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'APPLIED',
        note: 'Invalid backwards transition',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'INVALID_STATUS_TRANSITION');
  });

  test('18. No-op status transition: SHORTLISTED -> SHORTLISTED is rejected (400 INVALID_STATUS_TRANSITION)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'SHORTLISTED',
        note: 'Same status',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'INVALID_STATUS_TRANSITION');
  });

  test('19. Recruiter transitions: SHORTLISTED -> SELECTED (allowed)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'SELECTED',
        note: 'Candidate selected by the hiring committee.',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.application.status, 'SELECTED');
  });

  test('20. Recruiter transitions: SELECTED -> HIRED (allowed)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'HIRED',
        note: 'Formal offer signed and accepted.',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.application.status, 'HIRED');
  });

  test('21. Terminal state: HIRED -> REJECTED or HIRED -> SHORTLISTED is rejected (400 INVALID_STATUS_TRANSITION)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'REJECTED',
        note: 'Attempting to reject hired employee',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'INVALID_STATUS_TRANSITION');
  });

  test('22. Second candidate B applies and is REJECTED directly from APPLIED stage', async () => {
    // 1. Bob applies to Job B
    const applyRes = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantBToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobBId,
        resume_id: resumeBId,
      }),
    });
    assert.strictEqual(applyRes.status, 201);
    const appB = await applyRes.json();

    // 2. Recruiter B rejects Bob
    const rejectRes = await fetch(`${baseUrl}/api/v1/applications/${appB.application.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterBToken}`,
      },
      body: JSON.stringify({
        status: 'REJECTED',
        note: 'Position requires 5+ years of healthcare domain expertise.',
      }),
    });

    assert.strictEqual(rejectRes.status, 200);
    const rejectBody = await rejectRes.json();
    assert.strictEqual(rejectBody.application.status, 'REJECTED');

    // 3. Terminal state: REJECTED cannot transition back
    const reviveRes = await fetch(`${baseUrl}/api/v1/applications/${appB.application.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterBToken}`,
      },
      body: JSON.stringify({
        status: 'SHORTLISTED',
      }),
    });
    assert.strictEqual(reviveRes.status, 400);
  });

  test('23. Candidate / Interviewer cannot change application status (403 FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications/${submittedApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        status: 'SHORTLISTED',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'FORBIDDEN');
  });

  test('24. Admin role has universal pipeline oversight to inspect applications across companies', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applications`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.applications.length >= 2, 'Admin must see applications across all organizations');
  });
});
