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
import { notificationRepository } from '../../server/repositories/notificationRepository.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 9: Domain Event Notifications Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let recruiterToken: string;
  let applicantToken: string;
  let otherApplicantToken: string;
  let interviewerToken: string;

  let recruiterId: string;
  let applicantId: string;
  let otherApplicantId: string;
  let interviewerId: string;

  const companyId = 'comp-notif-alpha';
  const departmentId = 'dept-notif-eng';

  let testJobId: string;
  let testResumeId: string;
  let testApplicationId: string;
  let testInterviewId: string;

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

    // 1. Seed Company & Department
    await companyRepository.create({
      id: companyId,
      name: 'Notification Dynamics Inc',
      domain: 'notifdynamics.com',
      industry: 'Software Development',
      size: '50-100',
      location: 'San Francisco, CA',
    });

    await departmentRepository.create({
      id: departmentId,
      company_id: companyId,
      name: 'Engineering',
    });

    // 2. Seed Users
    const passwordHash = await hashPassword('SecurePass123!');

    recruiterId = 'usr-notif-recruiter';
    await userRepository.create({
      id: recruiterId,
      email: 'recruiter@notifdynamics.com',
      password_hash: passwordHash,
      first_name: 'Rachel',
      last_name: 'Recruiter',
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      company_id: companyId,
    });
    recruiterToken = createAccessToken({
      sub: recruiterId,
      email: 'recruiter@notifdynamics.com',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId,
      firstName: 'Rachel',
      lastName: 'Recruiter',
    });

    applicantId = 'usr-notif-applicant';
    await userRepository.create({
      id: applicantId,
      email: 'alex@candidate.com',
      password_hash: passwordHash,
      first_name: 'Alex',
      last_name: 'Applicant',
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      company_id: null,
    });
    applicantToken = createAccessToken({
      sub: applicantId,
      email: 'alex@candidate.com',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Alex',
      lastName: 'Applicant',
    });

    otherApplicantId = 'usr-notif-other-applicant';
    await userRepository.create({
      id: otherApplicantId,
      email: 'sam@candidate.com',
      password_hash: passwordHash,
      first_name: 'Sam',
      last_name: 'Other',
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      company_id: null,
    });
    otherApplicantToken = createAccessToken({
      sub: otherApplicantId,
      email: 'sam@candidate.com',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Sam',
      lastName: 'Other',
    });

    interviewerId = 'usr-notif-interviewer';
    await userRepository.create({
      id: interviewerId,
      email: 'ian@notifdynamics.com',
      password_hash: passwordHash,
      first_name: 'Ian',
      last_name: 'Interviewer',
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      company_id: companyId,
    });
    interviewerToken = createAccessToken({
      sub: interviewerId,
      email: 'ian@notifdynamics.com',
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId,
      firstName: 'Ian',
      lastName: 'Interviewer',
    });

    // 3. Candidate profile & resume
    await applicantProfileRepository.upsert({
      user_id: applicantId,
      headline: 'Full-Stack Developer',
      location: 'San Francisco, CA',
    });

    testResumeId = 'res-notif-alex-1';
    await resumeRepository.create({
      id: testResumeId,
      applicant_id: applicantId,
      storage_path: 'resumes/alex.pdf',
      file_name: 'AlexResume.pdf',
      file_mime: 'application/pdf',
      file_size: 104200,
      is_active: 1,
    });

    // 4. Published Job
    testJobId = 'job-notif-lead-dev';
    const futureDeadline = new Date(Date.now() + 86400000 * 30).toISOString();
    await jobRepository.create({
      id: testJobId,
      company_id: companyId,
      department_id: departmentId,
      title: 'Senior Systems Engineer',
      description: 'Design robust distributed event-driven systems and real-time notification pipelines.',
      requirements: 'TypeScript, SQL, Distributed Systems',
      experience_level: 'SENIOR',
      salary_min: 150000,
      salary_max: 200000,
      location: 'San Francisco, CA',
      employment_type: 'FULL_TIME',
      status: 'PUBLISHED',
      created_by: recruiterId,
      deadline_utc: futureDeadline,
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  test('1. Unauthenticated request to /api/v1/notifications is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications`);
    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.status, 401);
  });

  test('2. Unauthenticated request to /api/v1/notifications/unread-count is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/unread-count`);
    assert.strictEqual(res.status, 401);
  });

  test('3. Initially candidate has 0 unread notifications', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.unreadCount, 0);
  });

  test('4. Submitting application generates notifications for both candidate and job recruiter', async () => {
    const applyRes = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        job_id: testJobId,
        resume_id: testResumeId,
        cover_letter: 'Excited about building high-throughput notification architectures.',
      }),
    });
    assert.strictEqual(applyRes.status, 201);
    const appBody = await applyRes.json();
    testApplicationId = appBody.application.id;
    assert.ok(testApplicationId);

    // Verify candidate received APPLICATION_SUBMITTED
    const candNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(candNotifsRes.status, 200);
    const candNotifs = await candNotifsRes.json();
    assert.strictEqual(candNotifs.notifications.length, 1);
    assert.strictEqual(candNotifs.notifications[0].type, 'APPLICATION_SUBMITTED');
    assert.strictEqual(candNotifs.notifications[0].is_read, 0);

    // Verify recruiter received NEW_APPLICATION_RECEIVED
    const recNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
    });
    assert.strictEqual(recNotifsRes.status, 200);
    const recNotifs = await recNotifsRes.json();
    assert.ok(recNotifs.notifications.length >= 1);
    const recSubmitNotif = recNotifs.notifications.find((n: any) => n.type === 'NEW_APPLICATION_RECEIVED');
    assert.ok(recSubmitNotif, 'Recruiter received new application notification');
    assert.strictEqual(recSubmitNotif.is_read, 0);
  });

  test('5. Recruiter shortlisting application generates APPLICATION_SHORTLISTED notification for candidate', async () => {
    const statusRes = await fetch(`${baseUrl}/api/v1/applications/${testApplicationId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        status: 'SHORTLISTED',
        note: 'Impressive systems background.',
      }),
    });
    assert.strictEqual(statusRes.status, 200);

    // Verify candidate received APPLICATION_SHORTLISTED notification
    const candNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const candNotifs = await candNotifsRes.json();
    assert.strictEqual(candNotifs.notifications.length, 2);
    assert.strictEqual(candNotifs.notifications[0].type, 'APPLICATION_SHORTLISTED');
    assert.strictEqual(candNotifs.notifications[0].title, 'Application Shortlisted');
  });

  test('6. Candidate unread count reflects 2 database-persisted unread notifications', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.unreadCount, 2);
  });

  test('7. Scheduling interview generates INTERVIEW_SCHEDULED for candidate and INTERVIEW_ASSIGNED for interviewer', async () => {
    const futureInterviewTime = new Date(Date.now() + 86400000 * 2).toISOString();
    const schedRes = await fetch(`${baseUrl}/api/v1/interviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        application_id: testApplicationId,
        interviewer_id: interviewerId,
        scheduled_at_utc: futureInterviewTime,
        duration_minutes: 45,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/notif-test',
        notes: 'Technical architecture round',
      }),
    });
    assert.strictEqual(schedRes.status, 201);
    const schedBody = await schedRes.json();
    testInterviewId = schedBody.interview.id;
    assert.ok(testInterviewId);

    // Candidate has new INTERVIEW_SCHEDULED notification
    const candNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const candNotifs = await candNotifsRes.json();
    assert.strictEqual(candNotifs.notifications[0].type, 'INTERVIEW_SCHEDULED');

    // Interviewer has new INTERVIEW_ASSIGNED notification
    const intNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });
    const intNotifs = await intNotifsRes.json();
    assert.strictEqual(intNotifs.notifications.length, 1);
    assert.strictEqual(intNotifs.notifications[0].type, 'INTERVIEW_ASSIGNED');
    assert.strictEqual(intNotifs.notifications[0].is_read, 0);
  });

  test('8. Rescheduling interview triggers INTERVIEW_RESCHEDULED for candidate and interviewer', async () => {
    const rescheduledTime = new Date(Date.now() + 86400000 * 3).toISOString();
    const reschedRes = await fetch(`${baseUrl}/api/v1/interviews/${testInterviewId}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        scheduled_at_utc: rescheduledTime,
        reason: 'Interviewer calendar adjustment',
      }),
    });
    assert.strictEqual(reschedRes.status, 200);

    // Check candidate received resched notification
    const candNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const candNotifs = await candNotifsRes.json();
    assert.strictEqual(candNotifs.notifications[0].type, 'INTERVIEW_RESCHEDULED');

    // Check interviewer received resched notification
    const intNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });
    const intNotifs = await intNotifsRes.json();
    assert.strictEqual(intNotifs.notifications[0].type, 'INTERVIEW_RESCHEDULED');
  });

  test('9. Object-level authorization (IDOR): Other candidate cannot mark Alex’s notification as read (403)', async () => {
    const candNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const candNotifs = await candNotifsRes.json();
    const alexNotifId = candNotifs.notifications[0].id;

    const hackRes = await fetch(`${baseUrl}/api/v1/notifications/${alexNotifId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherApplicantToken}` },
    });
    assert.strictEqual(hackRes.status, 403);
    const body = (await hackRes.json()) as StandardErrorResponse;
    assert.strictEqual(body.code, 'FORBIDDEN_IDOR');
  });

  test('10. Marking non-existent notification as read returns 404 NOTIFICATION_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/notif-does-not-exist/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(res.status, 404);
  });

  test('11. Candidate marks single notification as read -> updates state and unread count', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const list = await listRes.json();
    const targetNotifId = list.notifications[0].id;
    const initialUnread = (await (await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    })).json()).unreadCount;

    const markRes = await fetch(`${baseUrl}/api/v1/notifications/${targetNotifId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(markRes.status, 200);

    const afterUnread = (await (await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    })).json()).unreadCount;
    assert.strictEqual(afterUnread, initialUnread - 1);
  });

  test('12. Candidate marks all notifications as read -> unread count becomes 0', async () => {
    const markAllRes = await fetch(`${baseUrl}/api/v1/notifications/mark-all-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(markAllRes.status, 200);
    const markAllBody = await markAllRes.json();
    assert.ok(markAllBody.markedCount > 0);

    const finalUnread = (await (await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    })).json()).unreadCount;
    assert.strictEqual(finalUnread, 0);
  });

  test('13. Submitting interview feedback generates notification for scheduling recruiter', async () => {
    const fbRes = await fetch(`${baseUrl}/api/v1/interviews/${testInterviewId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${interviewerToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        notes: 'Outstanding domain knowledge and architectural clarity.',
        recommendation: 'STRONG_HIRE',
      }),
    });
    assert.strictEqual(fbRes.status, 201);

    const recNotifsRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
    });
    const recNotifs = await recNotifsRes.json();
    const fbNotif = recNotifs.notifications.find((n: any) => n.type === 'INTERVIEW_FEEDBACK_RECEIVED');
    assert.ok(fbNotif, 'Recruiter received evaluation feedback notification');
    assert.ok(fbNotif.message.includes('Senior Systems Engineer'));
  });
});
