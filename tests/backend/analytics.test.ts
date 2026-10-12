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
import { interviewRepository } from '../../server/repositories/interviewRepository.js';
import { notificationRepository } from '../../server/repositories/notificationRepository.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 10: Real Role Dashboards & Query Analytics Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const companyAId = 'comp-anal-alpha';
  const companyBId = 'comp-anal-beta';
  const deptAId = 'dept-anal-alpha-eng';
  const deptBId = 'dept-anal-beta-sales';

  let applicantAToken: string;
  let applicantBToken: string;
  let recruiterAToken: string;
  let recruiterBToken: string;
  let interviewerAToken: string;
  let interviewerBToken: string;
  let hrAToken: string;
  let adminToken: string;

  let applicantAId: string;
  let applicantBId: string;
  let recruiterAId: string;
  let recruiterBId: string;
  let interviewerAId: string;
  let interviewerBId: string;
  let hrAId: string;
  let adminId: string;

  let resumeAId: string;
  let jobA1Id: string;
  let jobA2Id: string;
  let jobB1Id: string;
  let appA1Id: string;
  let appA2Id: string;
  let interviewA1Id: string;

  before(async () => {
    initDatabase(':memory:');
    runMigrations();
    await authService.bootstrapAdmin();
    adminId = 'usr-admin-bootstrap-01';
    const adminUser = (await userRepository.findById(adminId))!;

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

    adminToken = createAccessToken({
      sub: adminId,
      email: adminUser.email,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'System',
      lastName: 'Administrator',
    });

    // 1. Companies
    await companyRepository.create({
      id: companyAId,
      name: 'Alpha Analytics Inc',
      domain: 'alpha.example',
      industry: 'Technology',
      size: '100-500',
      location: 'San Francisco, CA',
    });

    await companyRepository.create({
      id: companyBId,
      name: 'Beta Biotech Corp',
      domain: 'beta.example',
      industry: 'Biotech',
      size: '50-100',
      location: 'Boston, MA',
    });

    // 2. Departments
    await departmentRepository.create({
      id: deptAId,
      company_id: companyAId,
      name: 'Core Engineering',
    });

    await departmentRepository.create({
      id: deptBId,
      company_id: companyBId,
      name: 'Commercial Sales',
    });

    const passHash = await hashPassword('SecurePass123!');

    // 3. Users
    // Applicant A (with applications and interview)
    applicantAId = 'usr-anal-app-a';
    await userRepository.create({
      id: applicantAId,
      email: 'applicant.a@candidate.local',
      password_hash: passHash,
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Alice',
      last_name: 'Applicant',
      company_id: null,
    });
    applicantAToken = createAccessToken({
      sub: applicantAId,
      email: 'applicant.a@candidate.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Alice',
      lastName: 'Applicant',
    });

    // Applicant B (clean / zero state)
    applicantBId = 'usr-anal-app-b';
    await userRepository.create({
      id: applicantBId,
      email: 'applicant.b@candidate.local',
      password_hash: passHash,
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Bob',
      last_name: 'Applicant',
      company_id: null,
    });
    applicantBToken = createAccessToken({
      sub: applicantBId,
      email: 'applicant.b@candidate.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Bob',
      lastName: 'Applicant',
    });

    // Recruiter A (Company A)
    recruiterAId = 'usr-anal-rec-a';
    await userRepository.create({
      id: recruiterAId,
      email: 'recruiter.a@alpha.example',
      password_hash: passHash,
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Rachel',
      last_name: 'Recruiter',
      company_id: companyAId,
    });
    recruiterAToken = createAccessToken({
      sub: recruiterAId,
      email: 'recruiter.a@alpha.example',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: 'Rachel',
      lastName: 'Recruiter',
    });

    // Recruiter B (Company B)
    recruiterBId = 'usr-anal-rec-b';
    await userRepository.create({
      id: recruiterBId,
      email: 'recruiter.b@beta.example',
      password_hash: passHash,
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Robert',
      last_name: 'Recruiter',
      company_id: companyBId,
    });
    recruiterBToken = createAccessToken({
      sub: recruiterBId,
      email: 'recruiter.b@beta.example',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyBId,
      firstName: 'Robert',
      lastName: 'Recruiter',
    });

    // Interviewer A (Company A)
    interviewerAId = 'usr-anal-int-a';
    await userRepository.create({
      id: interviewerAId,
      email: 'interviewer.a@alpha.example',
      password_hash: passHash,
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'Ian',
      last_name: 'Interviewer',
      company_id: companyAId,
    });
    interviewerAToken = createAccessToken({
      sub: interviewerAId,
      email: 'interviewer.a@alpha.example',
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: 'Ian',
      lastName: 'Interviewer',
    });

    // Interviewer B (Company B)
    interviewerBId = 'usr-anal-int-b';
    await userRepository.create({
      id: interviewerBId,
      email: 'interviewer.b@beta.example',
      password_hash: passHash,
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'Iris',
      last_name: 'Interviewer',
      company_id: companyBId,
    });
    interviewerBToken = createAccessToken({
      sub: interviewerBId,
      email: 'interviewer.b@beta.example',
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: companyBId,
      firstName: 'Iris',
      lastName: 'Interviewer',
    });

    // HR Manager A (Company A)
    hrAId = 'usr-anal-hr-a';
    await userRepository.create({
      id: hrAId,
      email: 'hr.a@alpha.example',
      password_hash: passHash,
      role: 'HR_MANAGER',
      account_status: 'ACTIVE',
      first_name: 'Hannah',
      last_name: 'HR',
      company_id: companyAId,
    });
    hrAToken = createAccessToken({
      sub: hrAId,
      email: 'hr.a@alpha.example',
      role: 'HR_MANAGER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: 'Hannah',
      lastName: 'HR',
    });

    // 4. Seed Profile & Resume for Applicant A
    await applicantProfileRepository.upsert({
      user_id: applicantAId,
      headline: 'Principal Backend Engineer',
      summary: '10 years building distributed systems and high-throughput pipelines.',
      location: 'San Francisco, CA',
      phone: '+1 415-555-0199',
    });

    resumeAId = 'res-anal-a-1';
    await resumeRepository.create({
      id: resumeAId,
      applicant_id: applicantAId,
      storage_path: 'resumes/alice.pdf',
      file_name: 'AliceResume.pdf',
      file_mime: 'application/pdf',
      file_size: 154200,
      is_active: 1,
    });

    // 5. Seed Jobs
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

    // Company A: 2 published jobs, 1 draft
    jobA1Id = 'job-anal-alpha-1';
    await jobRepository.create({
      id: jobA1Id,
      company_id: companyAId,
      department_id: deptAId,
      title: 'Senior Distributed Systems Architect',
      description: 'Lead architecture of database caching and distributed consensus.',
      requirements: 'TypeScript, SQL, Distributed Algorithms',
      experience_level: 'SENIOR',
      salary_min: 180000,
      salary_max: 230000,
      location: 'San Francisco, CA',
      employment_type: 'FULL_TIME',
      status: 'PUBLISHED',
      created_by: recruiterAId,
      deadline_utc: futureDate,
    });

    jobA2Id = 'job-anal-alpha-2';
    await jobRepository.create({
      id: jobA2Id,
      company_id: companyAId,
      department_id: deptAId,
      title: 'Site Reliability Specialist',
      description: 'Ensure 99.99% uptime of core services.',
      requirements: 'Linux, Docker, Observability',
      experience_level: 'MID',
      salary_min: 140000,
      salary_max: 170000,
      location: 'Remote',
      employment_type: 'FULL_TIME',
      status: 'PUBLISHED',
      created_by: recruiterAId,
      deadline_utc: futureDate,
    });

    // Company B: 1 published job
    jobB1Id = 'job-anal-beta-1';
    await jobRepository.create({
      id: jobB1Id,
      company_id: companyBId,
      department_id: deptBId,
      title: 'Enterprise Account Executive',
      description: 'Grow biotech enterprise client portfolio.',
      requirements: 'SaaS, Biotech Sales',
      experience_level: 'SENIOR',
      salary_min: 120000,
      salary_max: 200000,
      location: 'Boston, MA',
      employment_type: 'FULL_TIME',
      status: 'PUBLISHED',
      created_by: recruiterBId,
      deadline_utc: futureDate,
    });

    // 6. Applications
    // Applicant A applied to Job A1 (SHORTLISTED) and Job A2 (APPLIED)
    appA1Id = 'app-anal-a-1';
    await applicationRepository.create({
      id: appA1Id,
      job_id: jobA1Id,
      applicant_id: applicantAId,
      resume_id: resumeAId,
      status: 'SHORTLISTED',
      cover_letter: 'Excited about distributed data architectures.',
    });

    appA2Id = 'app-anal-a-2';
    await applicationRepository.create({
      id: appA2Id,
      job_id: jobA2Id,
      applicant_id: applicantAId,
      resume_id: resumeAId,
      status: 'APPLIED',
      cover_letter: 'Deep experience in site reliability engineering.',
    });

    // 7. Interview for Applicant A on Job A1 assigned to Interviewer A
    interviewA1Id = 'int-anal-a-1';
    const futureInterview = new Date(Date.now() + 86400000 * 2).toISOString();
    await interviewRepository.create({
      id: interviewA1Id,
      application_id: appA1Id,
      interviewer_id: interviewerAId,
      scheduled_by: recruiterAId,
      scheduled_at_utc: futureInterview,
      duration_minutes: 60,
      interview_type: 'ONLINE',
      location_url: 'https://meet.google.com/anal-test',
      notes: null,
    });

    // 8. Notification for Applicant A
    await notificationRepository.create({
      id: 'notif-anal-a-1',
      user_id: applicantAId,
      type: 'INTERVIEW_SCHEDULED',
      title: 'Technical Round Scheduled',
      message: 'Your architecture interview is set for next week.',
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  // --- SECURITY & AUTHORIZATION TESTS ---

  test('1. Unauthenticated request to /api/v1/analytics/applicant returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/applicant`);
    assert.strictEqual(res.status, 401);
  });

  test('2. APPLICANT accessing recruiter analytics returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/recruiter`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.status, 403);
  });

  test('3. APPLICANT accessing HR analytics returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/hr`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('4. RECRUITER accessing admin analytics returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/admin`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('5. INTERVIEWER accessing HR analytics returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/interviewer`, {
      headers: { Authorization: `Bearer ${interviewerAToken}` },
    });
    assert.strictEqual(res.status, 200);

    const hrRes = await fetch(`${baseUrl}/api/v1/analytics/hr`, {
      headers: { Authorization: `Bearer ${interviewerAToken}` },
    });
    assert.strictEqual(hrRes.status, 403);
  });

  // --- APPLICANT ANALYTICS & IDOR TESTS ---

  test('6. Applicant A retrieves exact database-derived metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/applicant`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.metrics.totalApplications, 2);
    assert.strictEqual(data.metrics.appliedCount, 1);
    assert.strictEqual(data.metrics.shortlistedCount, 1);
    assert.strictEqual(data.metrics.upcomingInterviewsCount, 1);
    assert.strictEqual(data.metrics.unreadNotificationsCount, 1);
    assert.ok(data.metrics.profileCompletenessPercent > 50);

    assert.strictEqual(data.recentApplications.length, 2);
    assert.strictEqual(data.upcomingInterviews.length, 1);
    assert.strictEqual(data.upcomingInterviews[0].company_name, 'Alpha Analytics Inc');
  });

  test('7. Applicant B receives honest zero-state metrics (No data leakage from Applicant A)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/applicant`, {
      headers: { Authorization: `Bearer ${applicantBToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.metrics.totalApplications, 0);
    assert.strictEqual(data.metrics.appliedCount, 0);
    assert.strictEqual(data.metrics.shortlistedCount, 0);
    assert.strictEqual(data.metrics.upcomingInterviewsCount, 0);
    assert.strictEqual(data.metrics.unreadNotificationsCount, 0);
    assert.strictEqual(data.recentApplications.length, 0);
    assert.strictEqual(data.upcomingInterviews.length, 0);
  });

  test('8. Applicant A cannot retrieve Applicant B metrics via query or headers (Strict caller-bound scope)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/applicant?applicantId=${applicantBId}`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Scope must strictly remain Applicant A (2 applications, not Bob's 0)
    assert.strictEqual(data.metrics.totalApplications, 2);
  });

  // --- RECRUITER ANALYTICS & TENANCY ISOLATION TESTS ---

  test('9. Recruiter A retrieves Company A metrics (2 active jobs, 2 applications, 1 upcoming interview)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/recruiter`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.metrics.activeJobsCount, 2);
    assert.strictEqual(data.metrics.totalJobsCount, 2);
    assert.strictEqual(data.metrics.totalApplicationsCount, 2);
    assert.strictEqual(data.metrics.shortlistedCount, 1);
    assert.strictEqual(data.metrics.appliedCount, 1);
    assert.strictEqual(data.metrics.upcomingInterviewsCount, 1);
    assert.strictEqual(data.recentApplications.length, 2);
    assert.ok(data.applicationTrends.length >= 1);
  });

  test('10. Recruiter B retrieves Company B metrics (1 active job, 0 applications)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/recruiter`, {
      headers: { Authorization: `Bearer ${recruiterBToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.metrics.activeJobsCount, 1);
    assert.strictEqual(data.metrics.totalApplicationsCount, 0);
    assert.strictEqual(data.recentApplications.length, 0);
  });

  test('11. Recruiter A passing ?companyId=comp-anal-beta is locked to Company A (No cross-company spoofing)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/recruiter?companyId=${companyBId}`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // Must still reflect Company A (2 jobs, 2 applications)
    assert.strictEqual(data.metrics.activeJobsCount, 2);
    assert.strictEqual(data.metrics.totalApplicationsCount, 2);
  });

  // --- INTERVIEWER ANALYTICS TESTS ---

  test('12. Interviewer A sees 1 assigned upcoming interview; Interviewer B sees 0', async () => {
    const resA = await fetch(`${baseUrl}/api/v1/analytics/interviewer`, {
      headers: { Authorization: `Bearer ${interviewerAToken}` },
    });
    assert.strictEqual(resA.status, 200);
    const dataA = await resA.json();
    assert.strictEqual(dataA.metrics.upcomingInterviewsCount, 1);
    assert.strictEqual(dataA.upcomingInterviews.length, 1);
    assert.strictEqual(dataA.upcomingInterviews[0].candidate_name, 'Alice Applicant');

    const resB = await fetch(`${baseUrl}/api/v1/analytics/interviewer`, {
      headers: { Authorization: `Bearer ${interviewerBToken}` },
    });
    assert.strictEqual(resB.status, 200);
    const dataB = await resB.json();
    assert.strictEqual(dataB.metrics.upcomingInterviewsCount, 0);
    assert.strictEqual(dataB.upcomingInterviews.length, 0);
  });

  // --- HR MANAGER ANALYTICS TESTS ---

  test('13. HR Manager A gets company department breakdown and hiring metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/hr`, {
      headers: { Authorization: `Bearer ${hrAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.metrics.totalJobsCount, 2);
    assert.strictEqual(data.metrics.activeJobsCount, 2);
    assert.strictEqual(data.metrics.totalApplicationsCount, 2);
    assert.strictEqual(data.metrics.totalInterviewsCount, 1);

    assert.strictEqual(data.departmentMetrics.length, 1);
    assert.strictEqual(data.departmentMetrics[0].department_name, 'Core Engineering');
    assert.strictEqual(data.departmentMetrics[0].job_count, 2);
    assert.strictEqual(data.departmentMetrics[0].application_count, 2);
  });

  // --- ADMIN ANALYTICS TESTS ---

  test('14. System Administrator retrieves platform-wide analytics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.ok(data.metrics.totalUsersCount >= 8);
    assert.strictEqual(data.metrics.totalCompaniesCount, 2);
    assert.strictEqual(data.metrics.totalJobsCount, 3);
    assert.strictEqual(data.metrics.publishedJobsCount, 3);
    assert.strictEqual(data.metrics.totalApplicationsCount, 2);
    assert.strictEqual(data.metrics.totalInterviewsCount, 1);
    assert.ok(data.usersByRole.APPLICANT >= 2);
    assert.ok(data.usersByRole.RECRUITER >= 2);
    assert.ok(data.usersByRole.INTERVIEWER >= 2);
    assert.ok(data.usersByRole.ADMIN >= 1);
  });

  // --- DATA REACTIVITY TEST ---

  test('15. Transitioning application status reactively updates metrics', async () => {
    // Advance appA1Id from SHORTLISTED to SELECTED
    const updateRes = await fetch(`${baseUrl}/api/v1/applications/${appA1Id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({ status: 'SELECTED', note: 'Exceptional system design performance' }),
    });
    assert.strictEqual(updateRes.status, 200);

    // Refresh Applicant A metrics
    const appRes = await fetch(`${baseUrl}/api/v1/analytics/applicant`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const appData = await appRes.json();
    assert.strictEqual(appData.metrics.selectedCount, 1);
    assert.strictEqual(appData.metrics.shortlistedCount, 0);

    // Refresh Recruiter A metrics
    const recRes = await fetch(`${baseUrl}/api/v1/analytics/recruiter`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    const recData = await recRes.json();
    assert.strictEqual(recData.metrics.selectedCount, 1);
    assert.strictEqual(recData.metrics.shortlistedCount, 0);
  });

  test('16. Direct route /api/v1/applicant/analytics returns valid metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applicant/analytics`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.metrics.totalApplications, 2);
  });

  test('17. Direct route /api/v1/recruiter/analytics returns valid metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/recruiter/analytics`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.metrics.totalJobsCount, 2);
  });

  test('18. Direct route /api/v1/interviewer/analytics returns valid metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/interviewer/analytics`, {
      headers: { Authorization: `Bearer ${interviewerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.metrics.upcomingInterviewsCount, 1);
  });

  test('19. Direct route /api/v1/hr/analytics returns valid metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/analytics`, {
      headers: { Authorization: `Bearer ${hrAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.metrics.totalJobsCount, 2);
  });

  test('20. Direct route /api/v1/admin/analytics returns valid metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.metrics.totalUsersCount >= 8);
  });

  test('21. SQL injection payloads in query params fail safely without leaking other tenant records', async () => {
    const sqli = "' OR '1'='1' -- ";
    const res = await fetch(`${baseUrl}/api/v1/analytics/recruiter?companyId=${encodeURIComponent(sqli)}`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Must remain strictly locked to Recruiter A's company (Company A)
    assert.strictEqual(data.metrics.totalJobsCount, 2);
  });
});
