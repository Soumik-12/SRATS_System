import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import type { ApiErrorPayload } from '../../types';

export interface ErrorStateProps {
  title?: string;
  error?: ApiErrorPayload | Error | null;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'System Error Encountered',
  error,
  onRetry,
}: ErrorStateProps) {
  const isApiError = error && 'traceId' in error;
  const traceId = isApiError ? (error as ApiErrorPayload).traceId : undefined;
  const errorCode = isApiError ? (error as ApiErrorPayload).error : undefined;
  const errorMessage = error instanceof Error ? error.message : (error as ApiErrorPayload)?.message || 'An unexpected error occurred.';

  return (
    <div
      role="alert"
      className="p-6 rounded-xl border border-rose-200 bg-rose-50/60 text-slate-900"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-rose-950">{title}</h4>
          <p className="text-xs text-rose-800 mt-1 leading-relaxed">{errorMessage}</p>

          {(traceId || errorCode) && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-rose-700 font-mono">
              {errorCode && <span>Error: {errorCode}</span>}
              {errorCode && traceId && <span aria-hidden="true">·</span>}
              {traceId && <span>Trace ID: {traceId}</span>}
            </div>
          )}

          {onRetry && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="bg-white border-rose-300 text-rose-800 hover:bg-rose-100"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Request
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
