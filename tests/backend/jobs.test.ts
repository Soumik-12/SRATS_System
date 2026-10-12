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
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 5: Job Management & Real Public Job Discovery Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let recruiterAToken: string;
  let recruiterBToken: string;
  let recruiterNoCompanyToken: string;
  let applicantToken: string;
  let interviewerToken: string;
  let adminToken: string;

  const companyAId = 'comp-test-alpha';
  const departmentAId = 'dept-test-alpha-eng';
  const companyBId = 'comp-test-beta';
  const departmentBId = 'dept-test-beta-eng';

  before(async () => {
    // 1. Clean in-memory relational database & Flyway migrations
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

    // 2. Setup Companies and Departments
    await companyRepository.create({
      id: companyAId,
      name: 'Alpha Technologies Inc',
      domain: 'alphatech.local',
      industry: 'Software',
      size: '200-500',
      location: 'San Francisco, CA',
    });

    await departmentRepository.create({
      id: departmentAId,
      company_id: companyAId,
      name: 'Backend Systems',
    });

    await companyRepository.create({
      id: companyBId,
      name: 'Beta Global Health',
      domain: 'betaglobal.local',
      industry: 'Healthcare',
      size: '1000+',
      location: 'Boston, MA',
    });

    await departmentRepository.create({
      id: departmentBId,
      company_id: companyBId,
      name: 'Clinical Informatics',
    });

    // 3. Setup Test Users
    // Recruiter A (Company A)
    const userRecA = await userRepository.create({
      id: 'usr-rec-alpha-01',
      email: 'recruiter.alpha@alphatech.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Alice',
      last_name: 'Recruiter',
      company_id: companyAId,
    });
    recruiterAToken = createAccessToken({
      sub: userRecA.id,
      email: userRecA.email,
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: userRecA.first_name,
      lastName: userRecA.last_name,
    });

    // Recruiter B (Company B)
    const userRecB = await userRepository.create({
      id: 'usr-rec-beta-01',
      email: 'recruiter.beta@betaglobal.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Bob',
      last_name: 'Recruiter',
      company_id: companyBId,
    });
    recruiterBToken = createAccessToken({
      sub: userRecB.id,
      email: userRecB.email,
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyBId,
      firstName: userRecB.first_name,
      lastName: userRecB.last_name,
    });

    // Recruiter with no company assigned
    const userRecNoComp = await userRepository.create({
      id: 'usr-rec-unbound-01',
      email: 'recruiter.unbound@srats.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Unbound',
      last_name: 'Recruiter',
      company_id: null,
    });
    recruiterNoCompanyToken = createAccessToken({
      sub: userRecNoComp.id,
      email: userRecNoComp.email,
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: userRecNoComp.first_name,
      lastName: userRecNoComp.last_name,
    });

    // Applicant
    const userApp = await userRepository.create({
      id: 'usr-applicant-p5-01',
      email: 'applicant.charlie@srats.local',
      password_hash: hashPassword('Password123!'),
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Charlie',
      last_name: 'Applicant',
      company_id: null,
    });
    applicantToken = createAccessToken({
      sub: userApp.id,
      email: userApp.email,
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: userApp.first_name,
      lastName: userApp.last_name,
    });

    // Interviewer
    const userInt = await userRepository.create({
      id: 'usr-interviewer-p5-01',
      email: 'interviewer.david@alphatech.local',
      password_hash: hashPassword('Password123!'),
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'David',
      last_name: 'Interviewer',
      company_id: companyAId,
    });
    interviewerToken = createAccessToken({
      sub: userInt.id,
      email: userInt.email,
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: userInt.first_name,
      lastName: userInt.last_name,
    });

    // Admin
    adminToken = createAccessToken({
      sub: 'usr-admin-bootstrap-01',
      email: 'admin@srats.system',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'System',
      lastName: 'Admin',
    });
  });

  after(() => {
    server.close();
    closeDatabase();
  });

  let createdJobId: string;

  // --- 1. JOB CREATION & LIFECYCLE INITIAL STATE ---

  test('1. Recruiter A can create a real Job; starts strictly as DRAFT with derived company scope', async () => {
    const futureDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        title: 'Senior Distributed Systems Engineer',
        description: 'Design and build high-throughput transactional distributed systems.',
        requirements: '5+ years experience with distributed databases, Raft consensus, and TypeScript.',
        location: 'San Francisco, CA',
        employment_type: 'FULL_TIME',
        experience_level: 'SENIOR',
        department_id: departmentAId,
        salary_min: 160000,
        salary_max: 210000,
        deadline_utc: futureDeadline,
        company_id: 'spoofed_company_id_should_be_ignored', // IDOR test on creation
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.job.status, 'DRAFT', 'Job must default to DRAFT');
    assert.strictEqual(body.job.company_id, companyAId, 'Company ID must derive authoritatively from authenticated user');
    assert.strictEqual(body.job.title, 'Senior Distributed Systems Engineer');
    assert.strictEqual(body.job.salary_min, 160000);
    assert.strictEqual(body.job.salary_max, 210000);

    createdJobId = body.job.id;
  });

  test('2. Recruiter without assigned company cannot create job (403 NO_COMPANY_ASSIGNED)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterNoCompanyToken}`,
      },
      body: JSON.stringify({
        title: 'Unbound Job Position',
        description: 'Description text exceeding ten characters.',
        requirements: 'Requirements text exceeding ten characters.',
        location: 'Remote',
        employment_type: 'REMOTE',
        experience_level: 'MID',
        department_id: departmentAId,
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'NO_COMPANY_ASSIGNED');
  });

  test('3. Job creation with department belonging to another company is rejected (400 INVALID_DEPARTMENT)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        title: 'Cross Department Attempt',
        description: 'Description text exceeding ten characters.',
        requirements: 'Requirements text exceeding ten characters.',
        location: 'Remote',
        employment_type: 'FULL_TIME',
        experience_level: 'MID',
        department_id: departmentBId, // Belongs to Company B, Recruiter A is Company A!
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'INVALID_DEPARTMENT');
  });

  test('4. Job creation with min salary exceeding max salary is rejected (400 INVALID_SALARY_RANGE)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        title: 'Salary Mismatch Job',
        description: 'Description text exceeding ten characters.',
        requirements: 'Requirements text exceeding ten characters.',
        location: 'Remote',
        employment_type: 'FULL_TIME',
        experience_level: 'MID',
        department_id: departmentAId,
        salary_min: 200000,
        salary_max: 100000,
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'INVALID_SALARY_RANGE');
  });

  // --- 2. DRAFT VISIBILITY & PUBLIC DISCOVERY DEFENSE ---

  test('5. DRAFT job is NEVER returned in public job discovery (/api/v1/jobs)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.content.length, 0, 'Zero draft jobs should appear publicly');
    assert.strictEqual(body.totalElements, 0);
  });

  test('6. Unauthenticated or applicant request for DRAFT job by ID returns 404 (zero draft exposure)', async () => {
    // Unauthenticated
    const resPublic = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`);
    assert.strictEqual(resPublic.status, 404);

    // Authenticated as Applicant
    const resApplicant = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(resApplicant.status, 404);
  });

  test('7. Authorized Recruiter A can view own DRAFT job internally', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.id, createdJobId);
    assert.strictEqual(body.job.status, 'DRAFT');
  });

  // --- 3. CROSS-COMPANY IDOR & EDITING AUTHORIZATION ---

  test('8. Recruiter B from Company B cannot edit Recruiter A’s draft job (403 FORBIDDEN_COMPANY_SCOPE IDOR)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterBToken}`,
      },
      body: JSON.stringify({
        title: 'Tampered Title by Recruiter B',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'FORBIDDEN_COMPANY_SCOPE');
  });

  test('9. Authorized Recruiter A can edit own DRAFT job', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        title: 'Principal Distributed Systems Architect',
        salary_max: 230000,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.title, 'Principal Distributed Systems Architect');
    assert.strictEqual(body.job.salary_max, 230000);
  });

  // --- 4. PUBLISHING WORKFLOW & VALIDATION ---

  test('10. Recruiter B cannot publish Recruiter A’s job (403 FORBIDDEN_COMPANY_SCOPE IDOR)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterBToken}` },
    });

    assert.strictEqual(res.status, 403);
  });

  test('11. Incomplete draft job cannot be published (Server-side publish validation enforcement)', async () => {
    // Create an incomplete draft (without deadline)
    const incRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        title: 'Incomplete Draft',
        description: 'Short desc exceeding ten chars.',
        requirements: 'Requirements text exceeding ten chars.',
        location: 'Remote',
        employment_type: 'CONTRACT',
        experience_level: 'MID',
        department_id: departmentAId,
        deadline_utc: null, // Missing deadline
      }),
    });
    const incBody = await incRes.json();
    const incJobId = incBody.job.id;

    // Attempt publish without deadline
    const pubRes = await fetch(`${baseUrl}/api/v1/jobs/${incJobId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });

    assert.strictEqual(pubRes.status, 400);
    const pubErr = (await pubRes.json()) as StandardErrorResponse;
    assert.strictEqual(pubErr.error, 'JOB_PUBLISH_VALIDATION_FAILED');
  });

  test('12. Valid DRAFT can be published by authorized Recruiter A -> Transitions to PUBLISHED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.status, 'PUBLISHED');
  });

  test('13. Attempting to republish an already published job returns 400 ALREADY_PUBLISHED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'ALREADY_PUBLISHED');
  });

  // --- 5. PUBLIC DISCOVERY & SEARCH / FILTER / SORT / PAGINATION ---

  test('14. Published job is visible in public discovery (GET /api/v1/jobs)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.content.length, 1);
    assert.strictEqual(body.content[0].id, createdJobId);
    assert.strictEqual(body.content[0].company_name, 'Alpha Technologies Inc');
    assert.strictEqual(body.content[0].department_name, 'Backend Systems');
    assert.strictEqual(body.content[0].status, 'PUBLISHED');
    assert.strictEqual(body.totalElements, 1);
    assert.strictEqual(body.totalPages, 1);
  });

  test('15. Public job details endpoint exposes ONLY sanitized public fields (Zero private metadata leak)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    assert.strictEqual(body.job.title, 'Principal Distributed Systems Architect');
    assert.strictEqual(body.job.company_name, 'Alpha Technologies Inc');
    assert.strictEqual(body.job.created_by, undefined, 'Internal recruiter user ID must NOT leak publicly');
    assert.strictEqual(body.job.deleted_at, undefined);
    assert.strictEqual(body.job.is_active, undefined);
  });

  test('16. Public search queries filter by title, description, and company name', async () => {
    // 16a. Matching keyword
    const resMatch = await fetch(`${baseUrl}/api/v1/jobs?query=Distributed`);
    const bodyMatch = await resMatch.json();
    assert.strictEqual(bodyMatch.content.length, 1);

    // 16b. Matching company name
    const resComp = await fetch(`${baseUrl}/api/v1/jobs?query=Alpha`);
    const bodyComp = await resComp.json();
    assert.strictEqual(bodyComp.content.length, 1);

    // 16c. Non-matching keyword
    const resNone = await fetch(`${baseUrl}/api/v1/jobs?query=NonExistentSkillXYZ`);
    const bodyNone = await resNone.json();
    assert.strictEqual(bodyNone.content.length, 0);
    assert.strictEqual(bodyNone.totalElements, 0);
  });

  test('17. SQL injection characters in search parameter are safely bound without executing', async () => {
    const maliciousQuery = "'; DROP TABLE jobs; --";
    const res = await fetch(`${baseUrl}/api/v1/jobs?query=${encodeURIComponent(maliciousQuery)}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.content.length, 0);

    // Verify jobs table is intact
    const db = getDatabase();
    const count = db.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM jobs;');
    assert.strictEqual(count?.c! >= 1, true, 'Jobs table must remain completely intact');
  });

  test('18. Controlled sorting supports server-mapped keys and rejects raw injection attempts', async () => {
    // Valid sorts
    const resNewest = await fetch(`${baseUrl}/api/v1/jobs?sort=newest`);
    assert.strictEqual(resNewest.status, 200);

    const resTitle = await fetch(`${baseUrl}/api/v1/jobs?sort=title`);
    assert.strictEqual(resTitle.status, 200);

    const resDeadline = await fetch(`${baseUrl}/api/v1/jobs?sort=deadline`);
    assert.strictEqual(resDeadline.status, 200);

    // Invalid / injected sort field
    const resBadSort = await fetch(`${baseUrl}/api/v1/jobs?sort=malicious_col;SELECT+1`);
    assert.strictEqual(resBadSort.status, 400);
    const badBody = (await resBadSort.json()) as StandardErrorResponse;
    assert.strictEqual(badBody.error, 'INVALID_SORT_FIELD');
  });

  test('19. Pagination behaves deterministically with page size and boundaries', async () => {
    // Create 3 additional published jobs for Company B
    const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 1; i <= 3; i++) {
      const jRes = await fetch(`${baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${recruiterBToken}`,
        },
        body: JSON.stringify({
          title: `Beta Healthcare Analyst Position 0${i}`,
          description: 'Analyzing clinical outcomes and healthcare data sets.',
          requirements: 'Clinical domain knowledge and statistical analysis.',
          location: 'Boston, MA',
          employment_type: 'FULL_TIME',
          experience_level: 'MID',
          department_id: departmentBId,
          deadline_utc: futureDeadline,
        }),
      });
      const jBody = await jRes.json();
      await fetch(`${baseUrl}/api/v1/jobs/${jBody.job.id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${recruiterBToken}` },
      });
    }

    // Now 4 total published jobs exist
    const resPage0 = await fetch(`${baseUrl}/api/v1/jobs?size=2&page=0`);
    assert.strictEqual(resPage0.status, 200);
    const bodyPage0 = await resPage0.json();
    assert.strictEqual(bodyPage0.content.length, 2);
    assert.strictEqual(bodyPage0.totalElements, 4);
    assert.strictEqual(bodyPage0.totalPages, 2);
    assert.strictEqual(bodyPage0.page, 0);

    const resPage1 = await fetch(`${baseUrl}/api/v1/jobs?size=2&page=1`);
    assert.strictEqual(resPage1.status, 200);
    const bodyPage1 = await resPage1.json();
    assert.strictEqual(bodyPage1.content.length, 2);
    assert.strictEqual(bodyPage1.page, 1);

    // Verify page 0 and page 1 items are completely distinct
    const idsPage0 = bodyPage0.content.map((j: any) => j.id);
    const idsPage1 = bodyPage1.content.map((j: any) => j.id);
    for (const id of idsPage0) {
      assert.strictEqual(idsPage1.includes(id), false, 'No duplicate items across valid page boundaries');
    }
  });

  // --- 6. JOB EDITING ON PUBLISHED POSITION ---

  test('20. Recruiter A can edit allowed fields on published job; status remains PUBLISHED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        description: 'Updated description for actively published position with higher detail.',
        salary_max: 240000,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.status, 'PUBLISHED');
    assert.strictEqual(body.job.salary_max, 240000);
  });

  // --- 7. CLOSE JOB & HISTORICAL PRESERVATION ---

  test('21. Recruiter B cannot close Recruiter A’s published job (403 FORBIDDEN_COMPANY_SCOPE IDOR)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterBToken}` },
    });

    assert.strictEqual(res.status, 403);
  });

  test('22. Authorized Recruiter A closes published job -> Transitions to CLOSED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.status, 'CLOSED');
  });

  test('23. Closed job is excluded from active public discovery (/api/v1/jobs)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`);
    const body = await res.json();
    const ids = body.content.map((j: any) => j.id);
    assert.strictEqual(ids.includes(createdJobId), false, 'Closed job must not appear in open public discovery');
  });

  test('24. Closed job is preserved in the relational database (Never deleted)', async () => {
    const jobInDb = await jobRepository.findById(createdJobId);
    assert.notStrictEqual(jobInDb, null, 'Closed job must remain preserved in database');
    assert.strictEqual(jobInDb?.status, 'CLOSED');
  });

  test('25. Attempting to modify a CLOSED job is rejected (400 CLOSED_JOB_IMMUTABLE)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        description: 'Attempting to change closed job description',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'CLOSED_JOB_IMMUTABLE');
  });

  test('26. Attempting to publish a CLOSED job is rejected (400 INVALID_JOB_STATUS_TRANSITION)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'INVALID_JOB_STATUS_TRANSITION');
  });

  // --- 8. ROLE PERMISSION BOUNDARIES ---

  test('27. INTERVIEWER role is strictly rejected from job management endpoints (403 FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${interviewerToken}`,
      },
      body: JSON.stringify({
        title: 'Interviewer Job Attempt',
        description: 'Description text exceeding ten chars.',
        requirements: 'Requirements text exceeding ten chars.',
        location: 'Remote',
        employment_type: 'FULL_TIME',
        experience_level: 'MID',
        department_id: departmentAId,
      }),
    });

    assert.strictEqual(res.status, 403);
  });

  test('28. APPLICANT role is strictly rejected from job management endpoints (403 FORBIDDEN)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        title: 'Applicant Job Attempt',
        description: 'Description text exceeding ten chars.',
        requirements: 'Requirements text exceeding ten chars.',
        location: 'Remote',
        employment_type: 'FULL_TIME',
        experience_level: 'MID',
        department_id: departmentAId,
      }),
    });

    assert.strictEqual(res.status, 403);
  });

  test('29. Recruiter can list organization departments and create new department', async () => {
    // List departments
    const listRes = await fetch(`${baseUrl}/api/v1/recruiter/departments`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert.strictEqual(listBody.departments.length >= 1, true);

    // Create new department
    const createRes = await fetch(`${baseUrl}/api/v1/recruiter/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({ name: 'Data Platform' }),
    });
    assert.strictEqual(createRes.status, 201);
    const createBody = await createRes.json();
    assert.strictEqual(createBody.department.name, 'Data Platform');
    assert.strictEqual(createBody.department.company_id, companyAId);
  });

  test('30. Admin role has system-level access to inspect jobs across companies', async () => {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.id, createdJobId);
  });
});
