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
import { applicationRepository } from '../../server/repositories/applicationRepository.js';
import { resumeRepository, applicantProfileRepository } from '../../server/repositories/applicantProfileRepository.js';
import { interviewRepository } from '../../server/repositories/interviewRepository.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 8: Interview Management & Lifecycle Verification Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let recruiterAToken: string;
  let recruiterBToken: string;
  let applicantAToken: string;
  let applicantBToken: string;
  let interviewerAToken: string;
  let interviewerBToken: string;
  let adminToken: string;

  const companyAId = 'comp-int-alpha';
  const departmentAId = 'dept-int-alpha-eng';
  const companyBId = 'comp-int-beta';
  const departmentBId = 'dept-int-beta-eng';

  let jobAId: string;
  let resumeAId: string;
  let shortlistedAppId: string;
  let appliedOnlyAppId: string;
  let applicantAId: string;
  let applicantBId: string;
  let interviewerAId: string;
  let interviewerBId: string;

  before(async () => {
    // 1. Initialize clean in-memory relational database & run migrations (including V5)
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

    // 2. Setup Organizations
    await companyRepository.create({
      id: companyAId,
      name: 'Alpha Software Corp',
      domain: 'alphasoftware.local',
      industry: 'Technology',
      size: '100-250',
      location: 'San Francisco, CA',
    });

    await departmentRepository.create({
      id: departmentAId,
      company_id: companyAId,
      name: 'Cloud Infrastructure',
    });

    await companyRepository.create({
      id: companyBId,
      name: 'Beta Global Health',
      domain: 'betaglobal.local',
      industry: 'Healthcare',
      size: '500-1000',
      location: 'Boston, MA',
    });

    await departmentRepository.create({
      id: departmentBId,
      company_id: companyBId,
      name: 'Medical Devices',
    });

    // 3. Setup Users
    // Recruiter A (Company A)
    const recA = await userRepository.create({
      id: 'usr-rec-alpha-int',
      email: 'recruiter.alpha@alphasoftware.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Alice',
      last_name: 'Recruiter',
      company_id: companyAId,
    });
    recruiterAToken = createAccessToken({
      sub: recA.id,
      email: recA.email,
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: recA.first_name,
      lastName: recA.last_name,
    });

    // Recruiter B (Company B)
    const recB = await userRepository.create({
      id: 'usr-rec-beta-int',
      email: 'recruiter.beta@betaglobal.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Bob',
      last_name: 'Recruiter',
      company_id: companyBId,
    });
    recruiterBToken = createAccessToken({
      sub: recB.id,
      email: recB.email,
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyBId,
      firstName: recB.first_name,
      lastName: recB.last_name,
    });

    // Interviewer A
    const intA = await userRepository.create({
      id: 'usr-int-alpha-01',
      email: 'interviewer.a@alphasoftware.local',
      password_hash: hashPassword('Password123!'),
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'Ian',
      last_name: 'Interviewer',
      company_id: companyAId,
    });
    interviewerAId = intA.id;
    interviewerAToken = createAccessToken({
      sub: intA.id,
      email: intA.email,
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: intA.first_name,
      lastName: intA.last_name,
    });

    // Interviewer B
    const intB = await userRepository.create({
      id: 'usr-int-alpha-02',
      email: 'interviewer.b@alphasoftware.local',
      password_hash: hashPassword('Password123!'),
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'Irene',
      last_name: 'Interviewer',
      company_id: companyAId,
    });
    interviewerBId = intB.id;
    interviewerBToken = createAccessToken({
      sub: intB.id,
      email: intB.email,
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: intB.first_name,
      lastName: intB.last_name,
    });

    // Applicant A
    const appA = await userRepository.create({
      id: 'usr-cand-alpha-01',
      email: 'candidate.a@example.com',
      password_hash: hashPassword('Password123!'),
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Carlos',
      last_name: 'Candidate',
      company_id: null,
    });
    applicantAId = appA.id;
    applicantAToken = createAccessToken({
      sub: appA.id,
      email: appA.email,
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: appA.first_name,
      lastName: appA.last_name,
    });

    await applicantProfileRepository.upsert({
      user_id: appA.id,
      headline: 'Senior Cloud Systems Architect',
      phone: '+1 555-0199',
      summary: 'Experienced distributed systems engineer with deep Kubernetes expertise',
      location: 'San Francisco, CA',
      website: 'https://carlos.dev',
    });

    const resA = await resumeRepository.create({
      id: 'res-cand-alpha-01',
      applicant_id: appA.id,
      file_name: 'Carlos_Resume.pdf',
      file_mime: 'application/pdf',
      file_size: 1048576,
      storage_path: 'usr-cand-alpha-01/res-cand-alpha-01.pdf',
    });
    resumeAId = resA.id;

    // Applicant B
    const appB = await userRepository.create({
      id: 'usr-cand-beta-01',
      email: 'candidate.b@example.com',
      password_hash: hashPassword('Password123!'),
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Diana',
      last_name: 'Developer',
      company_id: null,
    });
    applicantBId = appB.id;
    applicantBToken = createAccessToken({
      sub: appB.id,
      email: appB.email,
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: appB.first_name,
      lastName: appB.last_name,
    });

    await applicantProfileRepository.upsert({
      user_id: appB.id,
      headline: 'Full-Stack Developer',
      phone: '+1 555-0200',
      summary: 'Frontend and backend engineering',
      location: 'Boston, MA',
      website: 'https://diana.dev',
    });

    const resB = await resumeRepository.create({
      id: 'res-cand-beta-01',
      applicant_id: appB.id,
      file_name: 'Diana_Resume.pdf',
      file_mime: 'application/pdf',
      file_size: 1048576,
      storage_path: 'usr-cand-beta-01/res-cand-beta-01.pdf',
    });

    // Admin Token
    adminToken = createAccessToken({
      sub: 'usr-admin-system-01',
      email: 'admin@srats.local',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'System',
      lastName: 'Administrator',
    });

    // 4. Create Job in Company A
    jobAId = 'job-cloud-eng-01';
    await jobRepository.create({
      id: jobAId,
      company_id: companyAId,
      department_id: departmentAId,
      created_by: recA.id,
      title: 'Principal Distributed Systems Engineer',
      description: 'Design and operate mission-critical distributed platform infrastructure.',
      requirements: '8+ years distributed architecture, Go, Rust, PostgreSQL, high-availability consensus.',
      location: 'San Francisco, CA',
      employment_type: 'FULL_TIME',
      experience_level: 'LEAD',
      salary_min: 180000,
      salary_max: 250000,
      status: 'PUBLISHED',
      deadline_utc: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    // 5. Create Shortlisted Application for Applicant A
    shortlistedAppId = 'app-cand-a-shortlisted';
    await applicationRepository.create({
      id: shortlistedAppId,
      job_id: jobAId,
      applicant_id: appA.id,
      resume_id: resumeAId,
      status: 'APPLIED',
      cover_letter: 'Excited about distributed consensus and cloud infrastructure.',
    });
    // Transition to SHORTLISTED
    await applicationRepository.updateStatus(shortlistedAppId, 'SHORTLISTED', recA.id, 'Candidate profile shortlisted');

    // 6. Create Applied-Only Application (not shortlisted) for testing rejection
    appliedOnlyAppId = 'app-cand-b-applied-only';
    await applicationRepository.create({
      id: appliedOnlyAppId,
      job_id: jobAId,
      applicant_id: appB.id,
      resume_id: resB.id,
      status: 'APPLIED',
      cover_letter: 'Applying directly.',
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
  });

  async function apiRequest<T = any>(
    path: string,
    options: {
      method?: string;
      token?: string;
      body?: unknown;
    } = {}
  ): Promise<{ status: number; body: T; headers: http.IncomingHttpHeaders }> {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const payload = options.body ? JSON.stringify(options.body) : undefined;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data;
            }
            resolve({
              status: res.statusCode || 500,
              body: parsed,
              headers: res.headers,
            });
          });
        }
      );

      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  // --- TESTS ---

  test('1. Unauthenticated interview scheduling returns 401 UNAUTHORIZED', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 401);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'UNAUTHORIZED');
  });

  test('2. Applicant role scheduling attempt returns 403 FORBIDDEN', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: applicantAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN');
  });

  test('3. Interviewer role scheduling attempt returns 403 FORBIDDEN', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: interviewerAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN');
  });

  test('4. Non-existent candidate application returns 404 APPLICATION_NOT_FOUND', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: 'app-non-existent-xyz',
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 404);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'APPLICATION_NOT_FOUND');
  });

  test('5. Non-shortlisted application (APPLIED status) returns 400 INVALID_APPLICATION_STATE', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: appliedOnlyAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 400);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'INVALID_APPLICATION_STATE');
  });

  test('6. Non-existent assigned interviewer returns 404 INTERVIEWER_NOT_FOUND', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: 'usr-non-existent-evaluator',
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 404);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'INTERVIEWER_NOT_FOUND');
  });

  test('7. Assigning a user without INTERVIEWER role returns 400 INVALID_INTERVIEWER_ROLE', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: applicantAId, // Applicant user
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 400);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'INVALID_INTERVIEWER_ROLE');
  });

  test('8. Cross-company IDOR: Recruiter B cannot schedule interview for Company A application (403 FORBIDDEN_COMPANY_SCOPE)', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterBToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN_COMPANY_SCOPE');
  });

  test('9. Invalid interview date (past UTC timestamp) returns 400 VALIDATION_ERROR or INVALID_INTERVIEW_DATE', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/test-abc',
      },
    });

    assert.strictEqual(res.status, 400);
  });

  test('10. Invalid interview type data (IN_PERSON with empty location) returns 400 VALIDATION_ERROR', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'IN_PERSON',
        location_url: ' ', // Empty physical location
      },
    });

    assert.strictEqual(res.status, 400);
  });

  test('11. Unsafe meeting link protocols (javascript:alert(1)) rejected with 400 VALIDATION_ERROR', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'javascript:alert("pwned")',
      },
    });

    assert.strictEqual(res.status, 400);
  });

  let createdInterviewId: string;
  const scheduledTimeUtc = new Date(Date.now() + 2 * 86400000).toISOString(); // 2 days in future

  test('12. Authorized Recruiter schedules valid interview -> 201 Created and persisted', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: scheduledTimeUtc,
        duration_minutes: 60,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/srats-eval-session',
        notes: 'Technical systems evaluation round with focus on consensus protocols',
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.message, 'Interview successfully scheduled.');
    assert.ok(res.body.interview);
    assert.strictEqual(res.body.interview.status, 'SCHEDULED');
    assert.strictEqual(res.body.interview.interview_type, 'ONLINE');
    assert.strictEqual(res.body.interview.duration_minutes, 60);

    createdInterviewId = res.body.interview.id;

    // Verify row in relational database
    const db = getDatabase();
    const row = db.queryOne<{ id: string; status: string; duration_minutes: number }>(
      'SELECT id, status, duration_minutes FROM interviews WHERE id = ?;',
      [createdInterviewId]
    );
    assert.ok(row);
    assert.strictEqual(row.status, 'SCHEDULED');
    assert.strictEqual(row.duration_minutes, 60);
  });

  test('13. Atomic Transaction: application transitioned to INTERVIEW_SCHEDULED with history', async () => {
    const app = await applicationRepository.findById(shortlistedAppId);
    assert.ok(app);
    assert.strictEqual(app.status, 'INTERVIEW_SCHEDULED');

    const history = await applicationRepository.getStatusHistory(shortlistedAppId);
    const transition = history.find((h) => h.to_status === 'INTERVIEW_SCHEDULED');
    assert.ok(transition, 'Status history must record transition to INTERVIEW_SCHEDULED');
    assert.strictEqual(transition.from_status, 'SHORTLISTED');
  });

  test('14. Overlapping interview scheduling for same interviewer rejected with 409 INTERVIEWER_CONFLICT', async () => {
    // Attempt to schedule another interview for interviewer A at overlapping time
    // Overlapping by 30 minutes inside the 60 minute slot
    const overlappingTime = new Date(new Date(scheduledTimeUtc).getTime() + 15 * 60000).toISOString();

    const res = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerAId, // Same interviewer!
        scheduled_at_utc: overlappingTime,
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/conflict-session',
      },
    });

    assert.strictEqual(res.status, 409);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'INTERVIEWER_CONFLICT');
  });

  test('15. Applicant sees only own interview (200 OK)', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'GET',
      token: applicantAToken,
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.interviews));
    assert.strictEqual(res.body.interviews.length, 1);
    assert.strictEqual(res.body.interviews[0].id, createdInterviewId);
    assert.strictEqual(res.body.interviews[0].job_title, 'Principal Distributed Systems Engineer');
  });

  test('16. Applicant cannot access another applicant’s interview (403 FORBIDDEN_IDOR)', async () => {
    // Applicant B tries to access Applicant A's interview directly by ID
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}`, {
      method: 'GET',
      token: applicantBToken,
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN_IDOR');
  });

  test('17. Applicant projection strictly omits internal recruiter notes and internal feedback', async () => {
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}`, {
      method: 'GET',
      token: applicantAToken,
    });

    assert.strictEqual(res.status, 200);
    const interview = res.body.interview;
    assert.strictEqual(interview.id, createdInterviewId);
    // Notes and feedback must not be exposed to applicant
    assert.strictEqual(interview.notes, undefined, 'Internal notes must be omitted from applicant view');
    assert.strictEqual(interview.feedback, undefined, 'Internal feedback must be omitted from applicant view');
  });

  test('18. Assigned interviewer sees assigned interview details (200 OK)', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'GET',
      token: interviewerAToken,
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.interviews));
    assert.strictEqual(res.body.interviews.length, 1);
    assert.strictEqual(res.body.interviews[0].id, createdInterviewId);
    assert.strictEqual(res.body.interviews[0].applicant_name, 'Carlos Candidate');
  });

  test('19. Unassigned interviewer cannot view interview (403 FORBIDDEN_INTERVIEWER_SCOPE)', async () => {
    // Interviewer B was not assigned to this interview
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}`, {
      method: 'GET',
      token: interviewerBToken,
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN_INTERVIEWER_SCOPE');
  });

  test('20. Unassigned interviewer cannot submit feedback (403 UNAUTHORIZED_INTERVIEWER)', async () => {
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}/feedback`, {
      method: 'POST',
      token: interviewerBToken, // Interviewer B is not assigned
      body: {
        rating: 4,
        notes: 'Unassigned review attempt',
        recommendation: 'HIRE',
      },
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'UNAUTHORIZED_INTERVIEWER');
  });

  test('21. Assigned interviewer submits evaluation feedback -> 201 Created, transitions status to COMPLETED', async () => {
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}/feedback`, {
      method: 'POST',
      token: interviewerAToken, // Assigned interviewer A
      body: {
        rating: 5,
        notes: 'Candidate demonstrated exemplary mastery of Raft consensus and high-throughput transactional storage architecture.',
        recommendation: 'STRONG_HIRE',
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.message, 'Interview evaluation feedback successfully submitted.');
    assert.ok(res.body.feedback);
    assert.strictEqual(res.body.feedback.rating, 5);
    assert.strictEqual(res.body.feedback.recommendation, 'STRONG_HIRE');

    // Verify interview status auto-transitioned to COMPLETED
    const intDb = await interviewRepository.findById(createdInterviewId);
    assert.ok(intDb);
    assert.strictEqual(intDb.status, 'COMPLETED');
  });

  test('22. Feedback rating and recommendation persisted truthfully in relational database', async () => {
    const feedback = await interviewRepository.getFeedback(createdInterviewId);
    assert.ok(feedback);
    assert.strictEqual(feedback.rating, 5);
    assert.strictEqual(feedback.recommendation, 'STRONG_HIRE');
    assert.strictEqual(feedback.interviewer_id, interviewerAId);
  });

  test('23. Applicant cannot view internal evaluation feedback (403 FORBIDDEN)', async () => {
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}/feedback`, {
      method: 'GET',
      token: applicantAToken,
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN');
  });

  test('24. Authorized Recruiter can view feedback for company’s interview (200 OK)', async () => {
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}/feedback`, {
      method: 'GET',
      token: recruiterAToken,
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.feedback);
    assert.strictEqual(res.body.feedback.rating, 5);
    assert.strictEqual(res.body.feedback.recommendation, 'STRONG_HIRE');
  });

  test('25. Cross-company Recruiter B cannot view feedback for Company A’s interview (403 FORBIDDEN_COMPANY_SCOPE)', async () => {
    const res = await apiRequest(`/api/v1/interviews/${createdInterviewId}/feedback`, {
      method: 'GET',
      token: recruiterBToken,
    });

    assert.strictEqual(res.status, 403);
    const err = res.body as StandardErrorResponse;
    assert.strictEqual(err.error, 'FORBIDDEN_COMPANY_SCOPE');
  });

  test('26. Recruiter can reschedule interview -> 200 OK, status RESCHEDULED, preserves history', async () => {
    // Schedule a second interview to test rescheduling
    const interview2Time = new Date(Date.now() + 5 * 86400000).toISOString();
    const createRes = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerBId, // Interviewer B
        scheduled_at_utc: interview2Time,
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/round-2',
        notes: 'Round 2 engineering leadership interview',
      },
    });
    assert.strictEqual(createRes.status, 201);
    const interview2Id = createRes.body.interview.id;

    // Reschedule interview 2
    const rescheduledTime = new Date(Date.now() + 6 * 86400000).toISOString();
    const reschedRes = await apiRequest(`/api/v1/interviews/${interview2Id}/reschedule`, {
      method: 'POST',
      token: recruiterAToken,
      body: {
        scheduled_at_utc: rescheduledTime,
        duration_minutes: 60,
        reason: 'Evaluator requested time adjustment due to architecture conference',
      },
    });

    assert.strictEqual(reschedRes.status, 200);
    assert.strictEqual(reschedRes.body.interview.status, 'RESCHEDULED');
    assert.strictEqual(reschedRes.body.interview.scheduled_at_utc, rescheduledTime);
    assert.strictEqual(reschedRes.body.interview.duration_minutes, 60);

    // Verify notes preserve history
    assert.ok(reschedRes.body.interview.notes.includes('[Rescheduled from'));
  });

  test('27. Recruiter can cancel interview -> 200 OK, status CANCELLED, preserved in DB', async () => {
    // Schedule interview 3 to test cancellation
    const interview3Time = new Date(Date.now() + 10 * 86400000).toISOString();
    const createRes = await apiRequest('/api/v1/interviews', {
      method: 'POST',
      token: recruiterAToken,
      body: {
        application_id: shortlistedAppId,
        interviewer_id: interviewerBId,
        scheduled_at_utc: interview3Time,
        duration_minutes: 30,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/round-3',
      },
    });
    assert.strictEqual(createRes.status, 201);
    const interview3Id = createRes.body.interview.id;

    const cancelRes = await apiRequest(`/api/v1/interviews/${interview3Id}/cancel`, {
      method: 'POST',
      token: recruiterAToken,
      body: {
        reason: 'Position requisition filled; evaluation session cancelled',
      },
    });

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.interview.status, 'CANCELLED');

    // Record remains preserved in database
    const db = getDatabase();
    const row = db.queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM interviews WHERE id = ?;',
      [interview3Id]
    );
    assert.ok(row, 'Cancelled interview must remain in database');
    assert.strictEqual(row.status, 'CANCELLED');

    // Attempting to cancel again returns 400
    const cancelAgainRes = await apiRequest(`/api/v1/interviews/${interview3Id}/cancel`, {
      method: 'POST',
      token: recruiterAToken,
    });
    assert.strictEqual(cancelAgainRes.status, 400);
  });

  test('28. Cannot reschedule or submit feedback on a CANCELLED interview (400)', async () => {
    // Query cancelled interview from previous test
    const db = getDatabase();
    const cancelledRow = db.queryOne<{ id: string }>(
      "SELECT id FROM interviews WHERE status = 'CANCELLED' LIMIT 1;"
    );
    assert.ok(cancelledRow);

    // Attempt reschedule
    const reschedRes = await apiRequest(`/api/v1/interviews/${cancelledRow.id}/reschedule`, {
      method: 'POST',
      token: recruiterAToken,
      body: {
        scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert.strictEqual(reschedRes.status, 400);

    // Attempt feedback submission
    const feedbackRes = await apiRequest(`/api/v1/interviews/${cancelledRow.id}/feedback`, {
      method: 'POST',
      token: interviewerBToken,
      body: {
        rating: 3,
        notes: 'Cannot submit feedback on cancelled',
        recommendation: 'NO_HIRE',
      },
    });
    assert.strictEqual(feedbackRes.status, 400);
  });

  test('29. Cannot cancel an already COMPLETED interview (400)', async () => {
    const cancelCompletedRes = await apiRequest(`/api/v1/interviews/${createdInterviewId}/cancel`, {
      method: 'POST',
      token: recruiterAToken,
      body: { reason: 'Attempt cancel completed' },
    });
    assert.strictEqual(cancelCompletedRes.status, 400);
  });

  test('30. Admin role has platform-wide access to inspect interviews across companies', async () => {
    const res = await apiRequest('/api/v1/interviews', {
      method: 'GET',
      token: adminToken,
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.interviews));
    assert.ok(res.body.interviews.length >= 2);
  });

  test('31. Timezone verification: ISO UTC format roundtrip preservation', async () => {
    const testUtc = '2026-11-15T14:30:00.000Z';
    const interview = await interviewRepository.create({
      id: 'int-tz-verification',
      application_id: shortlistedAppId,
      interviewer_id: interviewerAId,
      scheduled_by: 'usr-rec-alpha-int',
      scheduled_at_utc: testUtc,
      duration_minutes: 45,
      interview_type: 'ONLINE',
      location_url: 'https://meet.google.com/tz-test',
      notes: 'Timezone test',
    });

    assert.strictEqual(interview.scheduled_at_utc, testUtc);

    const retrieved = await interviewRepository.findById('int-tz-verification');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.scheduled_at_utc, testUtc);

    // Date object parsed in UTC equals original milliseconds
    const parsedEpoch = new Date(retrieved.scheduled_at_utc).getTime();
    assert.strictEqual(parsedEpoch, new Date(testUtc).getTime());
  });
});
