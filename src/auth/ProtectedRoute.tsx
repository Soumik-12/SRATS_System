import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { UserRole } from '../types';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner label="Validating authentication state..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-3 text-rose-700 mb-4">
          <div className="p-2.5 bg-rose-50 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">403 · Access Forbidden</h2>
            <p className="text-xs text-rose-700">Role-Based Access Control Restriction</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Your authenticated account holds the role{' '}
          <strong className="text-slate-900 font-semibold">{user.role}</strong>, but this
          workspace requires one of:{' '}
          <span className="font-mono text-xs text-slate-700">
            {allowedRoles.join(', ')}
          </span>.
        </p>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
          <Link
            to={
              user.role === 'APPLICANT'
                ? '/applicant'
                : user.role === 'RECRUITER'
                ? '/recruiter'
                : user.role === 'INTERVIEWER'
                ? '/interviewer'
                : user.role === 'HR_MANAGER'
                ? '/hr'
                : '/admin'
            }
          >
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Go to My Workspace
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-1.5 text-slate-500" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
