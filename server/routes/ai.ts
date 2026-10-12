import { Router } from 'express';
import { aiController } from '../controllers/aiController.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';

export const aiRouter = Router();

// Resume Analysis Routes (Strictly APPLICANT scoped)
aiRouter.post('/resume/analyze', authenticate, requireRole('APPLICANT'), (req, res, next) =>
  aiController.analyzeResume(req, res, next)
);

aiRouter.get('/resume/:resumeId', authenticate, requireRole('APPLICANT'), (req, res, next) =>
  aiController.getResumeAnalysis(req, res, next)
);

aiRouter.post('/resume/confirm', authenticate, requireRole('APPLICANT'), (req, res, next) =>
  aiController.confirmResumeAnalysis(req, res, next)
);

// Job Recommendations Routes (Strictly APPLICANT scoped)
aiRouter.post('/jobs/recommend', authenticate, requireRole('APPLICANT'), (req, res, next) =>
  aiController.recommendJobs(req, res, next)
);

aiRouter.get('/jobs/recommendations', authenticate, requireRole('APPLICANT'), (req, res, next) =>
  aiController.getJobRecommendations(req, res, next)
);

// Authorized Tool Execution Foundation (All authenticated roles checked per-tool)
aiRouter.post('/tools/execute', authenticate, (req, res, next) =>
  aiController.executeTool(req, res, next)
);

// Interview Question Suggestions (Evaluators, Recruiters, HR Managers, Admins)
aiRouter.post(
  '/interview/questions',
  authenticate,
  requireRole('INTERVIEWER', 'RECRUITER', 'HR_MANAGER', 'ADMIN'),
  (req, res, next) => aiController.generateInterviewQuestions(req, res, next)
);

// Role-Aware Conversational Assistant (All 5 Authenticated Roles)
aiRouter.post('/assistant/chat', authenticate, (req, res, next) =>
  aiController.chatAssistant(req, res, next)
);
