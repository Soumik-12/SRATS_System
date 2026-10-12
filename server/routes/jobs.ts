import { Router } from 'express';
import { jobService } from '../services/domainServices.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';
import { verifyAccessToken } from '../security/jwt.js';

export const jobsRouter = Router();

/**
 * GET /api/v1/jobs
 * Public universal job discovery with search, filter, sort, and pagination.
 * Excludes DRAFT jobs server-side.
 */
jobsRouter.get('/', async (req, res, next) => {
  try {
    const {
      query,
      location,
      employment_type,
      experience_level,
      company_id,
      department_id,
      sort,
      page,
      size,
    } = req.query;

    const result = await jobService.searchPublicJobs({
      query: typeof query === 'string' ? query : undefined,
      location: typeof location === 'string' ? location : undefined,
      employment_type: typeof employment_type === 'string' ? employment_type : undefined,
      experience_level: typeof experience_level === 'string' ? experience_level : undefined,
      company_id: typeof company_id === 'string' ? company_id : undefined,
      department_id: typeof department_id === 'string' ? department_id : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/jobs/:id
 * Retrieve job details.
 * - Public / Applicant: Returns PublicJob projection (DRAFT jobs return 404).
 * - Authorized Recruiter / HR / Admin: Returns internal job details.
 */
jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7).trim();
        const payload = verifyAccessToken(token);
        if (payload.role !== 'APPLICANT') {
          const internalJob = await jobService.getInternalJob(payload, req.params.id);
          return res.json({ job: internalJob });
        }
      } catch {
        // Fall through to public retrieval if token invalid or expired
      }
    }

    const publicJob = await jobService.getPublicJob(req.params.id);
    res.json({ job: publicJob });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/jobs
 * Create a new job requisition. Defaults strictly to DRAFT.
 * Authorized for RECRUITER, HR_MANAGER, and ADMIN.
 */
jobsRouter.post(
  '/',
  authenticate,
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const created = await jobService.createRecruiterJob(req.user!, req.body);
      res.status(201).json({
        message: 'Job draft successfully created.',
        job: created,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/jobs/:id
 * Update job requisition according to lifecycle rules.
 * - DRAFT: fully editable.
 * - PUBLISHED: description, requirements, location, salary, deadline editable.
 * - CLOSED: immutable.
 */
jobsRouter.put(
  '/:id',
  authenticate,
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const updated = await jobService.updateJob(req.user!, req.params.id, req.body);
      res.json({
        message: 'Job successfully updated.',
        job: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST & PUT /api/v1/jobs/:id/publish
 * Transition job requisition from DRAFT to PUBLISHED.
 * Enforces server-side publication validation (valid future deadline, complete fields).
 */
const handlePublishJob = async (req: any, res: any, next: any) => {
  try {
    const published = await jobService.publishJob(req.user!, req.params.id, req.body);
    res.json({
      message: 'Job position has been successfully published.',
      job: published,
    });
  } catch (err) {
    next(err);
  }
};

jobsRouter.post(
  '/:id/publish',
  authenticate,
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  handlePublishJob
);

jobsRouter.put(
  '/:id/publish',
  authenticate,
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  handlePublishJob
);

/**
 * POST & PUT /api/v1/jobs/:id/close
 * Transition job requisition from PUBLISHED to CLOSED.
 * Closes position to new applications while preserving historical integrity.
 */
const handleCloseJob = async (req: any, res: any, next: any) => {
  try {
    const closed = await jobService.closeJob(req.user!, req.params.id);
    res.json({
      message: 'Job position has been successfully closed.',
      job: closed,
    });
  } catch (err) {
    next(err);
  }
};

jobsRouter.post(
  '/:id/close',
  authenticate,
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  handleCloseJob
);

jobsRouter.put(
  '/:id/close',
  authenticate,
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  handleCloseJob
);
