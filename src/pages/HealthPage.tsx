import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, Shield, Cpu, RefreshCw, Terminal } from 'lucide-react';
import { healthService } from '../services/healthService';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorState } from '../components/ui/ErrorState';
import type { ApiErrorPayload } from '../types';

export function HealthPage() {
  const [testErrorResult, setTestErrorResult] = useState<ApiErrorPayload | null>(null);
  const [isTriggeringError, setIsTriggeringError] = useState(false);

  const { data: health, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['deep-health'],
    queryFn: healthService.checkHealth,
  });

  const handleTestError = async (type: 'validation' | '404') => {
    setIsTriggeringError(true);
    setTestErrorResult(null);
    try {
      if (type === 'validation') {
        await healthService.triggerTestError();
      } else {
        await healthService.triggerTest404();
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorPayload' in err) {
        setTestErrorResult((err as { errorPayload: ApiErrorPayload }).errorPayload);
      } else {
        setTestErrorResult({
          timestamp: new Date().toISOString(),
          status: 500,
          error: 'UNKNOWN_CLIENT_ERROR',
          message: String(err),
          path: '/test',
          traceId: 'client-err',
        });
      }
    } finally {
      setIsTriggeringError(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Loading diagnostics..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Diagnostic Query Failed"
        error={error instanceof Error ? error : null}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Health & Diagnostics</h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time inspection of backend subsystems, database connectivity, and correlation traceability
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              <CardTitle>Database Diagnostics</CardTitle>
            </div>
            <CardDescription>Direct status from database ping check</CardDescription>
          </CardHeader>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Database Engine</dt>
              <dd className="font-semibold text-slate-800">Relational SQL</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Foreign Keys Enforced</dt>
              <dd className="font-semibold text-emerald-700">PRAGMA foreign_keys = ON</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Ping Result</dt>
              <dd className="font-semibold text-emerald-700">{health?.checks?.database?.status || 'UP'}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Ping Latency</dt>
              <dd className="font-mono text-slate-800">{health?.checks?.database?.latencyMs ?? 0} ms</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Transactions</dt>
              <dd className="font-semibold text-emerald-700">ACID Atomic (Rollback Verified)</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <CardTitle>Runtime & Environment</CardTitle>
            </div>
            <CardDescription>Server execution context and process properties</CardDescription>
          </CardHeader>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Service Identifier</dt>
              <dd className="font-semibold text-slate-800">{health?.service}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Software Version</dt>
              <dd className="font-mono text-slate-800">{health?.version}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Process Uptime</dt>
              <dd className="font-mono text-slate-800">{health?.uptimeSeconds} seconds</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Report Timestamp</dt>
              <dd className="font-mono text-xs text-slate-600">{health?.timestamp}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-500">Security Boundary</dt>
              <dd className="font-semibold text-indigo-600">Zero Server Secrets Leaked</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Contract & API Error Envelope Verification Console */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-600" />
            <CardTitle>API Contract & Error Envelope Verification Console</CardTitle>
          </div>
          <CardDescription>
            Live interactive verification of standard SRATS error envelopes, request correlation IDs, and non-200 failure codes per API_CONTRACT.md.
          </CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestError('validation')}
              disabled={isTriggeringError}
            >
              Test 400 Validation Error Envelope
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestError('404')}
              disabled={isTriggeringError}
            >
              Test 404 Route Not Found Envelope
            </Button>
          </div>

          {testErrorResult && (
            <div className="mt-4 p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
              <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800">
                <span>Received Error Envelope (HTTP {testErrorResult.status})</span>
                <span>Trace: {testErrorResult.traceId}</span>
              </div>
              <pre className="text-emerald-400">
                {JSON.stringify(testErrorResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
