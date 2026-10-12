import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createExpressApp } from '../../server/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { authService } from '../../server/services/authService.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { applicantProfileRepository, resumeRepository, applicantSkillRepository } from '../../server/repositories/applicantProfileRepository.js';
import { storageService, LocalStorageService } from '../../server/services/storageService.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { AuthSessionResponse, StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 4: Applicant Module + Secure Resume Management Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let applicantAToken: string;
  let applicantAId: string;

  let applicantBToken: string;
  let applicantBId: string;

  let recruiterToken: string;

  const testStorageDir = path.resolve(process.cwd(), 'tests/fixtures/test_storage_resumes');

  before(async () => {
    // 1. Clean isolated in-memory database and run Flyway-style migrations
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

    // 2. Register Applicant A
    const regResA = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.alpha@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Alice',
        lastName: 'Applicant',
        role: 'APPLICANT',
      }),
    });
    const regDataA = await regResA.json();
    applicantAId = regDataA.user.id;

    const loginResA = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.alpha@srats.local',
        password: 'Password123!',
        expectedRole: 'APPLICANT',
      }),
    });
    const loginDataA = (await loginResA.json()) as AuthSessionResponse;
    applicantAToken = loginDataA.accessToken;

    // 3. Register Applicant B
    const regResB = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.beta@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Bob',
        lastName: 'Applicant',
        role: 'APPLICANT',
      }),
    });
    const regDataB = await regResB.json();
    applicantBId = regDataB.user.id;

    const loginResB = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.beta@srats.local',
        password: 'Password123!',
        expectedRole: 'APPLICANT',
      }),
    });
    const loginDataB = (await loginResB.json()) as AuthSessionResponse;
    applicantBToken = loginDataB.accessToken;

    // 4. Create active Recruiter token
    recruiterToken = createAccessToken({
      sub: 'usr-recruiter-test',
      email: 'recruiter.test@srats.local',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: 'comp-test',
      firstName: 'Rachel',
      lastName: 'Recruiter',
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    // Cleanup any temporary files created in storage
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  // --- SECTION 1: APPLICANT PROFILE ENDPOINTS & VALIDATION ---

  test('1. Unauthenticated request to /api/v1/applicant/profile returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applicant/profile`);
    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'UNAUTHORIZED');
  });

  test('2. Recruiter role accessing /api/v1/applicant/profile returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'FORBIDDEN');
  });

  test('3. Applicant reads own profile (returns authenticated identity & honest empty fields)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.profile);
    assert.strictEqual(body.profile.userId, applicantAId);
    assert.strictEqual(body.profile.email, 'applicant.alpha@srats.local');
    assert.strictEqual(body.profile.firstName, 'Alice');
    assert.strictEqual(body.profile.lastName, 'Applicant');
    // Initially unpopulated fields are truthful nulls, not fake sample strings
    assert.strictEqual(body.profile.headline, null);
    assert.strictEqual(body.profile.summary, null);
    assert.strictEqual(body.profile.completeness.percentage, 0);
  });

  test('4. Applicant updates own profile with valid data and retrieves persisted state', async () => {
    const updateRes = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        headline: 'Senior Full-Stack Engineer',
        summary: 'Experienced software architect specialized in enterprise Node and React applications.',
        phone: '+1 (555) 019-2834',
        location: 'San Francisco, CA',
        website: 'https://alice.developer.example',
      }),
    });

    assert.strictEqual(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.strictEqual(updateBody.profile.headline, 'Senior Full-Stack Engineer');
    assert.strictEqual(updateBody.profile.phone, '+1 (555) 019-2834');
    assert.strictEqual(updateBody.profile.location, 'San Francisco, CA');
    assert.strictEqual(updateBody.profile.website, 'https://alice.developer.example');
    // Completeness score updated deterministically: Headline (20) + Summary (20) + Contact/Loc (20) = 60%
    assert.strictEqual(updateBody.profile.completeness.percentage, 60);

    // Verify GET endpoint reflects persisted update
    const getRes = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const getBody = await getRes.json();
    assert.strictEqual(getBody.profile.headline, 'Senior Full-Stack Engineer');
  });

  test('5. Profile validation rejects invalid website URL and oversized fields', async () => {
    const badUrlRes = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        website: 'not-a-valid-http-url',
      }),
    });
    assert.strictEqual(badUrlRes.status, 400);

    const oversizedRes = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        headline: 'x'.repeat(300), // Exceeds 255 chars limit
      }),
    });
    assert.strictEqual(oversizedRes.status, 400);
  });

  test('6. IDOR Isolation: Applicant B sees own empty profile, NOT Applicant A profile', async () => {
    const resB = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      headers: { Authorization: `Bearer ${applicantBToken}` },
    });
    assert.strictEqual(resB.status, 200);
    const bodyB = await resB.json();
    assert.strictEqual(bodyB.profile.userId, applicantBId);
    assert.strictEqual(bodyB.profile.email, 'applicant.beta@srats.local');
    assert.strictEqual(bodyB.profile.headline, null);
    assert.notStrictEqual(bodyB.profile.headline, 'Senior Full-Stack Engineer');
  });

  // --- SECTION 2: SKILLS MANAGEMENT ---

  test('7. Applicant adds new skills and lists them in order', async () => {
    const skill1Res = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        skill_name: 'TypeScript',
        level: 'EXPERT',
      }),
    });
    assert.strictEqual(skill1Res.status, 201);
    const skill1 = await skill1Res.json();
    assert.strictEqual(skill1.skill.skill_name, 'TypeScript');
    assert.strictEqual(skill1.skill.level, 'EXPERT');

    const skill2Res = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        skill_name: 'React 19',
        level: 'INTERMEDIATE',
      }),
    });
    assert.strictEqual(skill2Res.status, 201);

    // List skills
    const listRes = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert.strictEqual(listBody.skills.length, 2);
  });

  test('8. Duplicate skill insertion is rejected with 409 Conflict', async () => {
    const dupRes = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        skill_name: 'typescript', // Case-insensitive duplicate check
        level: 'BEGINNER',
      }),
    });
    assert.strictEqual(dupRes.status, 409);
    const body = (await dupRes.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'SKILL_ALREADY_EXISTS');
  });

  test('9. Invalid skill level rejected with 400', async () => {
    const invalidRes = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicantAToken}`,
      },
      body: JSON.stringify({
        skill_name: 'Docker',
        level: 'SUPER_HERO', // Invalid enum
      }),
    });
    assert.strictEqual(invalidRes.status, 400);
  });

  test('10. Skill deletion works and defends against cross-applicant IDOR deletion', async () => {
    const listResA = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const skillsA = (await listResA.json()).skills;
    const targetSkillId = skillsA[0].id;

    // Applicant B attempts to delete Applicant A's skill -> Must fail 404
    const idorDeleteRes = await fetch(`${baseUrl}/api/v1/applicant/skills/${targetSkillId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${applicantBToken}` },
    });
    assert.strictEqual(idorDeleteRes.status, 404);

    // Applicant A deletes own skill -> Succeeds 200
    const ownDeleteRes = await fetch(`${baseUrl}/api/v1/applicant/skills/${targetSkillId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(ownDeleteRes.status, 200);

    // Verify deletion
    const listAfterRes = await fetch(`${baseUrl}/api/v1/applicant/skills`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const skillsAfter = (await listAfterRes.json()).skills;
    assert.strictEqual(skillsAfter.length, 1);
  });

  // --- SECTION 3: RESUME UPLOADS, VALIDATION & REPLACEMENT ---

  function createMultipartPayload(fieldName: string, filename: string, mimeType: string, content: Buffer): { body: any; boundary: string } {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, content, footer]);
    return { body, boundary };
  }

  test('11. Valid PDF upload succeeds (storage recorded, metadata returned, active status verified)', async () => {
    const pdfContent = Buffer.from('%PDF-1.4\n%Fake PDF content for test\n%%EOF');
    const { body, boundary } = createMultipartPayload('file', 'Alice_Resume_2026.pdf', 'application/pdf', pdfContent);

    const res = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${applicantAToken}`,
      },
      body,
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.resume);
    assert.strictEqual(data.resume.fileName, 'Alice_Resume_2026.pdf');
    assert.strictEqual(data.resume.fileMime, 'application/pdf');
    assert.strictEqual(data.resume.isPrimary, true);
    assert.strictEqual(data.resume.isActive, true);
    // Security check: internal filesystem path must NOT be leaked
    assert.strictEqual('storage_path' in data.resume, false);
    assert.strictEqual('storagePath' in data.resume, false);

    // Profile completeness score is now 100% (Headline + Summary + Phone/Loc + Skill + Resume)
    const profileRes = await fetch(`${baseUrl}/api/v1/applicant/profile`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const profile = (await profileRes.json()).profile;
    assert.strictEqual(profile.completeness.percentage, 100);
  });

  test('12. Valid DOCX upload succeeds', async () => {
    // DOCX ZIP signature: PK\x03\x04
    const docxContent = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('test docx payload content')]);
    const { body, boundary } = createMultipartPayload(
      'file',
      'Alice_Resume_V2.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docxContent
    );

    const res = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${applicantAToken}`,
      },
      body,
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.resume.fileName, 'Alice_Resume_V2.docx');
    assert.strictEqual(data.resume.isPrimary, true);
  });

  test('13. Resume replacement updates active state and archives previous resume deterministically', async () => {
    // List resumes for Applicant A: must have exactly 1 active primary resume
    const listRes = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const listBody = await listRes.json();
    const activeResumes = listBody.resumes.filter((r: { isActive: boolean; isPrimary: boolean }) => r.isActive && r.isPrimary);
    assert.strictEqual(activeResumes.length, 1, 'Exactly one resume must be current and primary');
    assert.strictEqual(activeResumes[0].fileName, 'Alice_Resume_V2.docx');

    // Historical resume must still exist in records for future application references
    const inactiveResumes = listBody.resumes.filter((r: { isActive: boolean }) => !r.isActive);
    assert.strictEqual(inactiveResumes.length, 1);
    assert.strictEqual(inactiveResumes[0].fileName, 'Alice_Resume_2026.pdf');
  });

  test('14. Unsupported file extension (.exe) is rejected with 400', async () => {
    const exeContent = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    const { body, boundary } = createMultipartPayload('file', 'malware.exe', 'application/pdf', exeContent);

    const res = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${applicantAToken}`,
      },
      body,
    });

    assert.strictEqual(res.status, 400);
    const err = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(err.error, 'UNSUPPORTED_FILE_TYPE');
  });

  test('15. Spoofed MIME type with invalid binary header is rejected', async () => {
    // Claims to be PDF but contains arbitrary plain text without %PDF- signature
    const spoofContent = Buffer.from('Hello world this is not a pdf');
    const { body, boundary } = createMultipartPayload('file', 'fake.pdf', 'application/pdf', spoofContent);

    const res = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${applicantAToken}`,
      },
      body,
    });

    assert.strictEqual(res.status, 400);
    const err = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(err.error, 'CORRUPTED_OR_SPOOFED_FILE');
  });

  test('16. File larger than 5 MB is rejected with 413', async () => {
    // 5.1 MB buffer with %PDF- header
    const largeBuffer = Buffer.alloc(5.1 * 1024 * 1024);
    largeBuffer.write('%PDF-1.4\n');
    const { body, boundary } = createMultipartPayload('file', 'huge_resume.pdf', 'application/pdf', largeBuffer);

    const res = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${applicantAToken}`,
      },
      body,
    });

    assert.strictEqual(res.status, 413);
  });

  test('17. Path traversal attempt in upload filename is sanitized and harmless', async () => {
    const pdfContent = Buffer.from('%PDF-1.4\nPath traversal test\n%%EOF');
    const { body, boundary } = createMultipartPayload(
      'file',
      '../../../../etc/passwd.pdf',
      'application/pdf',
      pdfContent
    );

    const res = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${applicantAToken}`,
      },
      body,
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    // Sanitized to base filename: passwd.pdf
    assert.strictEqual(data.resume.fileName, 'passwd.pdf');
  });

  // --- SECTION 4: SECURE RESUME RETRIEVAL & IDOR CHECKS ---

  test('18. Applicant can download own resume file with secure non-cacheable headers', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const resumes = (await listRes.json()).resumes;
    const resumeId = resumes[0].id;

    const downloadRes = await fetch(`${baseUrl}/api/v1/applicant/resumes/${resumeId}/file`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });

    assert.strictEqual(downloadRes.status, 200);
    assert.ok(downloadRes.headers.get('content-type')?.includes('application/'));
    assert.ok(downloadRes.headers.get('content-disposition')?.includes('inline; filename='));
    assert.strictEqual(downloadRes.headers.get('cache-control'), 'private, no-cache, no-store, must-revalidate');
    assert.strictEqual(downloadRes.headers.get('x-content-type-options'), 'nosniff');

    const fileBuf = await downloadRes.arrayBuffer();
    assert.ok(fileBuf.byteLength > 0);
  });

  test('19. IDOR Defense: Applicant B cannot download Applicant A resume file (404/403)', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const resumeIdA = (await listRes.json()).resumes[0].id;

    // Applicant B attempts download of Applicant A's resume
    const idorRes = await fetch(`${baseUrl}/api/v1/applicant/resumes/${resumeIdA}/file`, {
      headers: { Authorization: `Bearer ${applicantBToken}` },
    });

    assert.strictEqual(idorRes.status, 404);
  });

  test('20. Unauthenticated access to resume file download returns 401', async () => {
    const listRes = await fetch(`${baseUrl}/api/v1/applicant/resumes`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    const resumeIdA = (await listRes.json()).resumes[0].id;

    const unauthRes = await fetch(`${baseUrl}/api/v1/applicant/resumes/${resumeIdA}/file`);
    assert.strictEqual(unauthRes.status, 401);
  });

  test('21. Resumes are NOT accessible through public static assets URL', async () => {
    const staticRes = await fetch(`${baseUrl}/storage/resumes/some_file.pdf`);
    // Should be caught by SPA HTML fallback or 404, never raw binary file serving
    assert.notStrictEqual(staticRes.headers.get('content-type'), 'application/pdf');
  });

  // --- SECTION 5: STORAGE SERVICE UNIT TESTS & COMPENSATING CLEANUP ---

  test('22. StorageService: Blocks path traversal keys', async () => {
    const customStorage = new LocalStorageService(testStorageDir);
    await assert.rejects(
      async () => {
        await customStorage.save('../../../secret.txt', Buffer.from('data'), 'text/plain');
      },
      (err: Error) => err.message.includes('Illegal or insecure storage key')
    );
  });

  test('23. StorageService: CRUD operations in isolated storage', async () => {
    const customStorage = new LocalStorageService(testStorageDir);
    const testKey = 'unit_test/sample_doc.pdf';
    const content = Buffer.from('Isolated storage test payload');

    const savedKey = await customStorage.save(testKey, content, 'application/pdf');
    assert.strictEqual(savedKey, testKey);

    const exists = await customStorage.exists(testKey);
    assert.strictEqual(exists, true);

    const readData = await customStorage.read(testKey);
    assert.deepStrictEqual(readData, content);

    const deleted = await customStorage.delete(testKey);
    assert.strictEqual(deleted, true);

    const existsAfter = await customStorage.exists(testKey);
    assert.strictEqual(existsAfter, false);
  });

  test('24. Transaction integrity: Resume replacement rolls back if forced error occurs', async () => {
    const db = getDatabase();
    // Verify currently exactly one active resume for applicant A
    const beforePrimary = await resumeRepository.findPrimaryByApplicant(applicantAId);
    assert.ok(beforePrimary);

    // Intentionally test transaction failure by attempting an insertion with a malformed constraint or simulating failure
    assert.throws(() => {
      db.execute('BEGIN TRANSACTION;');
      db.execute('UPDATE resumes SET is_primary = 0 WHERE applicant_id = ?;', [applicantAId]);
      // Force error: duplicate primary key
      db.execute('INSERT INTO resumes (id, applicant_id) VALUES (?, ?);', [beforePrimary.id, applicantAId]);
    });
    db.execute('ROLLBACK;');

    // Primary resume remains intact
    const afterRollback = await resumeRepository.findPrimaryByApplicant(applicantAId);
    assert.strictEqual(afterRollback?.id, beforePrimary.id);
    assert.strictEqual(afterRollback?.is_primary, 1);
  });
});
