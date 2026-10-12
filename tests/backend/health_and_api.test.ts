import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createExpressApp } from '../../server/app.js';
import { initDatabase, closeDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import type { HealthResponse, StandardErrorResponse } from '../../server/types/index.js';

describe('API Foundation, Health & Error Envelope Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    initDatabase(':memory:');
    runMigrations();

    const app = createExpressApp();
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  });

  test('1. GET /api/v1/health returns 200 with honest UP status and latency', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    assert.strictEqual(res.status, 200);

    const body = (await res.json()) as HealthResponse;
    assert.strictEqual(body.status, 'UP');
    assert.strictEqual(body.service, 'SRATS');
    assert.strictEqual(body.database, 'UP');
    assert.strictEqual(typeof body.uptimeSeconds, 'number');
    assert.strictEqual(typeof body.checks.database.latencyMs, 'number');
    assert.ok((body.checks.database.latencyMs ?? 0) >= 0);
  });

  test('2. Response headers include correlation trace ID (X-Trace-Id)', async () => {
    const clientTraceId = 'client-custom-trace-12345';
    const res = await fetch(`${baseUrl}/api/v1/health`, {
      headers: {
        'X-Trace-Id': clientTraceId,
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-trace-id'), clientTraceId);
  });

  test('3. Invalid API route returns 404 with standard SRATS error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/v1/non-existent-endpoint-test`);
    assert.strictEqual(res.status, 404);

    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.status, 404);
    assert.strictEqual(body.error, 'NOT_FOUND');
    assert.ok(body.message.includes('/api/v1/non-existent-endpoint-test'));
    assert.ok(body.timestamp);
    assert.ok(body.traceId);
  });

  test('4. Controlled API error returns 400 with standard error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/v1/test/error`);
    assert.strictEqual(res.status, 400);

    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.status, 400);
    assert.strictEqual(body.error, 'TEST_VALIDATION_ERROR');
    assert.ok(body.message.includes('Intentional test validation error'));
    assert.ok(body.traceId);
    assert.deepStrictEqual(body.details, { field: 'testParam' });
  });

  test('5. Unhandled server error returns 500 without leaking stack traces', async () => {
    const res = await fetch(`${baseUrl}/api/v1/test/server-error`);
    assert.strictEqual(res.status, 500);

    const body = (await res.json()) as StandardErrorResponse;
    assert.strictEqual(body.status, 500);
    assert.strictEqual(body.error, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(
      body.message,
      'An internal server error occurred. Please contact system administrator.'
    );
    // Crucial security check: Ensure stack trace is NOT leaked to client
    assert.strictEqual('stack' in body, false);
  });
});
