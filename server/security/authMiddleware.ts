import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AccessTokenPayload } from '../types/index.js';
import type { UserRole } from '../domain/entities.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header with Bearer token');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Bearer token is empty');
  }

  const payload = verifyAccessToken(token);
  if (payload.accountStatus !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is not in active state');
  }

  req.user = payload;
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required prior to role verification');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Access denied. Role "${req.user.role}" is not authorized for this resource. Required roles: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}

export function requireOwnership(paramKey = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const targetUserId = req.params[paramKey] || req.body?.[paramKey];
    if (req.user.role === 'ADMIN') {
      return next(); // System admin bypass for administrative workflows
    }

    if (req.user.sub !== targetUserId) {
      throw new AppError(
        403,
        'FORBIDDEN_IDOR',
        'Object-level authorization denied. You do not have permission to access another user’s resource.'
      );
    }

    next();
  };
}

export function requireCompanyScope(paramKey = 'companyId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const targetCompanyId = req.params[paramKey] || req.query?.[paramKey] || req.body?.[paramKey];
    if (req.user.role === 'ADMIN') {
      return next(); // System admin bypass
    }

    if (!req.user.companyId || req.user.companyId !== targetCompanyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Company scope authorization denied. You cannot access data outside your assigned organization.'
      );
    }

    next();
  };
}
