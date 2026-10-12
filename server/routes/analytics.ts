import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { authenticate } from '../security/authMiddleware.js';

export const analyticsRouter = Router();

// All analytics endpoints require active authentication
analyticsRouter.use(authenticate);

/**
 * GET /api/v1/analytics/applicant
 */
analyticsRouter.get('/applicant', async (req, res, next) => {
  try {
    const data = await analyticsService.getApplicantAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/recruiter
 */
analyticsRouter.get('/recruiter', async (req, res, next) => {
  try {
    const queryCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const data = await analyticsService.getRecruiterAnalytics(req.user!, queryCompanyId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/interviewer
 */
analyticsRouter.get('/interviewer', async (req, res, next) => {
  try {
    const data = await analyticsService.getInterviewerAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/hr
 */
analyticsRouter.get('/hr', async (req, res, next) => {
  try {
    const queryCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const data = await analyticsService.getHrAnalytics(req.user!, queryCompanyId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/admin
 */
analyticsRouter.get('/admin', async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
