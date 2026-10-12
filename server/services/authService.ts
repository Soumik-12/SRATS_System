import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  generateSecureToken,
  hashToken,
} from '../security/crypto.js';
import { createAccessToken } from '../security/jwt.js';
import { userRepository } from '../repositories/userRepository.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { applicantProfileRepository } from '../repositories/applicantProfileRepository.js';
import { auditLogRepository } from '../repositories/notificationRepository.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { UserRole, AccountStatus } from '../domain/entities.js';
import type { AuthSessionResponse } from '../types/index.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const RegisterInputSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string().min(8),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN']),
  companyId: z.string().nullable().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const LoginInputSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
  expectedRole: z.enum(['APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN']).optional(),
});

export class AuthService {
  async register(data: unknown): Promise<{ message: string; user: AuthSessionResponse['user'] }> {
    const validated = RegisterInputSchema.parse(data);

    // Security Non-Negotiable: Public Admin Registration is Strictly Forbidden
    if (validated.role === 'ADMIN') {
      throw new AppError(
        403,
        'ADMIN_REGISTRATION_FORBIDDEN',
        'Public administrator registration is prohibited. Administrator accounts must be provisioned through system bootstrap.'
      );
    }

    const email = normalizeEmail(validated.email);
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email address already exists. Please sign in or use another email.'
      );
    }

    const passwordHash = hashPassword(validated.password);
    const userId = `usr-${Date.now().toString(36)}-${generateSecureToken(4)}`;

    // Account Status Policy:
    // APPLICANTS are ACTIVE immediately.
    // RECRUITER, INTERVIEWER, HR_MANAGER start in PENDING state awaiting organizational review.
    const accountStatus: AccountStatus =
      validated.role === 'APPLICANT' ? 'ACTIVE' : 'PENDING';

    const newUser = await userRepository.create({
      id: userId,
      email,
      password_hash: passwordHash,
      role: validated.role,
      account_status: accountStatus,
      first_name: validated.firstName.trim(),
      last_name: validated.lastName.trim(),
      company_id: validated.companyId || null,
    });

    // Auto-create ApplicantProfile if applicant
    if (validated.role === 'APPLICANT') {
      await applicantProfileRepository.upsert({
        user_id: newUser.id,
      });
    }

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${generateSecureToken(4)}`,
      actor_id: newUser.id,
      action: 'USER_REGISTERED',
      entity_type: 'USER',
      entity_id: newUser.id,
      metadata_json: JSON.stringify({ role: newUser.role, account_status: accountStatus }),
    });

    const safeUser = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      accountStatus: newUser.account_status,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      companyId: newUser.company_id,
    };

    const message =
      accountStatus === 'ACTIVE'
        ? 'Account successfully registered.'
        : 'Access request submitted successfully. Your account is pending organizational authorization.';

    return { message, user: safeUser };
  }

  async login(data: unknown): Promise<AuthSessionResponse> {
    const validated = LoginInputSchema.parse(data);
    const email = normalizeEmail(validated.email);

    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Safe generic authentication error to prevent account enumeration
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const passwordValid = verifyPassword(validated.password, user.password_hash);
    if (!passwordValid) {
      await auditLogRepository.log({
        id: `audit-${Date.now().toString(36)}-${generateSecureToken(4)}`,
        actor_id: user.id,
        action: 'LOGIN_FAILED_WRONG_PASSWORD',
        entity_type: 'USER',
        entity_id: user.id,
        metadata_json: JSON.stringify({ email }),
      });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    // Role mismatch check: If client supplied expected role context, verify it
    if (validated.expectedRole && user.role !== validated.expectedRole) {
      await auditLogRepository.log({
        id: `audit-${Date.now().toString(36)}-${generateSecureToken(4)}`,
        actor_id: user.id,
        action: 'LOGIN_REJECTED_ROLE_MISMATCH',
        entity_type: 'USER',
        entity_id: user.id,
        metadata_json: JSON.stringify({ actualRole: user.role, expectedRole: validated.expectedRole }),
      });
      throw new AppError(
        401,
        'ROLE_MISMATCH',
        'These credentials are not registered for the selected role.'
      );
    }

    // Account Status Enforcement
    if (user.account_status === 'DEACTIVATED') {
      throw new AppError(
        403,
        'ACCOUNT_DEACTIVATED',
        'Your account has been deactivated. Please contact your system administrator.'
      );
    }

    if (user.account_status === 'PENDING') {
      throw new AppError(
        403,
        'ACCOUNT_PENDING_APPROVAL',
        'Your account registration is currently pending organizational authorization and binding.'
      );
    }

    // Issue Token Pair
    const accessToken = createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.account_status,
      companyId: user.company_id,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    const rawRefreshToken = generateSecureToken(32);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const expiresAtUtc = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

    await refreshTokenRepository.create({
      id: `rt-${Date.now().toString(36)}-${generateSecureToken(4)}`,
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at_utc: expiresAtUtc,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${generateSecureToken(4)}`,
      actor_id: user.id,
      action: 'LOGIN_SUCCESS',
      entity_type: 'USER',
      entity_id: user.id,
      metadata_json: JSON.stringify({ role: user.role }),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        accountStatus: user.account_status,
        firstName: user.first_name,
        lastName: user.last_name,
        companyId: user.company_id,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
    };
  }

  async refresh(refreshToken: string): Promise<AuthSessionResponse> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'No refresh token provided.');
    }

    const tokenHash = hashToken(refreshToken);
    const record = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!record || record.revoked_at_utc !== null) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or has been revoked.');
    }

    const expiresTime = new Date(record.expires_at_utc).getTime();
    if (Date.now() > expiresTime) {
      throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired. Please sign in again.');
    }

    const user = await userRepository.findById(record.user_id);
    if (!user || user.account_status !== 'ACTIVE') {
      throw new AppError(401, 'ACCOUNT_INACTIVE', 'Account is no longer active.');
    }

    // Token Rotation: Revoke old refresh token, generate new one
    const newRawRefreshToken = generateSecureToken(32);
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAtUtc = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

    const newRecord = await refreshTokenRepository.create({
      id: `rt-${Date.now().toString(36)}-${generateSecureToken(4)}`,
      user_id: user.id,
      token_hash: newRefreshTokenHash,
      expires_at_utc: newExpiresAtUtc,
    });

    await refreshTokenRepository.revoke(record.id, newRecord.id);

    const accessToken = createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.account_status,
      companyId: user.company_id,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        accountStatus: user.account_status,
        firstName: user.first_name,
        lastName: user.last_name,
        companyId: user.company_id,
      },
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 900,
    };
  }

  async logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const record = await refreshTokenRepository.findByTokenHash(tokenHash);
      if (record) {
        await refreshTokenRepository.revoke(record.id);
      }
    } else if (userId) {
      await refreshTokenRepository.revokeAllForUser(userId);
    }
  }

  async getMe(userId: string): Promise<AuthSessionResponse['user']> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.account_status,
      firstName: user.first_name,
      lastName: user.last_name,
      companyId: user.company_id,
    };
  }

  /**
   * Idempotently bootstraps the Administrator account if none exists.
   * Safe to call on every server startup without duplicate creation or leaking secrets.
   */
  async bootstrapAdmin(): Promise<void> {
    const adminEmail = normalizeEmail(config.adminBootstrapEmail);
    const existing = await userRepository.findByEmail(adminEmail);
    if (existing) {
      logger.info('Administrator bootstrap check: Admin account already exists');
      return;
    }

    logger.info('Bootstrapping system Administrator account...', { email: adminEmail });
    const passwordHash = hashPassword(config.adminBootstrapPassword);

    await userRepository.create({
      id: 'usr-admin-bootstrap-01',
      email: adminEmail,
      password_hash: passwordHash,
      role: 'ADMIN',
      account_status: 'ACTIVE',
      first_name: 'System',
      last_name: 'Administrator',
      company_id: null,
    });

    logger.info('System Administrator account successfully bootstrapped');
  }
}

export const authService = new AuthService();
