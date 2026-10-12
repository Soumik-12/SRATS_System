import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { 
  User, 
  Briefcase, 
  UserCheck, 
  Building2, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import type { UserRole } from '../types';

interface RoleOption {
  role: UserRole;
  label: string;
  badge: string;
  description: string;
  icon: React.ElementType;
}

const ROLES: RoleOption[] = [
  {
    role: 'APPLICANT',
    label: 'Applicant',
    badge: 'Candidate Portal',
    description: 'Explore published job listings, manage your resumes, and track application progress.',
    icon: User,
  },
  {
    role: 'RECRUITER',
    label: 'Recruiter',
    badge: 'Talent Acquisition',
    description: 'Create job postings, review applicants, manage the candidate pipeline, and schedule interviews.',
    icon: Briefcase,
  },
  {
    role: 'INTERVIEWER',
    label: 'Interviewer',
    badge: 'Evaluation Team',
    description: 'Review assigned candidates, access interview schedules, and submit structured scoring feedback.',
    icon: UserCheck,
  },
  {
    role: 'HR_MANAGER',
    label: 'HR Manager',
    badge: 'Organizational Oversight',
    description: 'Oversee department hiring, review complete organization pipelines, and examine hiring analytics.',
    icon: Building2,
  },
  {
    role: 'ADMIN',
    label: 'Administrator',
    badge: 'System Governance',
    description: 'System-level access control, user status governance, company management, and audit log inspection.',
    icon: ShieldCheck,
  },
];

export function AuthPage() {
  const { login, register, selectedRoleContext, setSelectedRoleContext, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to appropriate role dashboard
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const target =
        user.role === 'APPLICANT'
          ? '/applicant'
          : user.role === 'RECRUITER'
          ? '/recruiter'
          : user.role === 'INTERVIEWER'
          ? '/interviewer'
          : user.role === 'HR_MANAGER'
          ? '/hr'
          : '/admin';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Sync role from URL query param (e.g. /auth?role=RECRUITER)
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role')?.toUpperCase();
    if (roleParam) {
      const normalizedRole: UserRole | undefined =
        roleParam === 'HR' || roleParam === 'HR_MANAGER'
          ? 'HR_MANAGER'
          : roleParam === 'ADMINISTRATOR' || roleParam === 'ADMIN'
          ? 'ADMIN'
          : roleParam === 'RECRUITER'
          ? 'RECRUITER'
          : roleParam === 'INTERVIEWER'
          ? 'INTERVIEWER'
          : roleParam === 'APPLICANT'
          ? 'APPLICANT'
          : undefined;

      if (normalizedRole) {
        setSelectedRoleContext(normalizedRole);
        setErrorMessage(null);
        setSuccessMessage(null);
      }
    }
  }, [location.search, setSelectedRoleContext]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRoleContext(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (role === 'ADMIN' && activeTab === 'register') {
      setActiveTab('signin');
    }
    // Synchronize query parameter in URL
    navigate(`/auth?role=${role}`, { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const authedUser = await login(email, password, selectedRoleContext);
      const destination =
        authedUser.role === 'APPLICANT'
          ? '/applicant'
          : authedUser.role === 'RECRUITER'
          ? '/recruiter'
          : authedUser.role === 'INTERVIEWER'
          ? '/interviewer'
          : authedUser.role === 'HR_MANAGER'
          ? '/hr'
          : '/admin';

      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || destination;
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorPayload' in err) {
        const payload = (err as { errorPayload: { message: string } }).errorPayload;
        setErrorMessage(payload.message || 'Authentication failed');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        role: selectedRoleContext,
      });

      setSuccessMessage(res.message);
      if (selectedRoleContext === 'APPLICANT') {
        // Automatically attempt sign in for applicant
        await login(email, password, 'APPLICANT');
        navigate('/applicant');
      } else {
        // Pending state for privileged roles
        setActiveTab('signin');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorPayload' in err) {
        const payload = (err as { errorPayload: { message: string } }).errorPayload;
        setErrorMessage(payload.message || 'Registration failed');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Registration failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRoleOption = ROLES.find((r) => r.role === selectedRoleContext) || ROLES[0];
  const IconComponent = activeRoleOption.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Title & Introduction */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign In to SRATS
        </h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Smart Recruitment & Applicant Tracking System · Select your role context to access your dedicated operational workspace.
        </p>
      </div>

      {/* Step 1: Five-Role Selection Grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 text-center sm:text-left">
          Select how you are accessing SRATS:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ROLES.map((item) => {
            const ItemIcon = item.icon;
            const isSelected = selectedRoleContext === item.role;
            return (
              <button
                key={item.role}
                type="button"
                onClick={() => handleRoleSelect(item.role)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Authentication Form Container */}
      <div className="max-w-md mx-auto">
        <Card className="p-6">
          {/* Header with active role badge */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">{activeRoleOption.label} Access</h2>
                <p className="text-xs text-slate-500">{activeRoleOption.badge}</p>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                disabled={selectedRoleContext === 'ADMIN'}
                onClick={() => {
                  if (selectedRoleContext !== 'ADMIN') {
                    setActiveTab('register');
                    setErrorMessage(null);
                  }
                }}
                title={
                  selectedRoleContext === 'ADMIN'
                    ? 'Administrator registration is disabled'
                    : undefined
                }
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'register'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : selectedRoleContext === 'ADMIN'
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {selectedRoleContext === 'APPLICANT' ? 'Register' : 'Request Access'}
              </button>
            </div>
          </div>

          {/* Admin Registration Notice */}
          {selectedRoleContext === 'ADMIN' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                Public administrator registration is prohibited. Administrator credentials are provisioned securely through server-side bootstrap.
              </span>
            </div>
          )}

          {/* Recruiter / Interviewer / HR Pending Notice */}
          {activeTab === 'register' && selectedRoleContext !== 'APPLICANT' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
              <Building2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-700" />
              <span>
                New {activeRoleOption.label} accounts are registered in a <strong>PENDING</strong> state awaiting organizational authorization.
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Sign In Form */}
          {activeTab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isSubmitting}
              >
                Sign In as {activeRoleOption.label}
              </Button>
            </form>
          ) : (
            /* Registration / Request Access Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  autoComplete="given-name"
                />
                <Input
                  label="Last Name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
              <Input
                label="Password (min 8 chars)"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                autoComplete="new-password"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isSubmitting}
              >
                {selectedRoleContext === 'APPLICANT' ? 'Create Applicant Account' : `Request ${activeRoleOption.label} Access`}
              </Button>
            </form>
          )}

          {/* Default Demo Administrator hint for local evaluation */}
          {selectedRoleContext === 'ADMIN' && (
            <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">System Administrator Bootstrap Credentials:</p>
              <p>Email: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">admin@srats.system</code></p>
              <p>Password: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">SratsAdminSecure2026!</code></p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
