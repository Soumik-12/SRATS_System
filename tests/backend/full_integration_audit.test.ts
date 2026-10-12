import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createExpressApp } from '../../server/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { authService } from '../../server/services/authService.js';
import {
  setMockGeminiClient,
  type IGeminiClient,
  type GeminiResponse,
  type GenerateContentOptions,
} from '../../server/ai/geminiClient.js';
import { AppError } from '../../server/middleware/errorHandler.js';
import { companyRepository, departmentRepository } from '../../server/repositories/companyRepository.js';
import { jobRepository } from '../../server/repositories/jobRepository.js';
import {
  applicantProfileRepository,
  applicantSkillRepository,
  resumeRepository,
} from '../../server/repositories/applicantProfileRepository.js';
import { applicationRepository } from '../../server/repositories/applicationRepository.js';
import { interviewRepository } from '../../server/repositories/interviewRepository.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { hashPassword } from '../../server/security/crypto.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { storageService } from '../../server/services/storageService.js';

describe('Phase 16: Full System Integration & Security Audit Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let companyAId: string;
  let companyBId: string;
  let departmentAId: string;

  let recruiterAToken: string;
  let recruiterAId: string;

  let recruiterBToken: string;
  let recruiterBId: string;

  let interviewerAToken: string;
  let interviewerAId: string;

  let applicantAToken: string;
  let applicantAId: string;

  let applicantBToken: string;
  let applicantBId: string;

  let adminToken: string;
  let adminId: string;

  let publishedJobAId: string;
  let candidateAResumeId: string;
  let applicationAId: string;
  let interviewAId: string;

  class MockGeminiClient implements IGeminiClient {
    public callCount = 0;

    isConfigured(): boolean {
      return true;
    }

    getModel(): string {
      return 'gemini-3.8-flash';
    }

    async generateContent(options: GenerateContentOptions): Promise<GeminiResponse> {
      this.callCount++;
      const contents = String(options.contents || '');

      // Resume extraction response
      if (contents.includes('extract structured profile information')) {
        return {
          text: JSON.stringify({
            headline: 'Senior Cloud Systems Architect',
            summary: 'Experienced distributed systems engineer with expertise in Go, Kubernetes, and PostgreSQL.',
            skills: [
              { skillName: 'Kubernetes', level: 'EXPERT', evidenceQuote: '5 years managing multi-tenant k8s clusters', isDirectFact: true },
              { skillName: 'Go', level: 'EXPERT', evidenceQuote: 'Built high-throughput microservices in Go', isDirectFact: true },
            ],
            experience: [],
            education: [],
            certifications: [],
            overallConfidenceScore: 0.95,
            confidenceExplanation: 'Direct citations from resume document.',
          }),
        };
      }

      // Job recommendations response
      if (contents.includes('Candidate Jobs Available')) {
        return {
          text: JSON.stringify({
            recommendedJobs: [
              {
                jobId: publishedJobAId,
                relevanceScore: 94,
                matchReason: 'Direct alignment with candidate Go and Kubernetes background.',
                matchedSkills: ['Kubernetes', 'Go'],
                missingSkills: [],
                preferenceAlignment: 'Full-time platform role',
                evidenceExplanation: 'Confirmed skills match job requirements',
              },
            ],
            overallSummary: 'High alignment for cloud infrastructure position.',
          }),
        };
      }

      // Interview questions response
      if (contents.includes('evaluation interview questions') || contents.includes('jobSpecification')) {
        return {
          text: JSON.stringify({
            jobTitle: 'Lead Cloud Infrastructure Architect',
            summary: 'Evaluation focused on cluster resiliency and distributed concurrency.',
            questions: [
              {
                question: 'How do you design a zero-downtime Kubernetes cluster migration strategy across regions?',
                category: 'TECHNICAL',
                competency: 'Multi-Region Orchestration',
                rationale: 'Core job duty involves critical infrastructure migrations.',
                expectedSignals: ['Mentions DNS failover', 'Discusses stateful data replication latency'],
                evaluationRubric: {
                  poor: 'No strategy for stateful services or network partitioning.',
                  acceptable: 'Clear blue/green DNS cutover with rollback plan.',
                  excellent: 'Multi-region active-active topology with zero packet loss.',
                },
                probingFollowUps: ['How do you manage cross-region data consistency?'],
              },
            ],
          }),
        };
      }

      return {
        text: 'Verified platform context indicates candidate application is advancing on schedule.',
      };
    }
  }

  let mockClient: MockGeminiClient;

  before(async () => {
    initDatabase(':memory:');
    runMigrations();
    await authService.bootstrapAdmin();

    mockClient = new MockGeminiClient();
    setMockGeminiClient(mockClient);

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

    // 1. Setup Tenant Organizations
    const compA = await companyRepository.create({
      id: 'comp-integ-a',
      name: 'OmniCloud Networks',
      domain: 'omnicloud.io',
      industry: 'Cloud Infrastructure',
      size: '200-500',
      location: 'San Jose, CA',
    });
    companyAId = compA.id;

    const compB = await companyRepository.create({
      id: 'comp-integ-b',
      name: 'Apex Financial Services',
      domain: 'apexfin.io',
      industry: 'Fintech',
      size: '100-200',
      location: 'New York, NY',
    });
    companyBId = compB.id;

    const deptA = await departmentRepository.create({
      id: 'dept-integ-a',
      company_id: companyAId,
      name: 'Core Platform',
    });
    departmentAId = deptA.id;

    // 2. Setup Users
    const pwdHash = await hashPassword('Password123!');

    // Recruiter A (OmniCloud)
    recruiterAId = 'usr-rec-a';
    await userRepository.create({
      id: recruiterAId,
      email: 'recruiter.a@omnicloud.io',
      password_hash: pwdHash,
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Rachel',
      last_name: 'Omni',
      company_id: companyAId,
    });
    recruiterAToken = createAccessToken({
      sub: recruiterAId,
      email: 'recruiter.a@omnicloud.io',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: 'Rachel',
      lastName: 'Omni',
    });

    // Recruiter B (Apex Financial)
    recruiterBId = 'usr-rec-b';
    await userRepository.create({
      id: recruiterBId,
      email: 'recruiter.b@apexfin.io',
      password_hash: pwdHash,
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Richard',
      last_name: 'Apex',
      company_id: companyBId,
    });
    recruiterBToken = createAccessToken({
      sub: recruiterBId,
      email: 'recruiter.b@apexfin.io',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: companyBId,
      firstName: 'Richard',
      lastName: 'Apex',
    });

    // Evaluator A (OmniCloud)
    interviewerAId = 'usr-int-a';
    await userRepository.create({
      id: interviewerAId,
      email: 'evaluator.a@omnicloud.io',
      password_hash: pwdHash,
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'Eric',
      last_name: 'Evaluator',
      company_id: companyAId,
    });
    interviewerAToken = createAccessToken({
      sub: interviewerAId,
      email: 'evaluator.a@omnicloud.io',
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: companyAId,
      firstName: 'Eric',
      lastName: 'Evaluator',
    });

    // Applicant A
    applicantAId = 'usr-app-a';
    await userRepository.create({
      id: applicantAId,
      email: 'alex.candidate@srats.local',
      password_hash: pwdHash,
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Alex',
      last_name: 'Candidate',
      company_id: null,
    });
    applicantAToken = createAccessToken({
      sub: applicantAId,
      email: 'alex.candidate@srats.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Alex',
      lastName: 'Candidate',
    });

    // Applicant B
    applicantBId = 'usr-app-b';
    await userRepository.create({
      id: applicantBId,
      email: 'bianca.candidate@srats.local',
      password_hash: pwdHash,
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Bianca',
      last_name: 'Candidate',
      company_id: null,
    });
    applicantBToken = createAccessToken({
      sub: applicantBId,
      email: 'bianca.candidate@srats.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Bianca',
      lastName: 'Candidate',
    });

    // Admin
    adminId = 'usr-admin-integ';
    await userRepository.create({
      id: adminId,
      email: 'superadmin@srats.system',
      password_hash: pwdHash,
      role: 'ADMIN',
      account_status: 'ACTIVE',
      first_name: 'Platform',
      last_name: 'Administrator',
      company_id: null,
    });
    adminToken = createAccessToken({
      sub: adminId,
      email: 'superadmin@srats.system',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Platform',
      lastName: 'Administrator',
    });

    // Applicant A profile setup
    await applicantProfileRepository.upsert({
      user_id: applicantAId,
      headline: 'Cloud Engineer',
      summary: 'Specialized in microservice networking.',
    });
    const storageKey = 'res-integ-a.pdf';
    await storageService.save(
      storageKey,
      Buffer.from('5 years managing multi-tenant k8s clusters. Built high-throughput microservices in Go.'),
      'application/pdf'
    );
    const resume = await resumeRepository.create({
      id: 'res-integ-a',
      applicant_id: applicantAId,
      file_name: 'Alex_Architect_Resume.pdf',
      file_mime: 'application/pdf',
      file_size: 20480,
      storage_path: storageKey,
      raw_text: '5 years managing multi-tenant k8s clusters. Built high-throughput microservices in Go.',
    });
    candidateAResumeId = resume.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  // --- Step 1: Job Lifecycle (Draft -> Published) ---

  test('16.1. Recruiter creates and publishes job requisition', async () => {
    // 1. Create job in DRAFT
    const createRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        title: 'Lead Cloud Infrastructure Architect',
        department_id: departmentAId,
        description: 'Design multi-region Kubernetes topologies and cloud networking.',
        requirements: 'Go, Kubernetes, Distributed Architecture.',
        location: 'Remote',
        employment_type: 'FULL_TIME',
        experience_level: 'LEAD',
        salary_min: 180000,
        salary_max: 220000,
        status: 'DRAFT',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    publishedJobAId = createData.job.id;
    assert.strictEqual(createData.job.status, 'DRAFT');

    // 2. Draft job is NOT publicly visible to applicants
    const pubSearch1 = await fetch(`${baseUrl}/api/v1/jobs`);
    const searchData1 = await pubSearch1.json();
    const foundDraft = searchData1.content.some((j: any) => j.id === publishedJobAId);
    assert.strictEqual(foundDraft, false);

    // 3. Recruiter publishes job with valid future deadline
    const pubRes = await fetch(`${baseUrl}/api/v1/jobs/${publishedJobAId}/publish`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        deadline_utc: new Date(Date.now() + 45 * 86400000).toISOString(),
      }),
    });
    assert.strictEqual(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.strictEqual(pubData.job.status, 'PUBLISHED');

    // 4. Job is now publicly discoverable
    const pubSearch2 = await fetch(`${baseUrl}/api/v1/jobs`);
    const searchData2 = await pubSearch2.json();
    const foundPublished = searchData2.content.some((j: any) => j.id === publishedJobAId);
    assert.strictEqual(foundPublished, true);
  });

  // --- Step 2: AI Resume Extraction, Consent & Confirmation Workflow ---

  test('16.2. Applicant runs consent-gated AI resume analysis and confirms extracted skills', async () => {
    // 1. Consent required
    const unconsentRes = await fetch(`${baseUrl}/api/v1/ai/resume/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        resumeId: candidateAResumeId,
        consentAccepted: false,
      }),
    });
    assert.strictEqual(unconsentRes.status, 400);

    // 2. Run analysis with explicit consent
    const analyzeRes = await fetch(`${baseUrl}/api/v1/ai/resume/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        resumeId: candidateAResumeId,
        consentAccepted: true,
      }),
    });
    assert.strictEqual(analyzeRes.status, 200);
    const analyzeData = await analyzeRes.json();
    assert.strictEqual(analyzeData.success, true);
    assert.strictEqual(analyzeData.analysis.extracted.skills.length, 2);

    // 3. Confirm extracted skills into profile (Human-in-the-loop)
    const confirmRes = await fetch(`${baseUrl}/api/v1/ai/resume/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        resumeId: candidateAResumeId,
        analysisId: analyzeData.analysis.analysisId,
        headline: analyzeData.analysis.extracted.headline,
        summary: analyzeData.analysis.extracted.summary,
        selectedSkills: [
          { skill_name: 'Kubernetes', level: 'EXPERT' },
          { skill_name: 'Go', level: 'EXPERT' },
        ],
      }),
    });
    assert.strictEqual(confirmRes.status, 200);

    // Verify skills persisted to relational database
    const skills = await applicantSkillRepository.listByApplicant(applicantAId);
    assert.strictEqual(skills.length, 2);
    assert.ok(skills.some((s) => s.skill_name === 'Kubernetes'));
    assert.ok(skills.some((s) => s.skill_name === 'Go'));
  });

  // --- Step 3: AI Recommendations & Unrestricted Discovery ---

  test('16.3. Applicant receives real-data AI recommendations while retaining universal search', async () => {
    const recRes = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
        refresh: true,
      }),
    });
    assert.strictEqual(recRes.status, 200);
    const recData = await recRes.json();
    assert.strictEqual(recData.success, true);
    assert.strictEqual(recData.recommendations.length, 1);
    assert.strictEqual(recData.recommendations[0].jobId, publishedJobAId);

    // Universal search is completely unrestricted
    const publicList = await fetch(`${baseUrl}/api/v1/jobs`);
    assert.strictEqual(publicList.status, 200);
  });

  // --- Step 4: Application Submission & Duplicate Prevention ---

  test('16.4. Applicant applies to job; duplicate submission is blocked with 409', async () => {
    // 1. Submit application
    const applyRes = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobAId,
        resume_id: candidateAResumeId,
        cover_letter: 'Proven background running cloud platforms.',
      }),
    });
    assert.strictEqual(applyRes.status, 201);
    const applyData = await applyRes.json();
    applicationAId = applyData.application.id;
    assert.strictEqual(applyData.application.status, 'APPLIED');

    // 2. Duplicate submission blocked
    const dupRes = await fetch(`${baseUrl}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        job_id: publishedJobAId,
        resume_id: candidateAResumeId,
      }),
    });
    assert.strictEqual(dupRes.status, 409);
  });

  // --- Step 5: Recruiter Pipeline Review & Stage Advance ---

  test('16.5. Recruiter reviews application in pipeline and advances status to SHORTLISTED', async () => {
    // 1. Recruiter A sees candidate in company pipeline
    const pipeRes = await fetch(`${baseUrl}/api/v1/applications?jobId=${publishedJobAId}`, {
      headers: {
        Authorization: `Bearer ${recruiterAToken}`,
      },
    });
    assert.strictEqual(pipeRes.status, 200);
    const pipeData = await pipeRes.json();
    assert.ok(pipeData.applications.some((a: any) => a.id === applicationAId));

    // 2. Advance status to SHORTLISTED
    const advanceRes = await fetch(`${baseUrl}/api/v1/applications/${applicationAId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'SHORTLISTED',
        note: 'Candidate has strong Kubernetes and Go citations.',
      }),
    });
    assert.strictEqual(advanceRes.status, 200);

    // 3. Candidate received notification
    const db = getDatabase();
    const notif = db.queryOne<{ id: string; type: string }>(
      "SELECT id, type FROM notifications WHERE user_id = ? AND type = 'APPLICATION_SHORTLISTED';",
      [applicantAId]
    );
    assert.ok(notif);
  });

  // --- Step 6: Interview Scheduling & Evaluator AI Questions ---

  test('16.6. Recruiter schedules interview; Interviewer generates questions and submits feedback', async () => {
    // 1. Recruiter schedules interview
    const schedRes = await fetch(`${baseUrl}/api/v1/interviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        application_id: applicationAId,
        interviewer_id: interviewerAId,
        scheduled_at_utc: new Date(Date.now() + 2 * 86400000).toISOString(),
        duration_minutes: 60,
        interview_type: 'ONLINE',
        location_url: 'https://meet.google.com/omni-interview',
        notes: 'Conduct architectural deep dive.',
      }),
    });
    assert.strictEqual(schedRes.status, 201);
    const schedData = await schedRes.json();
    interviewAId = schedData.interview.id;

    // 2. Assigned Interviewer generates AI interview questions
    const qRes = await fetch(`${baseUrl}/api/v1/ai/interview/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${interviewerAToken}`,
      },
      body: JSON.stringify({
        jobId: publishedJobAId,
        interviewId: interviewAId,
        category: 'TECHNICAL',
        count: 1,
      }),
    });
    assert.strictEqual(qRes.status, 200);
    const qData = await qRes.json();
    assert.strictEqual(qData.success, true);
    assert.ok(qData.data.questions.length >= 1);

    // 3. Interviewer submits feedback and score
    const feedRes = await fetch(`${baseUrl}/api/v1/interviews/${interviewAId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${interviewerAToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        recommendation: 'STRONG_HIRE',
        notes: 'Outstanding answers on multi-region failover and distributed consensus.',
      }),
    });
    assert.strictEqual(feedRes.status, 201);
  });

  // --- Step 7: Final Hiring Decision & Lifecycle Completion ---

  test('16.7. Recruiter advances candidate to HIRED; final notifications & audit log written', async () => {
    // Advance to SELECTED then HIRED
    const selRes = await fetch(`${baseUrl}/api/v1/applications/${applicationAId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'SELECTED',
        note: 'Exceptional interview score and evaluation feedback.',
      }),
    });
    assert.strictEqual(selRes.status, 200);

    const hireRes = await fetch(`${baseUrl}/api/v1/applications/${applicationAId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        status: 'HIRED',
        note: 'Offer accepted. Welcoming candidate to OmniCloud.',
      }),
    });
    assert.strictEqual(hireRes.status, 200);

    // Verify candidate received HIRED notification
    const db = getDatabase();
    const hiredNotif = db.queryOne<{ id: string }>(
      "SELECT id FROM notifications WHERE user_id = ? AND type = 'APPLICATION_HIRED';",
      [applicantAId]
    );
    assert.ok(hiredNotif);

    // Verify complete audit history
    const auditLogs = db.query<{ action: string }>(
      'SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY created_at ASC;',
      [applicationAId]
    );
    const actions = auditLogs.map((a) => a.action);
    assert.ok(actions.includes('APPLICATION_SUBMITTED'));
    assert.ok(actions.includes('APPLICATION_STATUS_SHORTLISTED'));
    assert.ok(actions.includes('APPLICATION_STATUS_SELECTED'));
    assert.ok(actions.includes('APPLICATION_STATUS_HIRED'));
  });

  // --- Step 8: Strict Multi-Tenant Isolation & IDOR Defenses ---

  test('16.8. Multi-Tenant Isolation: Recruiter B cannot access Company A recruitment records (403/Empty)', async () => {
    // 1. Recruiter B listing company applications cannot see Application A
    const listRes = await fetch(`${baseUrl}/api/v1/applications`, {
      headers: {
        Authorization: `Bearer ${recruiterBToken}`,
      },
    });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    assert.strictEqual(listData.applications.some((a: any) => a.id === applicationAId), false);

    // 2. Recruiter B directly accessing Application A gets 403 Forbidden
    const getRes = await fetch(`${baseUrl}/api/v1/applications/${applicationAId}`, {
      headers: {
        Authorization: `Bearer ${recruiterBToken}`,
      },
    });
    assert.strictEqual(getRes.status, 403);

    // 3. Recruiter B attempting to modify status of Application A gets 403 Forbidden
    const mutRes = await fetch(`${baseUrl}/api/v1/applications/${applicationAId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterBToken}`,
      },
      body: JSON.stringify({
        status: 'REJECTED',
      }),
    });
    assert.strictEqual(mutRes.status, 403);
  });

  test('16.9. Cross-Candidate IDOR: Applicant B cannot access Applicant A resume or applications (403)', async () => {
    // 1. Applicant B accessing Applicant A resume file
    const resFile = await fetch(`${baseUrl}/api/v1/applicant/resumes/${candidateAResumeId}/file`, {
      headers: {
        Authorization: `Bearer ${applicantBToken}`,
      },
    });
    assert.ok(resFile.status === 403 || resFile.status === 404);

    // 2. Applicant B accessing Applicant A application details
    const appDetails = await fetch(`${baseUrl}/api/v1/applications/${applicationAId}`, {
      headers: {
        Authorization: `Bearer ${applicantBToken}`,
      },
    });
    assert.strictEqual(appDetails.status, 403);
  });

  // --- Step 9: AI Tool Registry Security Audit (Mandatory High-Priority Audit) ---

  test('16.10. AI Tool Registry Audit: Direct tool execution rejects unauthorized roles and invalid arguments', async () => {
    // 1. Applicant attempting to call recruiter pipeline summary tool is rejected with 403
    const toolRes1 = await fetch(`${baseUrl}/api/v1/ai/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        name: 'get_recruiter_pipeline_summary',
        arguments: {},
      }),
    });
    assert.strictEqual(toolRes1.status, 403);
    const data1 = await toolRes1.json();
    assert.ok(data1.message.includes('not permitted'));

    // 2. Invoking non-existent tool returns 404
    const toolRes2 = await fetch(`${baseUrl}/api/v1/ai/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterAToken}`,
      },
      body: JSON.stringify({
        name: 'execute_arbitrary_shell_command',
        arguments: {},
      }),
    });
    assert.strictEqual(toolRes2.status, 404);

    // 3. Recruiter B calling candidate applications tool for competitor applicant gets 403
    const toolRes3 = await fetch(`${baseUrl}/api/v1/ai/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterBToken}`,
      },
      body: JSON.stringify({
        name: 'get_applicant_applications',
        arguments: { applicantId: applicantAId }, // Applicant A only applied to Company A!
      }),
    });
    assert.strictEqual(toolRes3.status, 403);
  });

  // --- Step 10: Administration, Governance & Dashboard Consistency ---

  test('16.11. Dashboard metrics reflect true database facts without fabrication', async () => {
    // Recruiter A analytics reflects 1 active job, 1 candidate hired
    const recAnalyticsRes = await fetch(`${baseUrl}/api/v1/analytics/recruiter`, {
      headers: {
        Authorization: `Bearer ${recruiterAToken}`,
      },
    });
    assert.strictEqual(recAnalyticsRes.status, 200);
    const recMetrics = await recAnalyticsRes.json();
    assert.ok(recMetrics.metrics.activeJobsCount >= 1);
    assert.ok((recMetrics.metrics.hiredCount ?? recMetrics.metrics.applicationsByStatus?.HIRED) >= 1);

    // Candidate A analytics reflects 1 application, status HIRED
    const appAnalyticsRes = await fetch(`${baseUrl}/api/v1/analytics/applicant`, {
      headers: {
        Authorization: `Bearer ${applicantAToken}`,
      },
    });
    assert.strictEqual(appAnalyticsRes.status, 200);
    const appMetrics = await appAnalyticsRes.json();
    assert.strictEqual(appMetrics.metrics.totalApplications, 1);
    assert.strictEqual(appMetrics.metrics.applicationsByStatus.HIRED, 1);
  });
});
