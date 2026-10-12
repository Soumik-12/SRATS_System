import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/ui/Card';
import { analyticsService } from '../../services/analyticsService';
import {
  Building2,
  ShieldCheck,
  Briefcase,
  Users,
  Calendar,
  Award,
  TrendingUp,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';

export function HrDashboard() {
  const { user } = useAuth();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['hr-analytics'],
    queryFn: analyticsService.getHrAnalytics,
  });

  return (
    <div className="space-y-6">
      {/* Top Identity Banner */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              HR Leadership Console: {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organizational Oversight · Role: {user?.role} · Status: {user?.accountStatus}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          Organization Authorized
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Requisitions
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.totalJobsCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            {analytics?.metrics.activeJobsCount ?? 0} published · {analytics?.metrics.draftJobsCount ?? 0} draft
          </p>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Candidates
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.totalApplicationsCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Across all organizational openings
          </p>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Interviews Total
            </span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.totalInterviewsCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            {analytics?.metrics.interviewScheduledCount ?? 0} active candidate evaluations
          </p>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Candidates Hired
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.hiredCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            {analytics?.metrics.selectedCount ?? 0} offer / selection stage
          </p>
        </Card>
      </div>

      {/* Pipeline Funnel Distribution */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          Organization Talent Pipeline Funnel
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Real-time candidate progression from initial submission to hire
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Applied', count: analytics?.metrics.appliedCount ?? 0, bg: 'bg-slate-50', text: 'text-slate-800' },
            { label: 'Shortlisted', count: analytics?.metrics.shortlistedCount ?? 0, bg: 'bg-amber-50', text: 'text-amber-800' },
            { label: 'Interviewing', count: analytics?.metrics.interviewScheduledCount ?? 0, bg: 'bg-blue-50', text: 'text-blue-800' },
            { label: 'Selected', count: analytics?.metrics.selectedCount ?? 0, bg: 'bg-indigo-50', text: 'text-indigo-800' },
            { label: 'Hired', count: analytics?.metrics.hiredCount ?? 0, bg: 'bg-emerald-50', text: 'text-emerald-800' },
            { label: 'Archived', count: analytics?.metrics.rejectedCount ?? 0, bg: 'bg-rose-50', text: 'text-rose-800' },
          ].map((s) => (
            <div key={s.label} className={`p-4 rounded-xl border border-slate-200 ${s.bg} text-center`}>
              <p className="text-xs font-semibold text-slate-500">{s.label}</p>
              <p className={`text-2xl font-black mt-1 font-mono ${s.text}`}>{s.count}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Department Breakdown Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Department Recruitment Breakdown</h3>
            <p className="text-xs text-slate-500">Cross-department requisitions, applications, and conversions</p>
          </div>
          <FolderKanban className="w-4 h-4 text-slate-400" />
        </div>

        {analytics?.departmentMetrics && analytics.departmentMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Total Requisitions</th>
                  <th className="px-4 py-3">Active Openings</th>
                  <th className="px-4 py-3">Total Applicants</th>
                  <th className="px-4 py-3">Hired Candidates</th>
                  <th className="px-4 py-3">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.departmentMetrics.map((dept) => {
                  const rate = dept.application_count > 0
                    ? Math.round((dept.hired_count / dept.application_count) * 100)
                    : 0;
                  return (
                    <tr key={dept.department_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">{dept.department_name}</td>
                      <td className="px-4 py-3 font-mono">{dept.job_count}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700">
                          {dept.active_job_count} active
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{dept.application_count}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-700">{dept.hired_count}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
            No organization departments provisioned yet.
          </div>
        )}
      </Card>

      {/* 30-Day Hiring Velocity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hiring Velocity (Past 30 Days)</h3>
            <p className="text-xs text-slate-500">Daily submissions and hiring decisions across the organization</p>
          </div>
          <TrendingUp className="w-4 h-4 text-slate-400" />
        </div>

        {analytics?.hiringTrends && analytics.hiringTrends.length > 0 ? (
          <div className="space-y-2">
            {analytics.hiringTrends.map((trend) => (
              <div key={trend.date} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="font-mono text-slate-600 w-28">{trend.date}</span>
                <div className="flex-1 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Apps:</span>
                    <span className="font-bold font-mono text-slate-900">{trend.applications_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">Hired:</span>
                    <span className="font-bold font-mono text-emerald-700">{trend.hired_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
            No applications or hiring decisions recorded in the past 30 days.
          </div>
        )}
      </Card>
    </div>
  );
}
