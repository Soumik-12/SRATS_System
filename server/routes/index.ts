import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { applicantRouter } from './applicant.js';
import { jobsRouter } from './jobs.js';
import { recruiterRouter } from './recruiter.js';
import { interviewsRouter } from './interviews.js';
import { applicationsRouter } from './applications.js';
import { notificationsRouter } from './notifications.js';
import { analyticsRouter } from './analytics.js';
import { adminRouter } from './admin.js';
import { aiRouter } from './ai.js';
import { analyticsService } from '../services/analyticsService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  authenticate,
  requireRole,
  requireOwnership,
  requireCompanyScope,
} from '../security/authMiddleware.js';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/applicant', applicantRouter);
apiV1Router.use('/jobs', jobsRouter);
apiV1Router.use('/recruiter', recruiterRouter);
apiV1Router.use('/applications', applicationsRouter);
apiV1Router.use('/interviews', interviewsRouter);
apiV1Router.use('/notifications', notificationsRouter);
apiV1Router.use('/analytics', analyticsRouter);
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/ai', aiRouter);

// Role Analytics Direct Aliases
apiV1Router.get('/interviewer/analytics', authenticate, async (req, res, next) => {
  try {
    const data = await analyticsService.getInterviewerAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

apiV1Router.get('/hr/analytics', authenticate, async (req, res, next) => {
  try {
    const queryCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const data = await analyticsService.getHrAnalytics(req.user!, queryCompanyId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

apiV1Router.get('/admin/analytics', authenticate, async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Development & Verification Protected Endpoints for Testing RBAC & IDOR Boundaries
apiV1Router.get('/test/auth/applicant-only', authenticate, requireRole('APPLICANT'), (req, res) => {
  res.json({ message: 'Authorized: Applicant access verified', user: req.user });
});

apiV1Router.get('/test/auth/recruiter-only', authenticate, requireRole('RECRUITER'), (req, res) => {
  res.json({ message: 'Authorized: Recruiter access verified', user: req.user });
});

apiV1Router.get('/test/auth/interviewer-only', authenticate, requireRole('INTERVIEWER'), (req, res) => {
  res.json({ message: 'Authorized: Interviewer access verified', user: req.user });
});

apiV1Router.get('/test/auth/hr-only', authenticate, requireRole('HR_MANAGER'), (req, res) => {
  res.json({ message: 'Authorized: HR Manager access verified', user: req.user });
});

apiV1Router.get('/test/auth/admin-only', authenticate, requireRole('ADMIN'), (req, res) => {
  res.json({ message: 'Authorized: Admin access verified', user: req.user });
});

apiV1Router.get(
  '/test/auth/user-profile/:userId',
  authenticate,
  requireOwnership('userId'),
  (req, res) => {
    res.json({ message: 'Authorized: Resource owner access verified', targetUserId: req.params.userId });
  }
);

apiV1Router.get(
  '/test/auth/company-data/:companyId',
  authenticate,
  requireCompanyScope('companyId'),
  (req, res) => {
    res.json({ message: 'Authorized: Company scope verified', companyId: req.params.companyId });
  }
);

// Foundation Error Verification Endpoints
if (process.env.NODE_ENV !== 'production') {
  apiV1Router.get('/test/error', (req, res, next) => {
    next(
      new AppError(
        400,
        'TEST_VALIDATION_ERROR',
        'Intentional test validation error for contract verification',
        { field: 'testParam' }
      )
    );
  });

  apiV1Router.get('/test/server-error', () => {
    throw new Error('Intentional unhandled server error for testing safety isolation');
  });
}
