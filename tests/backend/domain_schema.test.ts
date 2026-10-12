import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { companyRepository, departmentRepository } from '../../server/repositories/companyRepository.js';
import { applicantProfileRepository, resumeRepository, applicantSkillRepository } from '../../server/repositories/applicantProfileRepository.js';
import { jobRepository } from '../../server/repositories/jobRepository.js';
import { applicationRepository } from '../../server/repositories/applicationRepository.js';
import { interviewRepository } from '../../server/repositories/interviewRepository.js';
import { notificationRepository, auditLogRepository } from '../../server/repositories/notificationRepository.js';
import { jobService, applicationService, interviewService } from '../../server/services/domainServices.js';
import { AppError } from '../../server/middleware/errorHandler.js';

describe('Phase 2: Relational Domain Schema & Business Rule Suite', () => {
  before(() => {
    // Start with a clean in-memory database
    initDatabase(':memory:');
    // Run migrations V1 and V2
    const applied = runMigrations();
    assert.strictEqual(applied.length >= 2, true, 'Both V1 and V2 migrations must apply cleanly');
  });

  after(() => {
    closeDatabase();
  });

  test('1. Schema integrity: All core domain tables exist in database', () => {
    const db = getDatabase();
    const tables = db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (
        'companies', 'departments', 'users', 'applicant_profiles', 'resumes', 
        'applicant_skills', 'jobs', 'applications', 'application_status_history', 
        'interviews', 'interview_feedback', 'notifications', 'audit_logs'
      );`
    );
    assert.strictEqual(tables.length, 13, 'All 13 core domain tables must exist');
  });

  test('2. Unique constraint enforcement: Duplicate user email is rejected', async () => {
    await userRepository.create({
      id: 'usr-100',
      email: 'unique.candidate@srats.local',
      password_hash: 'hashed_pw_1',
      role: 'APPLICANT',
      first_name: 'Jane',
      last_name: 'Doe',
      company_id: null,
    });

    // Attempt duplicate email insertion
    await assert.rejects(
      async () => {
        await userRepository.create({
          id: 'usr-101',
          email: 'unique.candidate@srats.local', // Exact duplicate
          password_hash: 'hashed_pw_2',
          role: 'APPLICANT',
          first_name: 'Other',
          last_name: 'Candidate',
          company_id: null,
        });
      },
      (err: Error) => err.message.includes('UNIQUE constraint failed')
    );
  });

  test('3. Foreign key enforcement: Orphan child insertion is strictly rejected', () => {
    const db = getDatabase();
    // Attempt inserting resume for non-existent applicant
    assert.throws(
      () => {
        db.execute(
          `INSERT INTO resumes (id, applicant_id, file_name, file_mime, file_size, storage_path, is_primary, is_active, created_at)
           VALUES ('res-orphan', 'usr-non-existent', 'resume.pdf', 'application/pdf', 1024, '/storage/resumes/1.pdf', 1, 1, ?);`,
          [new Date().toISOString()]
        );
      },
      (err: Error) => err.message.includes('FOREIGN KEY constraint failed')
    );
  });

  test('4. Cascade deletion: Deleting user cascades to applicant profile, resumes, skills', async () => {
    const user = await userRepository.create({
      id: 'usr-cascade-target',
      email: 'cascade.test@srats.local',
      password_hash: 'hashed_pw',
      role: 'APPLICANT',
      first_name: 'Cascade',
      last_name: 'Test',
      company_id: null,
    });

    await applicantProfileRepository.upsert({
      user_id: user.id,
      headline: 'Software Engineer',
      phone: '+15551234567',
      summary: 'Test summary',
      location: 'Remote',
      website: null,
    });

    await resumeRepository.create({
      id: 'res-cascade',
      applicant_id: user.id,
      file_name: 'cascade_resume.pdf',
      file_mime: 'application/pdf',
      file_size: 2048,
      storage_path: '/storage/cascade.pdf',
      raw_text: 'Engineering skills',
    });

    await applicantSkillRepository.addSkill({
      id: 'skill-cascade',
      applicant_id: user.id,
      skill_name: 'TypeScript',
      level: 'EXPERT',
    });

    // Hard delete user to verify foreign key cascade
    const db = getDatabase();
    db.execute('DELETE FROM users WHERE id = ?;', [user.id]);

    const profileAfter = await applicantProfileRepository.findByUserId(user.id);
    assert.strictEqual(profileAfter, null, 'Applicant profile must be cascade deleted');

    const resumeAfter = await resumeRepository.findById('res-cascade');
    assert.strictEqual(resumeAfter, null, 'Resume must be cascade deleted');

    const skillsAfter = await applicantSkillRepository.listByApplicant(user.id);
    assert.strictEqual(skillsAfter.length, 0, 'Applicant skills must be cascade deleted');
  });

  test('5. Complete Domain Workflow: Company -> Job -> Application -> Interview -> Feedback', async () => {
    // 1. Create Company and Department
    const company = await companyRepository.create({
      id: 'comp-acme',
      name: 'Acme Enterprise Solutions',
      domain: 'acme.local',
      industry: 'Technology',
      size: '500-1000',
      location: 'New York, NY',
    });

    const dept = await departmentRepository.create({
      id: 'dept-eng',
      company_id: company.id,
      name: 'Core Platform Engineering',
    });

    // 2. Create Recruiter and Applicant Users
    const recruiter = await userRepository.create({
      id: 'usr-recruiter-1',
      email: 'recruiter@acme.local',
      password_hash: 'hashed_pw',
      role: 'RECRUITER',
      first_name: 'Alice',
      last_name: 'Recruiter',
      company_id: company.id,
    });

    const interviewer = await userRepository.create({
      id: 'usr-interviewer-1',
      email: 'interviewer@acme.local',
      password_hash: 'hashed_pw',
      role: 'INTERVIEWER',
      first_name: 'Bob',
      last_name: 'Architect',
      company_id: company.id,
    });

    const applicantUser = await userRepository.create({
      id: 'usr-candidate-1',
      email: 'candidate@domain.local',
      password_hash: 'hashed_pw',
      role: 'APPLICANT',
      first_name: 'Carlos',
      last_name: 'Candidate',
      company_id: null,
    });

    await applicantProfileRepository.upsert({
      user_id: applicantUser.id,
      headline: 'Full-Stack Software Engineer',
      phone: '+15559876543',
      summary: 'Experienced with Node, TypeScript, SQL',
      location: 'San Francisco, CA',
      website: 'https://carlos.dev',
    });

    const resume = await resumeRepository.create({
      id: 'res-cand-1',
      applicant_id: applicantUser.id,
      file_name: 'carlos_fullstack.pdf',
      file_mime: 'application/pdf',
      file_size: 154200,
      storage_path: '/storage/resumes/carlos.pdf',
      raw_text: 'Experienced with React, Node.js, and SQL databases.',
    });

    // 3. Create Job in DRAFT then transition to PUBLISHED
    const job = await jobService.createJob({
      id: 'job-swe-1',
      company_id: company.id,
      department_id: dept.id,
      created_by: recruiter.id,
      title: 'Senior Backend Engineer',
      description: 'Build mission-critical systems and transactional services.',
      requirements: 'TypeScript, SQL, relational database design.',
      location: 'Remote',
      employment_type: 'FULL_TIME',
      experience_level: 'SENIOR',
      salary_min: 140000,
      salary_max: 180000,
      status: 'DRAFT',
    });
    assert.strictEqual(job.status, 'DRAFT');

    // Applications cannot be submitted to DRAFT jobs
    await assert.rejects(
      async () => {
        await applicationService.applyForJob({
          id: 'app-premature',
          job_id: job.id,
          applicant_id: applicantUser.id,
          resume_id: resume.id,
        });
      },
      (err: AppError) => err.code === 'JOB_NOT_PUBLISHED'
    );

    // Publish the job
    const publishedJob = await jobService.transitionJobStatus(job.id, 'PUBLISHED', recruiter.id);
    assert.strictEqual(publishedJob.status, 'PUBLISHED');

    // 4. Submit Valid Application
    const application = await applicationService.applyForJob({
      id: 'app-valid-1',
      job_id: publishedJob.id,
      applicant_id: applicantUser.id,
      resume_id: resume.id,
      cover_letter: 'I have deep experience with high-scale relational database systems.',
    });
    assert.strictEqual(application.status, 'APPLIED');

    // Verify initial status history recorded
    const history1 = await applicationRepository.getStatusHistory(application.id);
    assert.strictEqual(history1.length, 1);
    assert.strictEqual(history1[0].to_status, 'APPLIED');

    // 5. Duplicate Application Prevention (Strict Master Prompt Rule)
    await assert.rejects(
      async () => {
        await applicationService.applyForJob({
          id: 'app-duplicate',
          job_id: publishedJob.id,
          applicant_id: applicantUser.id,
          resume_id: resume.id,
        });
      },
      (err: AppError) => err.code === 'DUPLICATE_APPLICATION'
    );

    // 6. Recruiter Shortlists Application
    const shortlistedApp = await applicationService.transitionStatus(
      application.id,
      'SHORTLISTED',
      recruiter.id,
      'Strong qualifications alignment'
    );
    assert.strictEqual(shortlistedApp.status, 'SHORTLISTED');

    // 7. Schedule Interview
    const scheduledInterview = await interviewService.scheduleInterview({
      id: 'int-round-1',
      application_id: application.id,
      interviewer_id: interviewer.id,
      scheduled_by: recruiter.id,
      scheduled_at_utc: new Date(Date.now() + 86400000).toISOString(),
      duration_minutes: 60,
      location_url: 'https://meet.google.com/srats-int-test',
      notes: 'System architecture interview',
    });
    assert.strictEqual(scheduledInterview.status, 'SCHEDULED');

    // Check application status was updated to INTERVIEW_SCHEDULED
    const appAfterSchedule = await applicationRepository.findById(application.id);
    assert.strictEqual(appAfterSchedule?.status, 'INTERVIEW_SCHEDULED');

    // 8. Interviewer Submits Scoring Feedback
    // Unassigned interviewer rejected
    await assert.rejects(
      async () => {
        await interviewService.submitFeedback({
          id: 'fb-unauth',
          interview_id: scheduledInterview.id,
          interviewer_id: recruiter.id, // Recruiter is not assigned interviewer
          rating: 4,
          notes: 'Great answers',
          recommendation: 'HIRE',
        });
      },
      (err: AppError) => err.code === 'UNAUTHORIZED_INTERVIEWER'
    );

    // Assigned interviewer submits feedback
    const feedback = await interviewService.submitFeedback({
      id: 'fb-round-1',
      interview_id: scheduledInterview.id,
      interviewer_id: interviewer.id,
      rating: 5,
      notes: 'Candidate demonstrated exemplary database design and architecture skills.',
      recommendation: 'STRONG_HIRE',
    });
    assert.strictEqual(feedback.rating, 5);
    assert.strictEqual(feedback.recommendation, 'STRONG_HIRE');

    // Verify interview status auto-completed
    const intAfter = await interviewRepository.findById(scheduledInterview.id);
    assert.strictEqual(intAfter?.status, 'COMPLETED');

    // 9. Recruiter selects and hires candidate
    await applicationService.transitionStatus(application.id, 'SELECTED', recruiter.id, 'Selected for hire');
    const hiredApp = await applicationService.transitionStatus(application.id, 'HIRED', recruiter.id, 'Offer accepted');
    assert.strictEqual(hiredApp.status, 'HIRED');

    // Terminal state protection: HIRED cannot transition back to APPLIED
    await assert.rejects(
      async () => {
        await applicationService.transitionStatus(application.id, 'APPLIED', recruiter.id);
      },
      (err: AppError) => err.code === 'INVALID_STATUS_TRANSITION'
    );

    // 10. Verify Notifications & Audit Logs persisted
    const candidateNotifs = await notificationRepository.listByUser(applicantUser.id);
    assert.ok(candidateNotifs.length >= 3, 'Candidate must receive domain event notifications');

    const auditTrail = await auditLogRepository.query(20, 0);
    assert.ok(auditTrail.length >= 5, 'System must log audit events across entire lifecycle');
  });

  test('6. Job closure prevents new applications', async () => {
    const db = getDatabase();
    const candidate2 = await userRepository.create({
      id: 'usr-cand-2',
      email: 'cand2@srats.local',
      password_hash: 'pw',
      role: 'APPLICANT',
      first_name: 'Second',
      last_name: 'Applicant',
      company_id: null,
    });
    await applicantProfileRepository.upsert({ user_id: candidate2.id });
    const res2 = await resumeRepository.create({
      id: 'res-cand-2',
      applicant_id: candidate2.id,
      file_name: 'res2.pdf',
      file_mime: 'application/pdf',
      file_size: 1024,
      storage_path: '/res2.pdf',
    });

    // Close job
    await jobService.transitionJobStatus('job-swe-1', 'CLOSED', 'usr-recruiter-1');

    // Attempting application to CLOSED job must fail
    await assert.rejects(
      async () => {
        await applicationService.applyForJob({
          id: 'app-to-closed-job',
          job_id: 'job-swe-1',
          applicant_id: candidate2.id,
          resume_id: res2.id,
        });
      },
      (err: AppError) => err.code === 'JOB_NOT_PUBLISHED'
    );
  });
});
