import { Router } from 'express';
import { jobService } from '../services/domainServices.js';
import { analyticsService } from '../services/analyticsService.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';

export const recruiterRouter = Router();

// Protect all recruiter routes
recruiterRouter.use(authenticate, requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'));

/**
 * GET /api/v1/recruiter/jobs
 * List jobs for the recruiter's assigned organization.
 * Query param: status (optional: ALL | DRAFT | PUBLISHED | CLOSED)
 */
recruiterRouter.get('/jobs', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const jobs = await jobService.listRecruiterJobs(req.user!, status);
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/recruiter/company
 * Retrieve the company profile for the recruiter's organization.
 */
recruiterRouter.get('/company', async (req, res, next) => {
  try {
    const company = await jobService.getRecruiterCompany(req.user!);
    res.json({ company });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/recruiter/departments
 * List departments belonging to the recruiter's organization.
 */
recruiterRouter.get('/departments', async (req, res, next) => {
  try {
    const departments = await jobService.listRecruiterDepartments(req.user!);
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/recruiter/departments
 * Create a new department within the recruiter's organization.
 */
recruiterRouter.post('/departments', async (req, res, next) => {
  try {
    const { name } = req.body;
    const department = await jobService.createDepartment(req.user!, name);
    res.status(201).json({
      message: 'Department successfully created.',
      department,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/recruiter/setup-company
 * Setup or bind an organization profile if the recruiter account does not have one yet.
 */
recruiterRouter.post('/setup-company', async (req, res, next) => {
  try {
    const company = await jobService.setupCompany(req.user!, req.body);
    res.status(201).json({
      message: 'Company organization profile successfully initialized.',
      company,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/recruiter/analytics
 */
recruiterRouter.get('/analytics', async (req, res, next) => {
  try {
    const queryCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const data = await analyticsService.getRecruiterAnalytics(req.user!, queryCompanyId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
