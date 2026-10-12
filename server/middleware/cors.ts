import cors from 'cors';
import { config } from '../config/env.js';

export function configureCors() {
  const allowed = config.corsOrigins;

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps or curl) or if wildcard is set
      if (!origin || allowed.includes('*') || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not permitted by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Trace-Id'],
  });
}
