import express, { type Express } from 'express';
import { correlationMiddleware } from './middleware/correlation.js';
import { requestLoggingMiddleware } from './middleware/logging.js';
import { configureCors } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiV1Router } from './routes/index.js';

export function createExpressApp(): Express {
  const app = express();

  // Basic security and body parsing
  app.disable('x-powered-by');
  app.use(configureCors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Request correlation & logging
  app.use(correlationMiddleware);
  app.use(requestLoggingMiddleware);

  // Mount API v1 Master Router
  app.use('/api/v1', apiV1Router);

  // Note: 404 handler for API routes
  app.use('/api/*', notFoundHandler);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
