import { Router } from 'express';
import { interviewService } from '../services/domainServices.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';

export const interviewsRouter = Router();

// Protect all interview endpoints with active JWT authentication
interviewsRouter.use(authenticate);

/**
 * GET /api/v1/interviews
 * List interviews scoped to the caller's role:
 * - APPLICANT: only own scheduled interviews (sanitized: no internal recruiter notes or feedback)
 * - INTERVIEWER: only explicitly assigned interviews
 * - RECRUITER / HR_MANAGER: company-scoped interviews
 * - ADMIN: system-wide interviews
 */
interviewsRouter.get('/', async (req, res, next) => {
  try {
    const interviews = await interviewService.listInterviews(req.user!);
    res.json({ interviews });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/interviews/interviewers
 * List active interviewers available for assignment.
 * Permitted for: RECRUITER, HR_MANAGER, ADMIN
 */
interviewsRouter.get(
  '/interviewers',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const interviewers = await interviewService.listAvailableInterviewers(req.user!);
      res.json({ interviewers });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/interviews/eligible-applications
 * List applications in SHORTLISTED or INTERVIEW_SCHEDULED status eligible for scheduling.
 * Permitted for: RECRUITER, HR_MANAGER, ADMIN
 */
interviewsRouter.get(
  '/eligible-applications',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const applications = await interviewService.listEligibleApplications(req.user!);
      res.json({ applications });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/interviews/:id
 * Retrieve single interview record by ID with role-based access control and sanitization.
 */
interviewsRouter.get('/:id', async (req, res, next) => {
  try {
    const interview = await interviewService.getInterviewById(req.user!, req.params.id);
    res.json({ interview });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/interviews
 * Schedule an interview for a candidate application.
 * Permitted for: RECRUITER, HR_MANAGER, ADMIN
 */
interviewsRouter.post(
  '/',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const interview = await interviewService.scheduleInterview(req.user!, req.body);
      res.status(201).json({
        message: 'Interview successfully scheduled.',
        interview,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/interviews/:id/reschedule
 * Reschedule an existing interview.
 * Permitted for: RECRUITER, HR_MANAGER, ADMIN
 */
interviewsRouter.post(
  '/:id/reschedule',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const interview = await interviewService.rescheduleInterview(req.user!, req.params.id, req.body);
      res.json({
        message: 'Interview successfully rescheduled.',
        interview,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/interviews/:id/cancel
 * Cancel an existing interview.
 * Permitted for: RECRUITER, HR_MANAGER, ADMIN
 */
interviewsRouter.post(
  '/:id/cancel',
  requireRole('RECRUITER', 'HR_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const interview = await interviewService.cancelInterview(req.user!, req.params.id, req.body?.reason);
      res.json({
        message: 'Interview successfully cancelled.',
        interview,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/interviews/:id/feedback
 * Submit evaluation rating and structured feedback.
 * Strictly permitted for the explicitly assigned INTERVIEWER (or ADMIN).
 */
interviewsRouter.post(
  '/:id/feedback',
  requireRole('INTERVIEWER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const feedback = await interviewService.submitFeedback(req.user!, req.params.id, req.body);
      res.status(201).json({
        message: 'Interview evaluation feedback successfully submitted.',
        feedback,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/interviews/:id/feedback
 * Retrieve submitted evaluation feedback for an interview.
 * Permitted for: Assigned INTERVIEWER, Company RECRUITER / HR_MANAGER, ADMIN.
 * Strictly 403 Forbidden for APPLICANT.
 */
interviewsRouter.get('/:id/feedback', async (req, res, next) => {
  try {
    const feedback = await interviewService.getInterviewFeedback(req.user!, req.params.id);
    res.json({ feedback });
  } catch (err) {
    next(err);
  }
});
