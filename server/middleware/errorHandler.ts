import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import type { StandardErrorResponse } from '../types/index.js';

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const envelope: StandardErrorResponse = {
    timestamp: new Date().toISOString(),
    status: 404,
    error: 'NOT_FOUND',
    message: `Resource not found at path: ${req.originalUrl || req.url}`,
    path: req.originalUrl || req.url,
    traceId: req.traceId || 'unknown',
  };
  res.status(404).json(envelope);
}

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let status = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An internal server error occurred. Please contact system administrator.';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    status = err.status;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.issues.map((e) => `${e.path.join('.') || 'field'}: ${e.message}`).join('; ');
    details = err.issues;
  }

  const traceId = req.traceId || 'unknown';

  // Log error with correlation trace ID (without exposing sensitive internals to client)
  if (status === 503 || status === 429) {
    logger.warn('Service temporarily unavailable or rate limited', {
      traceId,
      path: req.originalUrl || req.url,
      method: req.method,
      status,
      errorCode,
      message,
    });
  } else if (status >= 500) {
    logger.error('Unhandled server error', err, {
      traceId,
      path: req.originalUrl || req.url,
      method: req.method,
      status,
    });
  } else if (status === 401 || status === 403) {
    logger.info('Authentication or authorization rejection', {
      traceId,
      path: req.originalUrl || req.url,
      method: req.method,
      status,
      errorCode,
      message,
    });
  } else {
    logger.warn('Client request rejected', {
      traceId,
      path: req.originalUrl || req.url,
      method: req.method,
      status,
      errorCode,
      message,
    });
  }

  const envelope = {
    timestamp: new Date().toISOString(),
    status,
    error: errorCode,
    code: errorCode,
    message,
    path: req.originalUrl || req.url,
    traceId,
    details,
  };

  res.status(status).json(envelope);
};
