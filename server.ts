import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createExpressApp } from './server/app.js';
import { config } from './server/config/env.js';
import { initDatabase, closeDatabase } from './server/db/connection.js';
import { runMigrations } from './server/db/migrator.js';
import { authService } from './server/services/authService.js';
import { logger } from './server/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(): Promise<http.Server> {
  logger.info('Initializing SRATS Full-Stack Server...', {
    env: config.env,
    port: config.port,
    host: config.host,
    databaseType: config.databaseType,
  });

  // 1. Initialize relational database connection
  initDatabase(config.databaseUrl);

  // 2. Execute database migrations deterministically
  try {
    const applied = runMigrations();
    logger.info('Database migrations completed', { newlyAppliedCount: applied.length });
  } catch (migError) {
    logger.error('Database migration failed during server startup', migError);
    process.exit(1);
  }

  // 3. Idempotently bootstrap system administrator
  try {
    await authService.bootstrapAdmin();
  } catch (adminError) {
    logger.error('Failed to bootstrap system administrator', adminError);
    process.exit(1);
  }

  // 4. Create Express app with standard middlewares and /api/v1 routes
  const app = createExpressApp();

  // 4. Attach Vite middlewares in development or static file serving in production
  const isProduction = config.env === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    // Mount Vite middlewares so frontend SPA is served directly on port 3000
    app.use(vite.middlewares);
    logger.info('Vite development middlewares attached to Express');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      const express = (await import('express')).default;
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
      logger.info('Serving production static assets from dist');
    } else {
      logger.warn('Production build dist folder not found. Run npm run build first.');
    }
  }

  // 5. Start HTTP server
  const server = http.createServer(app);

  server.listen(config.port, config.host, () => {
    logger.info(`SRATS server successfully listening at http://${config.host}:${config.port}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      closeDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

startServer().catch((err) => {
  logger.error('Fatal error during SRATS server startup', err);
  process.exit(1);
});
