import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingTraceId = req.headers['x-trace-id'] || req.headers['x-request-id'];

  let traceId: string;
  if (typeof incomingTraceId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingTraceId)) {
    traceId = incomingTraceId;
  } else {
    traceId = `srats-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  }

  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
}
