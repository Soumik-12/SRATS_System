import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const url = req.originalUrl || req.url;

  // Only log API requests to prevent cluttering logs with Vite dev assets and internal files
  if (!url.startsWith('/api')) {
    return next();
  }

  const start = performance.now();

  res.on('finish', () => {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    logger.info('API Request processed', {
      traceId: req.traceId,
      method: req.method,
      path: url,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}
