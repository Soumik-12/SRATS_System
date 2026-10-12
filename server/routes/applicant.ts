import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import {
  getProfileHandler,
  updateProfileHandler,
  getSkillsHandler,
  addSkillHandler,
  removeSkillHandler,
  listResumesHandler,
  uploadResumeHandler,
  downloadResumeFileHandler,
  deleteResumeHandler,
} from '../controllers/applicantController.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';
import { analyticsService } from '../services/analyticsService.js';
import { AppError } from '../middleware/errorHandler.js';

export const applicantRouter = Router();

// Configure Multer for memory buffer storage and 5MB hard limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
});

function handleResumeUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(413, 'FILE_TOO_LARGE', 'Resume file exceeds maximum allowed size of 5 MB.'));
        }
        return next(new AppError(400, 'UPLOAD_ERROR', `File upload error: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
}

// All Applicant routes strictly require valid authentication and APPLICANT role
applicantRouter.use(authenticate, requireRole('APPLICANT'));

// Profile
applicantRouter.get('/profile', getProfileHandler);
applicantRouter.put('/profile', updateProfileHandler);

// Skills
applicantRouter.get('/skills', getSkillsHandler);
applicantRouter.post('/skills', addSkillHandler);
applicantRouter.delete('/skills/:id', removeSkillHandler);

// Resumes
applicantRouter.get('/resumes', listResumesHandler);
applicantRouter.post('/resumes', handleResumeUploadMiddleware, uploadResumeHandler);
applicantRouter.get('/resumes/:id/file', downloadResumeFileHandler);
applicantRouter.delete('/resumes/:id', deleteResumeHandler);

// Analytics
applicantRouter.get('/analytics', async (req, res, next) => {
  try {
    const data = await analyticsService.getApplicantAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
