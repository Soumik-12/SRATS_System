import type { Request, Response, NextFunction } from 'express';
import { applicantService } from '../services/applicantService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const profile = await applicantService.getProfile(userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const profile = await applicantService.updateProfile(userId, req.body);
    res.json({ message: 'Profile updated successfully', profile });
  } catch (err) {
    next(err);
  }
}

export async function getSkillsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const skills = await applicantService.getSkills(userId);
    res.json({ skills });
  } catch (err) {
    next(err);
  }
}

export async function addSkillHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const skill = await applicantService.addSkill(userId, req.body);
    res.status(201).json({ message: 'Skill added successfully', skill });
  } catch (err) {
    next(err);
  }
}

export async function removeSkillHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const skillId = req.params.id;
    const result = await applicantService.removeSkill(userId, skillId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listResumesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const resumes = await applicantService.listResumes(userId);
    res.json({ resumes });
  } catch (err) {
    next(err);
  }
}

export async function uploadResumeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    if (!req.file) {
      throw new AppError(400, 'NO_FILE_UPLOADED', 'No resume file attached to the request.');
    }

    const resume = await applicantService.uploadResume(userId, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    });

    res.status(201).json({ message: 'Resume uploaded successfully', resume });
  } catch (err) {
    next(err);
  }
}

export async function downloadResumeFileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const resumeId = req.params.id;
    const fileData = await applicantService.downloadResumeFile(userId, resumeId);

    // Prevent response splitting and format safe filename for header
    const sanitizedFileName = fileData.fileName.replace(/["\r\n\\]/g, '_');

    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader('Content-Length', fileData.buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedFileName}"`);
    // Security: never cache sensitive resume binaries publicly
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.send(fileData.buffer);
  } catch (err) {
    next(err);
  }
}

export async function deleteResumeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const userId = req.user.sub;
    const resumeId = req.params.id;
    const result = await applicantService.deleteResume(userId, resumeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
