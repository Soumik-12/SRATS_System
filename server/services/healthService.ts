import { getDatabase } from '../db/connection.js';
import type { HealthResponse } from '../types/index.js';

const SERVICE_START_TIME = Date.now();
const APP_VERSION = '1.0.0';

export class HealthService {
  async getHealth(): Promise<HealthResponse> {
    let dbStatus: 'UP' | 'DOWN' = 'DOWN';
    let dbLatencyMs: number | undefined;
    let dbError: string | undefined;

    try {
      const db = getDatabase();
      const pingResult = await db.ping();
      if (pingResult.ok) {
        dbStatus = 'UP';
        dbLatencyMs = pingResult.latencyMs;
      } else {
        dbStatus = 'DOWN';
        dbError = 'Database ping returned non-success';
      }
    } catch (err) {
      dbStatus = 'DOWN';
      dbError = err instanceof Error ? err.message : String(err);
    }

    const isSystemHealthy = dbStatus === 'UP';

    return {
      status: isSystemHealthy ? 'UP' : 'DOWN',
      service: 'SRATS',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptimeSeconds: Math.floor((Date.now() - SERVICE_START_TIME) / 1000),
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          error: dbError,
        },
      },
    };
  }
}

export const healthService = new HealthService();
