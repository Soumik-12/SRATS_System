import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.body?.refreshToken;
    const result = await authService.refresh(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.body?.refreshToken;
    const userId = req.user?.sub;
    await authService.logout(refreshToken, userId);
    res.status(200).json({ message: 'Successfully logged out.' });
  } catch (err) {
    next(err);
  }
}

export async function getMeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }
    const user = await authService.getMe(req.user.sub);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
