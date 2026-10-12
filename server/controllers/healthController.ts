import type { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/healthService.js';

export async function getHealthHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const health = await healthService.getHealth();
    const httpStatus = health.status === 'UP' ? 200 : 503;
    res.status(httpStatus).json(health);
  } catch (err) {
    next(err);
  }
}
