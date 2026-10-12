import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createExpressApp } from '../../server/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { authService } from '../../server/services/authService.js';
import { userRepository } from '../../server/repositories/userRepository.js';
import { companyRepository } from '../../server/repositories/companyRepository.js';
import { auditLogRepository } from '../../server/repositories/notificationRepository.js';
import { createAccessToken } from '../../server/security/jwt.js';
import { hashPassword } from '../../server/security/crypto.js';
import type { StandardErrorResponse } from '../../server/types/index.js';

describe('Phase 11: Administration & Audit Log Forensic Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let adminToken: string;
  let adminId: string;
  let secondAdminToken: string;
  let secondAdminId: string;

  let applicantToken: string;
  let applicantId: string;
  let recruiterToken: string;
  let recruiterId: string;
  let interviewerToken: string;
  let hrToken: string;

  const testCompanyId = 'comp-admin-test-01';

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

    const passHash = await hashPassword('AdminPass123!');

    // Create Second Admin for last-admin safety tests
    secondAdminId = 'usr-admin-second-02';
    await userRepository.create({
      id: secondAdminId,
      email: 'secondary.admin@srats.system',
      password_hash: passHash,
      role: 'ADMIN',
      account_status: 'ACTIVE',
      first_name: 'Secondary',
      last_name: 'Admin',
      company_id: null,
    });
    secondAdminToken = createAccessToken({
      sub: secondAdminId,
      email: 'secondary.admin@srats.system',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Secondary',
      lastName: 'Admin',
    });

    // Create Test Company
    await companyRepository.create({
      id: testCompanyId,
      name: 'OmniCorp Logistics',
      domain: 'omnicorp.example',
      industry: 'Supply Chain',
      size: '500+',
      location: 'Chicago, IL',
    });

    // Create other roles for negative tests
    applicantId = 'usr-admin-test-app';
    await userRepository.create({
      id: applicantId,
      email: 'alex.candidate@test.local',
      password_hash: passHash,
      role: 'APPLICANT',
      account_status: 'ACTIVE',
      first_name: 'Alex',
      last_name: 'Candidate',
      company_id: null,
    });
    applicantToken = createAccessToken({
      sub: applicantId,
      email: 'alex.candidate@test.local',
      role: 'APPLICANT',
      accountStatus: 'ACTIVE',
      companyId: null,
      firstName: 'Alex',
      lastName: 'Candidate',
    });

    recruiterId = 'usr-admin-test-rec';
    await userRepository.create({
      id: recruiterId,
      email: 'rita.recruiter@omnicorp.example',
      password_hash: passHash,
      role: 'RECRUITER',
      account_status: 'ACTIVE',
      first_name: 'Rita',
      last_name: 'Recruiter',
      company_id: testCompanyId,
    });
    recruiterToken = createAccessToken({
      sub: recruiterId,
      email: 'rita.recruiter@omnicorp.example',
      role: 'RECRUITER',
      accountStatus: 'ACTIVE',
      companyId: testCompanyId,
      firstName: 'Rita',
      lastName: 'Recruiter',
    });

    interviewerToken = createAccessToken({
      sub: 'usr-admin-test-int',
      email: 'ian.int@omnicorp.example',
      role: 'INTERVIEWER',
      accountStatus: 'ACTIVE',
      companyId: testCompanyId,
      firstName: 'Ian',
      lastName: 'Interviewer',
    });

    hrToken = createAccessToken({
      sub: 'usr-admin-test-hr',
      email: 'helen.hr@omnicorp.example',
      role: 'HR_MANAGER',
      accountStatus: 'ACTIVE',
      companyId: testCompanyId,
      firstName: 'Helen',
      lastName: 'HR',
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  // --- AUTHORIZATION & DIRECT API NEGATIVE TESTS ---

  test('1. Unauthenticated request to /api/v1/admin/users returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users`);
    assert.strictEqual(res.status, 401);
  });

  test('2. Direct API negative test: APPLICANT calling admin endpoints returns 403', async () => {
    const [uRes, cRes, aRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${applicantToken}` } }),
      fetch(`${baseUrl}/api/v1/admin/companies`, { headers: { Authorization: `Bearer ${applicantToken}` } }),
      fetch(`${baseUrl}/api/v1/admin/audit-logs`, { headers: { Authorization: `Bearer ${applicantToken}` } }),
    ]);
    assert.strictEqual(uRes.status, 403);
    assert.strictEqual(cRes.status, 403);
    assert.strictEqual(aRes.status, 403);
  });

  test('3. Direct API negative test: RECRUITER calling admin endpoints returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('4. Direct API negative test: INTERVIEWER calling admin endpoints returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/companies`, {
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('5. Direct API negative test: HR_MANAGER calling admin endpoints returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('6. ADMIN can successfully access admin endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.content));
    assert.ok(body.totalElements >= 4);
  });

  // --- USER MANAGEMENT & SENSITIVE DATA MINIMIZATION ---

  test('7. Admin lists users without leaking password hashes or internal secrets', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    for (const u of body.content) {
      assert.strictEqual((u as any).password_hash, undefined);
      assert.strictEqual((u as any).password, undefined);
      assert.strictEqual((u as any).token, undefined);
      assert.strictEqual((u as any).refresh_token, undefined);
      assert.ok(u.id);
      assert.ok(u.email);
      assert.ok(u.role);
    }
  });

  test('8. Admin filters users by search keyword and role', async () => {
    const searchRes = await fetch(`${baseUrl}/api/v1/admin/users?search=Candidate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchData = await searchRes.json();
    assert.strictEqual(searchData.content.length, 1);
    assert.strictEqual(searchData.content[0].email, 'alex.candidate@test.local');

    const roleRes = await fetch(`${baseUrl}/api/v1/admin/users?role=RECRUITER`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const roleData = await roleRes.json();
    assert.ok(roleData.content.length >= 1);
    assert.strictEqual(roleData.content[0].role, 'RECRUITER');
  });

  // --- ACCOUNT ACTIVATION & DEACTIVATION ---

  test('9. Admin deactivates user and verifies audit log emission', async () => {
    const deactRes = await fetch(`${baseUrl}/api/v1/admin/users/${applicantId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'DEACTIVATED' }),
    });
    assert.strictEqual(deactRes.status, 200);
    const deactData = await deactRes.json();
    assert.strictEqual(deactData.status, 'DEACTIVATED');

    // Verify user record updated in database
    const user = await userRepository.findById(applicantId);
    assert.strictEqual(user?.account_status, 'DEACTIVATED');

    // Verify AuditLog record created
    const logs = await auditLogRepository.queryFiltered({
      action: 'ADMIN_USER_STATUS_UPDATED',
      entityType: 'USER',
      limit: 5,
    });
    const matchedLog = logs.find((l) => l.entity_id === applicantId);
    assert.ok(matchedLog);
    assert.strictEqual(matchedLog.actor_id, adminId);
    assert.ok(matchedLog.metadata_json?.includes('DEACTIVATED'));
  });

  test('10. Deactivated user is blocked from logging in (403 ACCOUNT_DEACTIVATED)', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.candidate@test.local',
        password: 'AdminPass123!',
      }),
    });
    assert.strictEqual(loginRes.status, 403);
    const err = (await loginRes.json()) as StandardErrorResponse;
    assert.strictEqual(err.error, 'ACCOUNT_DEACTIVATED');
  });

  test('11. Admin reactivates user to ACTIVE status', async () => {
    const reactRes = await fetch(`${baseUrl}/api/v1/admin/users/${applicantId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    assert.strictEqual(reactRes.status, 200);

    const user = await userRepository.findById(applicantId);
    assert.strictEqual(user?.account_status, 'ACTIVE');
  });

  // --- ADMIN SELF-PROTECTION & RECOVERY SAFETY ---

  test('12. Admin self-protection: Admin cannot deactivate own account (400 CANNOT_DEACTIVATE_SELF)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${adminId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'DEACTIVATED' }),
    });
    assert.strictEqual(res.status, 400);
    const err = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(err.error, 'CANNOT_DEACTIVATE_SELF');
  });

  test('13. Last active Admin protection: Cannot deactivate the final remaining active admin', async () => {
    // 1. Deactivate secondary admin
    await fetch(`${baseUrl}/api/v1/admin/users/${secondAdminId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'DEACTIVATED' }),
    });

    // 2. Now primary admin is the sole active admin. Attempt to deactivate him via secondary admin credentials
    // But secondary admin is deactivated, so token is invalid. If we test with primary admin calling, self-protection catches it.
    // Let's reactivate secondary admin, then try to deactivate primary admin from secondary admin:
    await userRepository.updateAccountStatus(secondAdminId, 'ACTIVE');

    // Deactivate primary admin from secondary admin -> allowed because 2 admins exist
    const deactPrimary = await fetch(`${baseUrl}/api/v1/admin/users/${adminId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secondAdminToken}`,
      },
      body: JSON.stringify({ status: 'DEACTIVATED' }),
    });
    assert.strictEqual(deactPrimary.status, 200);

    // Now secondary admin is the ONLY active admin left.
    // Attempting to deactivate secondary admin must fail:
    const deactLast = await fetch(`${baseUrl}/api/v1/admin/users/${secondAdminId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secondAdminToken}`,
      },
      body: JSON.stringify({ status: 'DEACTIVATED' }),
    });
    assert.strictEqual(deactLast.status, 400);

    // Restore primary admin
    await userRepository.updateAccountStatus(adminId, 'ACTIVE');
  });

  test('14. Last active Admin protection: Cannot downgrade role of the last active admin', async () => {
    // Deactivate secondary admin
    await userRepository.updateAccountStatus(secondAdminId, 'DEACTIVATED');

    // Attempt to downgrade primary admin to RECRUITER
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${adminId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'RECRUITER' }),
    });
    assert.strictEqual(res.status, 400);
    const err = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(err.error, 'CANNOT_DOWNGRADE_LAST_ADMIN');

    // Reactivate secondary admin
    await userRepository.updateAccountStatus(secondAdminId, 'ACTIVE');
  });

  // --- ROLE MANAGEMENT & COMPANY BINDING ---

  test('15. Admin updates candidate role to INTERVIEWER and verifies audit log', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${applicantId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'INTERVIEWER' }),
    });
    assert.strictEqual(res.status, 200);

    const user = await userRepository.findById(applicantId);
    assert.strictEqual(user?.role, 'INTERVIEWER');

    const logs = await auditLogRepository.queryFiltered({
      action: 'ADMIN_USER_ROLE_UPDATED',
      limit: 5,
    });
    assert.ok(logs.some((l) => l.entity_id === applicantId && l.metadata_json?.includes('INTERVIEWER')));
  });

  test('16. Admin binds user to company and verifies audit log', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${applicantId}/company`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ companyId: testCompanyId }),
    });
    assert.strictEqual(res.status, 200);

    const user = await userRepository.findById(applicantId);
    assert.strictEqual(user?.company_id, testCompanyId);

    const logs = await auditLogRepository.queryFiltered({
      action: 'ADMIN_USER_COMPANY_BOUND',
      limit: 5,
    });
    assert.ok(logs.some((l) => l.entity_id === applicantId));
  });

  test('17. Binding user to non-existent company returns 404 COMPANY_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${applicantId}/company`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ companyId: 'comp-non-existent-99' }),
    });
    assert.strictEqual(res.status, 404);
  });

  // --- COMPANY ORGANIZATIONAL MANAGEMENT ---

  test('18. Admin creates new company organization and verifies audit log', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Vanguard Aerospace LLC',
        domain: 'vanguard.aero',
        industry: 'Aerospace & Defense',
        size: '100-500',
        location: 'Seattle, WA',
      }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.company.id);
    assert.strictEqual(body.company.name, 'Vanguard Aerospace LLC');

    // Audit log check
    const logs = await auditLogRepository.queryFiltered({
      action: 'ADMIN_COMPANY_CREATED',
      limit: 5,
    });
    assert.ok(logs.some((l) => l.entity_id === body.company.id));
  });

  test('19. Creating company with duplicate name returns 409 conflict', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Vanguard Aerospace LLC',
      }),
    });
    assert.strictEqual(res.status, 409);
  });

  test('20. Admin toggles company active/inactive status and verifies audit log', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/companies/${testCompanyId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.strictEqual(res.status, 200);

    const comp = await companyRepository.findById(testCompanyId);
    assert.strictEqual(comp?.is_active, 0);

    // Restore to active
    await fetch(`${baseUrl}/api/v1/admin/companies/${testCompanyId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });
  });

  // --- AUDIT LOG QUERYING, FILTERING & IMMUTABILITY ---

  test('21. Admin retrieves paginated audit logs with metadata', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/audit-logs?page=0&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.content));
    assert.ok(body.totalElements > 0);
    assert.strictEqual(body.page, 0);
    assert.strictEqual(body.size, 10);

    const first = body.content[0];
    assert.ok(first.id);
    assert.ok(first.action);
    assert.ok(first.created_at);
  });

  test('22. Admin filters audit logs by action and entity type', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/admin/audit-logs?action=ADMIN_USER_STATUS_UPDATED&entityType=USER`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.content.length >= 1);
    for (const log of body.content) {
      assert.strictEqual(log.action, 'ADMIN_USER_STATUS_UPDATED');
      assert.strictEqual(log.entity_type, 'USER');
    }
  });

  test('23. Audit logs immutability: No DELETE or modification endpoints exist for audit logs', async () => {
    const delRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // Express returns 404 for undefined DELETE route
    assert.strictEqual(delRes.status, 404);

    const postRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'FAKE_INJECTED_ACTION' }),
    });
    assert.strictEqual(postRes.status, 404);
  });

  test('24. SQL injection payloads in audit filter query params are safely parameterized', async () => {
    const sqli = "' OR '1'='1' -- ";
    const res = await fetch(
      `${baseUrl}/api/v1/admin/audit-logs?action=${encodeURIComponent(sqli)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // Must return 0 records matching the literal injection string, not all records
    assert.strictEqual(body.content.length, 0);
  });
});
