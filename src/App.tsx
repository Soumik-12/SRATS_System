import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { HealthPage } from './pages/HealthPage';
import { AuthPage } from './pages/AuthPage';
import { ApplicantDashboard } from './pages/dashboards/ApplicantDashboard';
import { RecruiterDashboard } from './pages/dashboards/RecruiterDashboard';
import { InterviewerDashboard } from './pages/dashboards/InterviewerDashboard';
import { HrDashboard } from './pages/dashboards/HrDashboard';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/auth" element={<AuthPage />} />

              {/* Five Protected Role Workspaces */}
              <Route
                path="/applicant/*"
                element={
                  <ProtectedRoute allowedRoles={['APPLICANT']}>
                    <ApplicantDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recruiter/*"
                element={
                  <ProtectedRoute allowedRoles={['RECRUITER']}>
                    <RecruiterDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interviewer/*"
                element={
                  <ProtectedRoute allowedRoles={['INTERVIEWER']}>
                    <InterviewerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/*"
                element={
                  <ProtectedRoute allowedRoles={['HR_MANAGER']}>
                    <HrDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all 404 Route */}
              <Route
                path="*"
                element={
                  <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
                    <h2 className="text-lg font-bold text-slate-800">Page Not Found</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      The requested URL path does not exist.
                    </p>
                  </div>
                }
              />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
