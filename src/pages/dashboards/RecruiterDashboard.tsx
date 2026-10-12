import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { JobManagement } from '../../components/recruiter/JobManagement';
import { RecruiterKanbanPipeline } from '../../components/recruiter/RecruiterKanbanPipeline';
import { InterviewManagement } from '../../components/recruiter/InterviewManagement';
import { Card } from '../../components/ui/Card';
import { analyticsService } from '../../services/analyticsService';
import {
  Briefcase,
  Calendar,
  ShieldCheck,
  Users,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export function RecruiterDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'pipeline' | 'interviews'>('overview');

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['recruiter-analytics'],
    queryFn: analyticsService.getRecruiterAnalytics,
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Recruiter Workspace: {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Talent Acquisition · Role: {user?.role} · Status: {user?.accountStatus}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          Authorized Recruiter
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics & Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'jobs'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Requisitions & Jobs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'pipeline'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Candidate Pipeline (Kanban)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('interviews')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'interviews'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Interview Operations
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Requisitions
                </span>
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.activeJobsCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {analytics?.metrics.totalJobsCount ?? 0} total requisitions ({analytics?.metrics.draftJobsCount ?? 0} draft)
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Applicants
                </span>
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.totalApplicationsCount ?? 0}
              </p>
              <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-1.5">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                  {analytics?.metrics.appliedCount ?? 0} New
                </span>
                <span className="bg-amber-50 px-1.5 py-0.5 rounded text-amber-700">
                  {analytics?.metrics.shortlistedCount ?? 0} Shortlisted
                </span>
                <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">
                  {analytics?.metrics.hiredCount ?? 0} Hired
                </span>
              </div>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Upcoming Interviews
                </span>
                <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.upcomingInterviewsCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Scheduled technical evaluations
              </p>
            </Card>

            <Card className="p-5 border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pending Feedback
                </span>
                <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {analytics?.metrics.pendingFeedbackCount ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Past interviews awaiting scoring
              </p>
            </Card>
          </div>

          {/* Pipeline Funnel Breakdown */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Recruitment Pipeline Distribution
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Real-time candidate counts across active recruitment stages
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Applied', count: analytics?.metrics.appliedCount ?? 0, bg: 'bg-slate-50', text: 'text-slate-800' },
                { label: 'Shortlisted', count: analytics?.metrics.shortlistedCount ?? 0, bg: 'bg-amber-50', text: 'text-amber-800' },
                { label: 'Interviewing', count: analytics?.metrics.interviewScheduledCount ?? 0, bg: 'bg-blue-50', text: 'text-blue-800' },
                { label: 'Selected', count: analytics?.metrics.selectedCount ?? 0, bg: 'bg-indigo-50', text: 'text-indigo-800' },
                { label: 'Hired', count: analytics?.metrics.hiredCount ?? 0, bg: 'bg-emerald-50', text: 'text-emerald-800' },
                { label: 'Rejected', count: analytics?.metrics.rejectedCount ?? 0, bg: 'bg-rose-50', text: 'text-rose-800' },
              ].map((stage) => (
                <div key={stage.label} className={`p-4 rounded-xl border border-slate-200 ${stage.bg} text-center`}>
                  <p className="text-xs font-semibold text-slate-500">{stage.label}</p>
                  <p className={`text-2xl font-black mt-1 font-mono ${stage.text}`}>{stage.count}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Trends & Requisitions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 30-Day Activity Trends */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Application Velocity (Past 30 Days)</h3>
                  <p className="text-xs text-slate-500">Daily candidate submissions derived from audit timeline</p>
                </div>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              {analytics?.applicationTrends && analytics.applicationTrends.length > 0 ? (
                <div className="space-y-2">
                  {analytics.applicationTrends.map((trend) => (
                    <div key={trend.date} className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="font-mono text-slate-600">{trend.date}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 bg-blue-600 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(10, trend.count * 20))}px` }}
                        />
                        <span className="font-bold font-mono text-slate-900">{trend.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                  No submissions recorded in the last 30 days.
                </div>
              )}
            </Card>

            {/* Requisitions Nearing Deadline */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Requisitions Nearing Deadline</h3>
                  <p className="text-xs text-slate-500">Published openings closing within 14 days</p>
                </div>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              {analytics?.jobsNearingDeadline && analytics.jobsNearingDeadline.length > 0 ? (
                <div className="space-y-3">
                  {analytics.jobsNearingDeadline.map((job) => (
                    <div key={job.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{job.title}</p>
                        <p className="text-[11px] text-slate-500">
                          Deadline: {new Date(job.deadline_utc).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                        {job.application_count} applications
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                  No published requisitions nearing closure within the next 14 days.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && <JobManagement />}
      {activeTab === 'pipeline' && <RecruiterKanbanPipeline />}
      {activeTab === 'interviews' && <InterviewManagement />}
    </div>
  );
}
