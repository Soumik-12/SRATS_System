import React from 'react';

export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({
  label = 'Loading...',
  size = 'md',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-3',
  };

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 p-6 text-slate-500"
    >
      <div
        className={`animate-spin rounded-full border-slate-200 border-t-indigo-600 ${sizeClasses[size]}`}
        aria-hidden="true"
      />
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
