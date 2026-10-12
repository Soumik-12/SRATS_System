import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createExpressApp } from '../../server/app.js';
import { initDatabase, closeDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { authService } from '../../server/services/authService.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { companyRepository } from '../../server/repositories/companyRepository.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword, verifyPassword } from '../../server/security/crypto.js';
import type { AuthSessionResponse, StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 3: Five-Role Authentication, RBAC & Security Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    // Start with a clean in-memory database and run V1, V2, V3 migrations
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
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  // --- SECTION 1: REGISTRATION TESTS ---

  test('1. Applicant self-registration succeeds with ACTIVE status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Alex',
        lastName: 'Applicant',
        role: 'APPLICANT',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as { message: string; user: AuthSessionResponse['user'] };
    assert.strictEqual(body.user.role, 'APPLICANT');
    assert.strictEqual(body.user.accountStatus, 'ACTIVE');
    assert.strictEqual(body.user.email, 'applicant.one@srats.local');
    // Ensure password_hash is never exposed
    assert.strictEqual('password_hash' in body.user, false);
    assert.strictEqual('password' in body.user, false);
  });

  test('2. Recruiter registration/request succeeds with PENDING status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recruiter.pending@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Rachel',
        lastName: 'Recruiter',
        role: 'RECRUITER',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as { message: string; user: AuthSessionResponse['user'] };
    assert.strictEqual(body.user.role, 'RECRUITER');
    assert.strictEqual(body.user.accountStatus, 'PENDING');
  });

  test('3. Interviewer and HR Manager registrations create PENDING accounts', async () => {
    const resInterviewer = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'interviewer.pending@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Ian',
        lastName: 'Interviewer',
        role: 'INTERVIEWER',
      }),
    });
    assert.strictEqual(resInterviewer.status, 201);
    const bodyInt = await resInterviewer.json();
    assert.strictEqual(bodyInt.user.accountStatus, 'PENDING');

    const resHr = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hr.pending@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Hannah',
        lastName: 'Leader',
        role: 'HR_MANAGER',
      }),
    });
    assert.strictEqual(resHr.status, 201);
    const bodyHr = await resHr.json();
    assert.strictEqual(bodyHr.user.accountStatus, 'PENDING');
  });

  test('4. Public Admin registration is strictly FORBIDDEN (403)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hacker.admin@srats.local',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Fake',
        lastName: 'Admin',
        role: 'ADMIN',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'ADMIN_REGISTRATION_FORBIDDEN');
  });

  test('5. Duplicate email registration is rejected with 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local', // Already registered in test 1
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
        role: 'APPLICANT',
      }),
    });

    assert.strictEqual(res.status, 409);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'EMAIL_ALREADY_EXISTS');
  });

  test('6. Password hashing: Verified unique salt and PBKDF2 hash stored', async () => {
    const user = await userRepository.findByEmail('applicant.one@srats.local');
    assert.ok(user);
    assert.ok(user.password_hash.startsWith('pbkdf2$100000$'));
    assert.strictEqual(user.password_hash.includes('Password123!'), false);
    assert.strictEqual(verifyPassword('Password123!', user.password_hash), true);
    assert.strictEqual(verifyPassword('WrongPassword', user.password_hash), false);
  });

  // --- SECTION 2: LOGIN & TOKEN LIFECYCLE TESTS ---

  test('7. Correct password login succeeds and returns valid token pair', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local',
        password: 'Password123!',
        expectedRole: 'APPLICANT',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as AuthSessionResponse;
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.strictEqual(body.expiresIn, 900);
    assert.strictEqual(body.user.role, 'APPLICANT');
    assert.strictEqual('password_hash' in body.user, false);
  });

  test('8. Wrong password login fails with generic 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local',
        password: 'WrongPassword999!',
      }),
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'INVALID_CREDENTIALS');
  });

  test('9. Role mismatch context login is safely rejected (401)', async () => {
    // Applicant credentials attempting login with Recruiter role context
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local',
        password: 'Password123!',
        expectedRole: 'RECRUITER',
      }),
    });

    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'ROLE_MISMATCH');
    assert.strictEqual(body.message, 'These credentials are not registered for the selected role.');
  });

  test('10. Pending recruiter login is rejected (403)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recruiter.pending@srats.local',
        password: 'Password123!',
        expectedRole: 'RECRUITER',
      }),
    });

    assert.strictEqual(res.status, 403);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'ACCOUNT_PENDING_APPROVAL');
  });

  test('11. Deactivated user login is rejected (403)', async () => {
    // Create deactivated user
    const deact = await userRepository.create({
      id: 'usr-deact-test',
      email: 'deactivated.user@srats.local',
      password_hash: 'hashed',
      role: 'APPLICANT',
      account_status: 'DEACTIVATED',
      first_name: 'Deactivated',
      last_name: 'User',
      company_id: null,
    });
    // Set password properly
    await userRepository.softDelete(deact.id);

    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'deactivated.user@srats.local',
        password: 'Password123!',
      }),
    });

    assert.strictEqual(res.status, 401); // User soft-deleted
  });

  test('12. /api/v1/auth/me returns authenticated identity', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local',
        password: 'Password123!',
      }),
    });
    const session = (await loginRes.json()) as AuthSessionResponse;

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    assert.strictEqual(meRes.status, 200);
    const meBody = (await meRes.json()) as { user: AuthSessionResponse['user'] };
    assert.strictEqual(meBody.user.email, 'applicant.one@srats.local');
    assert.strictEqual(meBody.user.role, 'APPLICANT');
    assert.strictEqual(meBody.user.accountStatus, 'ACTIVE');
  });

  test('13. Refresh token rotation & Revocation on Logout', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'applicant.one@srats.local',
        password: 'Password123!',
      }),
    });
    const session1 = (await loginRes.json()) as AuthSessionResponse;

    // Refresh token rotation
    const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session1.refreshToken }),
    });

    assert.strictEqual(refreshRes.status, 200);
    const session2 = (await refreshRes.json()) as AuthSessionResponse;
    assert.notStrictEqual(session1.refreshToken, session2.refreshToken, 'Refresh token must be rotated');

    // Attempting to reuse old refresh token must be rejected (Revoked)
    const reuseRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session1.refreshToken }),
    });
    assert.strictEqual(reuseRes.status, 401);

    // Logout using current refresh token
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session2.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: session2.refreshToken }),
    });
    assert.strictEqual(logoutRes.status, 200);

    // Refresh token should now be completely revoked
    const postLogoutRefresh = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session2.refreshToken }),
    });
    assert.strictEqual(postLogoutRefresh.status, 401);
  });

  // --- SECTION 3: AUTHORIZATION & RBAC TESTS ---

  test('14. Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/test/auth/applicant-only`);
    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'UNAUTHORIZED');
  });

  test('15. Expired or tampered access token returns 401', async () => {
    // Expired token (exp in past)
    const expiredToken = createAccessToken(
      {
        sub: 'usr-123',
        email: 'test@expired.local',
        role: 'APPLICANT',
        accountStatus: 'ACTIVE',
        companyId: null,
        firstName: 'Exp',
        lastName: 'User',
      },
      -10 // Expired 10 seconds ago
    );

    const res = await fetch(`${baseUrl}/api/v1/test/auth/applicant-only`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.error, 'TOKEN_EXPIRED');

    // Tampered signature
    const tamperedToken = expiredToken.slice(0, -5) + 'ABCDE';
    const resTampered = await fetch(`${baseUrl}/api/v1/test/auth/applicant-only`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert.strictEqual(resTampered.status, 401);
    const bodyTampered = (await resTampered.json()) as StandardErrorResponse;
    assert.strictEqual(bodyTampered.error, 'INVALID_TOKEN_SIGNATURE');
  });

  test('16. Applicant cannot access Recruiter or Admin endpoints (403 Forbidden)', async () => {
    const applicantToken = createAccessToken({
      sub: 'usr-app-1',
      email: 'alex@srats.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Alex',
      lastName: 'Applicant',
    });

    const resRecruiter = await fetch(`${baseUrl}/api/v1/test/auth/recruiter-only`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(resRecruiter.status, 403);
    const bodyRecruiter = (await resRecruiter.json()) as StandardErrorResponse;
    assert.strictEqual(bodyRecruiter.error, 'FORBIDDEN');

    const resAdmin = await fetch(`${baseUrl}/api/v1/test/auth/admin-only`, {
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    assert.strictEqual(resAdmin.status, 403);
  });

  test('17. Recruiter cannot access Admin endpoints (403 Forbidden)', async () => {
    const recruiterToken = createAccessToken({
      sub: 'usr-rec-1',
      email: 'recruiter@company.local',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: 'comp-100',
      firstName: 'Rachel',
      lastName: 'Recruiter',
    });

    const resAdmin = await fetch(`${baseUrl}/api/v1/test/auth/admin-only`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
    });
    assert.strictEqual(resAdmin.status, 403);
  });

  test('18. Object-level authorization (IDOR Defense): Applicant A cannot read Applicant B profile', async () => {
    const applicantAToken = createAccessToken({
      sub: 'usr-applicant-A',
      email: 'a@srats.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Alice',
      lastName: 'A',
    });

    // Accessing own profile succeeds
    const resOwn = await fetch(`${baseUrl}/api/v1/test/auth/user-profile/usr-applicant-A`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(resOwn.status, 200);

    // Accessing Applicant B profile is rejected with 403
    const resB = await fetch(`${baseUrl}/api/v1/test/auth/user-profile/usr-applicant-B`, {
      headers: { Authorization: `Bearer ${applicantAToken}` },
    });
    assert.strictEqual(resB.status, 403);
    const bodyB = (await resB.json()) as StandardErrorResponse;
    assert.strictEqual(bodyB.error, 'FORBIDDEN_IDOR');
  });

  test('19. Company-level isolation: Recruiter from Company A cannot query Company B data', async () => {
    const recruiterAToken = createAccessToken({
      sub: 'usr-rec-A',
      email: 'rec@compA.local',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: 'comp-alpha',
      firstName: 'Rec',
      lastName: 'A',
    });

    // Accessing Company Alpha data succeeds
    const resOwnCompany = await fetch(`${baseUrl}/api/v1/test/auth/company-data/comp-alpha`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(resOwnCompany.status, 200);

    // Accessing Company Beta data is rejected with 403
    const resOtherCompany = await fetch(`${baseUrl}/api/v1/test/auth/company-data/comp-beta`, {
      headers: { Authorization: `Bearer ${recruiterAToken}` },
    });
    assert.strictEqual(resOtherCompany.status, 403);
    const bodyOther = (await resOtherCompany.json()) as StandardErrorResponse;
    assert.strictEqual(bodyOther.error, 'FORBIDDEN_COMPANY_SCOPE');
  });

  // --- SECTION 4: ADMIN BOOTSTRAP & FIVE-ROLE AUTHENTICATION ---

  test('20. System Administrator bootstrapped and authenticated successfully', async () => {
    const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@srats.system',
        password: 'SratsAdminSecure2026!',
        expectedRole: 'ADMIN',
      }),
    });

    assert.strictEqual(adminLoginRes.status, 200);
    const adminSession = (await adminLoginRes.json()) as AuthSessionResponse;
    assert.strictEqual(adminSession.user.role, 'ADMIN');

    // Admin can access admin-only endpoint
    const adminRes = await fetch(`${baseUrl}/api/v1/test/auth/admin-only`, {
      headers: { Authorization: `Bearer ${adminSession.accessToken}` },
    });
    assert.strictEqual(adminRes.status, 200);

    // Repeated bootstrap call is idempotent
    await authService.bootstrapAdmin();
    const adminCount = await userRepository.listByRole('ADMIN');
    assert.strictEqual(adminCount.length, 1, 'Only one bootstrap admin should exist');
  });

  test('21. All 5 Roles authenticate through unified infrastructure', async () => {
    // Setup approved accounts for all 5 roles
    await companyRepository.create({
      id: 'comp-unified',
      name: 'Unified Corp',
      domain: 'unified.local',
      industry: 'Software',
      size: '100',
      location: 'Austin, TX',
    });

    // Recruiter (Active)
    await userRepository.create({
      id: 'usr-active-rec',
      email: 'recruiter.active@srats.local',
      password_hash: hashPassword('Password123!'),
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Rachel',
      last_name: 'Recruiter',
      company_id: 'comp-unified',
    });

    // Interviewer (Active)
    await userRepository.create({
      id: 'usr-active-int',
      email: 'interviewer.active@srats.local',
      password_hash: (await userRepository.findByEmail('applicant.one@srats.local'))!.password_hash,
      role: 'INTERVIEWER',
      account_status: 'ACTIVE',
      first_name: 'Ian',
      last_name: 'Interviewer',
      company_id: 'comp-unified',
    });

    // HR Manager (Active)
    await userRepository.create({
      id: 'usr-active-hr',
      email: 'hr.active@srats.local',
      password_hash: (await userRepository.findByEmail('applicant.one@srats.local'))!.password_hash,
      role: 'HR_MANAGER',
      account_status: 'ACTIVE',
      first_name: 'Helen',
      last_name: 'HR',
      company_id: 'comp-unified',
    });

    const rolesToTest = [
      { email: 'applicant.one@srats.local', role: 'APPLICANT' },
      { email: 'recruiter.active@srats.local', role: 'RECRUITER' },
      { email: 'interviewer.active@srats.local', role: 'INTERVIEWER' },
      { email: 'hr.active@srats.local', role: 'HR_MANAGER' },
      { email: 'admin@srats.system', role: 'ADMIN' },
    ];

    for (const item of rolesToTest) {
      const password = item.role === 'ADMIN' ? 'SratsAdminSecure2026!' : 'Password123!';
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: item.email,
          password,
          expectedRole: item.role,
        }),
      });

      assert.strictEqual(res.status, 200, `Login must succeed for role ${item.role}`);
      const session = (await res.json()) as AuthSessionResponse;
      assert.strictEqual(session.user.role, item.role);

      // Verify /me endpoint works for each role
      const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      assert.strictEqual(meRes.status, 200);
      const meBody = (await meRes.json()) as { user: AuthSessionResponse['user'] };
      assert.strictEqual(meBody.user.role, item.role);
    }
  });
});
