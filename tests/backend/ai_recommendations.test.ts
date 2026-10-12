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
import { applicantProfileRepository, applicantSkillRepository } from '../../server/repositories/applicantProfileRepository.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { hashPassword } from '../../server/security/crypto.js';
import { createAccessToken } from '../../server/security/jwt.js';
import type { AuthSessionResponse } from '../../server/types/index.js';

describe('Phase 14: AI-Assisted Job Recommendations Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let applicantToken: string;
  let applicantId: string;
  let recruiterToken: string;
  let companyId: string;
  let departmentId: string;

  let publishedJob1Id: string;
  let publishedJob2Id: string;
  let draftJobId: string;
  let closedJobId: string;

  class MockGeminiClient implements IGeminiClient {
    public callCount = 0;
    public lastOptions: GenerateContentOptions | null = null;
    public shouldFail = false;
    public failureType: 'UNAVAILABLE' | 'TIMEOUT' | 'RATE_LIMIT' | null = null;
    public customResponse: any = null;

    isConfigured(): boolean {
      return true;
    }

    getModel(): string {
      return 'gemini-3.8-flash';
    }

    async generateContent(options: GenerateContentOptions): Promise<GeminiResponse> {
      this.callCount++;
      this.lastOptions = options;

      if (this.shouldFail) {
        if (this.failureType === 'UNAVAILABLE') {
          throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'AI assistance is temporarily unavailable.');
        }
        if (this.failureType === 'TIMEOUT') {
          throw new AppError(504, 'AI_TIMEOUT', 'AI request timed out.');
        }
        throw new Error('Provider error');
      }

      if (this.customResponse) {
        return { text: JSON.stringify(this.customResponse) };
      }

      // Default recommendations: matches publishedJob1Id
      return {
        text: JSON.stringify({
          recommendedJobs: [
            {
              jobId: publishedJob1Id,
              relevanceScore: 92,
              matchReason: 'Strong alignment with candidate verified TypeScript expertise.',
              matchedSkills: ['TypeScript', 'Node.js'],
              missingSkills: ['Kubernetes'],
              preferenceAlignment: 'Full-time backend role aligns with experience level',
              evidenceExplanation: 'Verified from candidate confirmed skills inventory',
            },
          ],
          overallSummary: 'High alignment identified for platform backend positions.',
        }),
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

    // 1. Setup Company & Department
    const comp = await companyRepository.create({
      id: `comp-rec-01`,
      name: 'Acme AI Systems',
      domain: 'acme.local',
      industry: 'Software',
      size: '50-200',
      location: 'San Francisco, CA',
    });
    companyId = comp.id;

    const dept = await departmentRepository.create({
      id: `dept-rec-01`,
      company_id: companyId,
      name: 'Platform Engineering',
    });
    departmentId = dept.id;

    // 2. Setup Recruiter
    const recUserId = 'usr-rec-01';
    await userRepository.create({
      id: recUserId,
      email: 'recruiter.rec@acme.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Rachel',
      last_name: 'Recruiter',
      company_id: companyId,
    });
    recruiterToken = createAccessToken({
      sub: recUserId,
      email: 'recruiter.rec@acme.local',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId,
      firstName: 'Rachel',
      lastName: 'Recruiter',
    });

    // 3. Setup Applicant
    const regApp = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'candidate.rec@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Sam',
        lastName: 'Candidate',
        role: 'APPLICANT',
      }),
    });
    const appData = await regApp.json();
    applicantId = appData.user.id;

    const logApp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'candidate.rec@srats.local',
        password: 'Password123!',
        expectedRole: 'APPLICANT',
      }),
    });
    applicantToken = ((await logApp.json()) as AuthSessionResponse).accessToken;

    // Seed confirmed skills into applicant profile
    await applicantProfileRepository.upsert({
      user_id: applicantId,
      headline: 'Principal Backend Architect',
      summary: '10+ years engineering scalable cloud microservices.',
    });
    await applicantSkillRepository.addSkill({
      id: 'skill-ts-01',
      applicant_id: applicantId,
      skill_name: 'TypeScript',
      level: 'EXPERT',
    });
    await applicantSkillRepository.addSkill({
      id: 'skill-node-01',
      applicant_id: applicantId,
      skill_name: 'Node.js',
      level: 'EXPERT',
    });

    // 4. Create Requisitions: Published #1, Published #2, Draft, Closed
    const j1 = await jobRepository.create({
      id: `job-pub-01`,
      company_id: companyId,
      department_id: departmentId,
      created_by: recUserId,
      title: 'Senior TypeScript Systems Engineer',
      description: 'Building high throughput event queues and backend services.',
      requirements: 'TypeScript, Node.js, distributed databases.',
      location: 'Remote',
      employment_type: 'FULL_TIME',
      experience_level: 'SENIOR',
      salary_min: 140000,
      salary_max: 180000,
      status: 'PUBLISHED',
      deadline_utc: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    publishedJob1Id = j1.id;

    const j2 = await jobRepository.create({
      id: `job-pub-02`,
      company_id: companyId,
      department_id: departmentId,
      created_by: recUserId,
      title: 'Full Stack Product Engineer',
      description: 'React and Python web development.',
      requirements: 'React, Python, SQL.',
      location: 'San Francisco, CA',
      employment_type: 'FULL_TIME',
      experience_level: 'MID',
      salary_min: 120000,
      salary_max: 150000,
      status: 'PUBLISHED',
      deadline_utc: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    publishedJob2Id = j2.id;

    const jDraft = await jobRepository.create({
      id: `job-draft-01`,
      company_id: companyId,
      department_id: departmentId,
      created_by: recUserId,
      title: 'Confidential Internal Requisition',
      description: 'Draft unapproved specification.',
      requirements: 'Internal only.',
      location: 'HQ',
      employment_type: 'FULL_TIME',
      experience_level: 'EXECUTIVE',
      salary_min: 200000,
      salary_max: 250000,
      status: 'DRAFT',
      deadline_utc: null,
    });
    draftJobId = jDraft.id;

    const jClosed = await jobRepository.create({
      id: `job-closed-01`,
      company_id: companyId,
      department_id: departmentId,
      created_by: recUserId,
      title: 'Archived Role',
      description: 'Role filled last month.',
      requirements: 'N/A',
      location: 'HQ',
      employment_type: 'FULL_TIME',
      experience_level: 'ENTRY',
      salary_min: 80000,
      salary_max: 95000,
      status: 'CLOSED',
      deadline_utc: null,
    });
    closedJobId = jClosed.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  test('14.1. Consent Enforcement: Generating recommendations without consent is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        consentAccepted: false,
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.message.includes('consent'));
  });

  test('14.2. Role Guard: Non-applicant (Recruiter) cannot call job recommendations endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recruiterToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
      }),
    });

    assert.strictEqual(res.status, 403);
  });

  test('14.3. Grounded Recommendations: Generates matches strictly from published jobs and returns DB details', async () => {
    mockClient.shouldFail = false;
    mockClient.callCount = 0;

    const res = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.recommendations.length, 1);

    const rec = data.recommendations[0];
    assert.strictEqual(rec.jobId, publishedJob1Id);
    assert.strictEqual(rec.job.title, 'Senior TypeScript Systems Engineer');
    assert.strictEqual(rec.job.company_name, 'Acme AI Systems');
    assert.strictEqual(rec.relevanceScore, 92);
    assert.deepStrictEqual(rec.matchedSkills, ['TypeScript', 'Node.js']);
    assert.strictEqual(data.isFromCache, false);

    // Verify Audit log in DB
    const db = getDatabase();
    const audit = db.queryOne<{ action: string; actor_id: string }>(
      "SELECT action, actor_id FROM audit_logs WHERE actor_id = ? AND action = 'JOB_RECOMMENDATIONS_GENERATED';",
      [applicantId]
    );
    assert.ok(audit);
  });

  test('14.4. Caching & Idempotency: Subsequent request reuses cached result; refresh=true recomputes', async () => {
    const initialCallCount = mockClient.callCount;

    // Call 1: should return cached result without calling Gemini
    const cachedRes = await fetch(`${baseUrl}/api/v1/ai/jobs/recommendations`, {
      headers: {
        Authorization: `Bearer ${applicantToken}`,
      },
    });
    assert.strictEqual(cachedRes.status, 200);
    const cachedData = await cachedRes.json();
    assert.strictEqual(cachedData.isFromCache, true);
    assert.strictEqual(mockClient.callCount, initialCallCount);

    // Call 2: with refresh: true re-invokes model
    const refreshRes = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
        refresh: true,
      }),
    });
    assert.strictEqual(refreshRes.status, 200);
    assert.strictEqual(mockClient.callCount, initialCallCount + 1);
  });

  test('14.5. Strict Grounding: Model hallucinated or unapproved job IDs are discarded', async () => {
    // Inject mock response containing one hallucinated ID and one draft ID
    mockClient.customResponse = {
      recommendedJobs: [
        {
          jobId: 'hallucinated-job-id-9999',
          relevanceScore: 99,
          matchReason: 'Invented job opportunity',
          matchedSkills: ['TypeScript'],
          missingSkills: [],
          preferenceAlignment: 'None',
          evidenceExplanation: 'Invented',
        },
        {
          jobId: draftJobId, // DRAFT job - must be discarded!
          relevanceScore: 88,
          matchReason: 'Draft role match',
          matchedSkills: ['TypeScript'],
          missingSkills: [],
          preferenceAlignment: 'None',
          evidenceExplanation: 'Draft',
        },
        {
          jobId: publishedJob1Id, // Authentic published job
          relevanceScore: 85,
          matchReason: 'Authentic match',
          matchedSkills: ['TypeScript'],
          missingSkills: [],
          preferenceAlignment: 'Aligns',
          evidenceExplanation: 'Grounded',
        },
      ],
      overallSummary: 'Filtered summary',
    };

    const res = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
        refresh: true,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Only the authentic publishedJob1Id survives grounding validation!
    assert.strictEqual(data.recommendations.length, 1);
    assert.strictEqual(data.recommendations[0].jobId, publishedJob1Id);

    // Reset customResponse
    mockClient.customResponse = null;
  });

  test('14.6. Data Minimization: No candidate PII or protected characteristics sent to Gemini', async () => {
    await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
        refresh: true,
      }),
    });

    const promptText = String(mockClient.lastOptions?.contents || '');
    // Ensure candidate PII is absent (no candidate first name, email, or applicant ID)
    assert.strictEqual(promptText.includes('Sam'), false);
    assert.strictEqual(promptText.includes('candidate.rec@srats.local'), false);
    assert.strictEqual(promptText.includes(applicantId), false);
    // Ensure draft and closed jobs were never included in candidate jobs prompt
    assert.strictEqual(promptText.includes(draftJobId), false);
    assert.strictEqual(promptText.includes(closedJobId), false);
    // Only published jobs included
    assert.ok(promptText.includes(publishedJob1Id));
  });

  test('14.7. Service Degradation: Normal job discovery remains operational when AI fails', async () => {
    mockClient.shouldFail = true;
    mockClient.failureType = 'UNAVAILABLE';

    // AI recommendation endpoint degrades gracefully
    const aiRes = await fetch(`${baseUrl}/api/v1/ai/jobs/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantToken}`,
      },
      body: JSON.stringify({
        consentAccepted: true,
        refresh: true,
      }),
    });
    assert.strictEqual(aiRes.status, 503); // Propagates 503 AI_SERVICE_UNAVAILABLE

    // Universal public job discovery remains 100% operational!
    const publicJobsRes = await fetch(`${baseUrl}/api/v1/jobs`);
    assert.strictEqual(publicJobsRes.status, 200);
    const publicJobsData = await publicJobsRes.json();
    assert.ok(publicJobsData.content.length >= 2);

    mockClient.shouldFail = false;
  });
});
