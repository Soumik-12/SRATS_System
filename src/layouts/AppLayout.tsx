import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, BarChart2, ChevronDown, LogIn, LogOut } from 'lucide-react';
import { healthService } from '../services/healthService';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { SratsLogo } from '../components/ui/SratsLogo';
import { CustomCursor } from '../components/ui/CustomCursor';
import { NotificationCenter } from '../components/notification/NotificationCenter';
import { RoleAwareAssistantDrawer } from '../components/ai/RoleAwareAssistantDrawer';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: health, isError, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: healthService.checkHealth,
    refetchInterval: 15000,
  });

  const getRoleDashboardPath = (role: string) => {
    switch (role) {
      case 'APPLICANT':
        return '/applicant';
      case 'RECRUITER':
        return '/recruiter';
      case 'INTERVIEWER':
        return '/interviewer';
      case 'HR_MANAGER':
        return '/hr';
      case 'ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  const isHomePage = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Custom Desktop Cursor (Fine Pointer only) */}
      <CustomCursor />

      {/* Skip to Main Content Link for WCAG AA keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-xs font-semibold"
      >
        Skip to main content
      </a>

      {/* Floating Header Card with entrance animation & scroll elevation */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-40 bg-white/60 backdrop-blur-md pt-3 sm:pt-4 pb-2 px-4 sm:px-6 lg:px-8 transition-colors duration-200"
      >
        <div
          className={`max-w-7xl mx-auto rounded-2xl px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all duration-300 ease-out ${
            isScrolled
              ? 'bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.06)]'
              : 'bg-white border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)]'
          }`}
        >
          {/* Branding */}
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg p-1 -m-1 shrink-0"
          >
            <SratsLogo className="w-8 h-8 sm:w-9 sm:h-9 transition-transform group-hover:scale-105 duration-200 shrink-0" />
            <div>
              <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none block">
                SRATS
              </span>
              <span className="hidden sm:block text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
                Smart Recruitment & Applicant Tracking System
              </span>
            </div>
          </Link>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            {/* Nav Links */}
            <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium">
              <Link
                to="/"
                className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  location.pathname === '/'
                    ? 'bg-indigo-50/90 text-indigo-600 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Overview</span>
              </Link>
              <Link
                to="/health"
                className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  location.pathname === '/health'
                    ? 'bg-indigo-50/90 text-indigo-600 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Health</span>
              </Link>
              {isAuthenticated && user && (
                <Link
                  to={getRoleDashboardPath(user.role)}
                  className={`transition-colors text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap ${
                    location.pathname.startsWith(getRoleDashboardPath(user.role))
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  My Workspace ({user.role})
                </Link>
              )}
            </nav>

            {/* Vertical Divider */}
            <div className="hidden sm:block h-4 w-px bg-slate-200" aria-hidden="true" />

            {/* Verified Live Health Indicator with Chevron */}
            <div
              className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-700 select-none cursor-default"
              title={`Status: ${health?.status || (isLoading ? 'Checking...' : 'Disconnected')}`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isLoading
                    ? 'bg-amber-400 animate-pulse'
                    : isError || health?.status !== 'UP'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              <span>
                {isLoading
                  ? 'Connecting...'
                  : isError || health?.status !== 'UP'
                  ? 'System Offline'
                  : 'System Online'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Action / Auth Button */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-200 sm:border-0 sm:pl-0">
                <NotificationCenter />
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-900 leading-tight">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] text-slate-500">{user.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  className="text-slate-500 hover:text-slate-800"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">Exit</span>
                </Button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-full shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </motion.header>

      {/* Main Content Workspace */}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          isHomePage
            ? 'flex-1 w-full focus:outline-hidden'
            : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-hidden'
        }
      >
        {children}
      </main>

      {/* Product Footer (Clean, no redundant sign in button) */}
      <footer className="border-t border-slate-100 bg-white mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <SratsLogo className="w-7 h-7" size={28} />
            <div>
              <span className="text-sm font-black text-slate-900 tracking-tight leading-none block">
                SRATS
              </span>
              <span className="text-[10px] text-slate-500 font-normal leading-tight block mt-0.5">
                Smart Recruitment & Applicant Tracking System
              </span>
            </div>
          </div>

          {/* Center Copy */}
          <p className="text-xs text-slate-500 text-center max-w-md">
            A unified, role-aware platform to streamline recruitment, simplify collaboration, and support better hiring decisions.
          </p>

          {/* Right Links (No redundant sign-in button) */}
          <div className="flex items-center gap-6 text-xs font-medium text-slate-600">
            <Link to="/" className="hover:text-slate-900 transition-colors">
              Overview
            </Link>
            <Link to="/health" className="hover:text-slate-900 transition-colors">
              Health
            </Link>
          </div>
        </div>
      </footer>

      {/* Global Role-Aware AI Assistant Drawer */}
      <RoleAwareAssistantDrawer />
    </div>
  );
}
