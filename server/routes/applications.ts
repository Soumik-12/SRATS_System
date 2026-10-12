import { Router } from 'express';
import { applicationService } from '../services/domainServices.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';

export const applicationsRouter = Router();

// Protect all application endpoints
applicationsRouter.use(authenticate);

/**
 * POST /api/v1/applications
 * Candidate submits application to a published job requisition.
 * Requires APPLICANT role.
 */
applicationsRouter.post('/', requireRole('APPLICANT'), async (req, res, next) => {
  try {
    const application = await applicationService.applyForJob(req.user!, req.body);
    res.status(201).json({
      message: 'Application successfully submitted.',
      application,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/applications/my
 * Candidate lists their own submitted applications with full details.
 * Requires APPLICANT role.
 */
applicationsRouter.get('/my', requireRole('APPLICANT'), async (req, res, next) => {
  try {
    const applications = await applicationService.listApplicantApplications(req.user!);
    res.json({ applications });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/applications
 * Recruiter / HR / Admin lists applications for their company pipeline.
 * Optional query parameters: jobId, status
 */
applicationsRouter.get(
  '/',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const applications = await applicationService.listCompanyApplications(
        req.user!,
        jobId,
        status
      );
      res.json({ applications });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/applications/:id
 * Retrieve application details and full audit/status history.
 * Authorized for candidate owner, assigned recruiter/HR, assigned interviewer, and admin.
 */
applicationsRouter.get('/:id', async (req, res, next) => {
  try {
    const details = await applicationService.getApplicationDetails(req.user!, req.params.id);
    res.json(details);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/applications/:id/status
 * Transition candidate application status (Kanban movement / stage gate).
 * Requires RECRUITER, HR_MANAGER, or ADMIN role.
 * Cross-company IDOR protected.
 */
applicationsRouter.put(
  '/:id/status',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { status, note } = req.body;
      const updated = await applicationService.transitionStatus(
        req.user!,
        req.params.id,
        status,
        note
      );
      res.json({
        message: 'Application status successfully updated.',
        application: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);
