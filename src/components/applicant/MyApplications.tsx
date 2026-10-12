import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicationService } from '../../services/applicationService';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import {
  Briefcase,
  Calendar,
  Clock,
  Building2,
  MapPin,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  History,
  X,
  User,
  Sparkles,
} from 'lucide-react';
import type { ApplicationWithDetails, ApplicationStatus, ApplicationStatusHistoryItem } from '../../types';

interface MyApplicationsProps {
  onFindJobsClick?: () => void;
}

export function MyApplications({ onFindJobsClick }: MyApplicationsProps) {
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const {
    data: applications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['my-applications'],
    queryFn: applicationService.listMyApplications,
  });

  const {
    data: detailData,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ['application-detail', selectedApplicationId],
    queryFn: () =>
      selectedApplicationId
        ? applicationService.getApplicationDetails(selectedApplicationId)
        : Promise.reject('No ID'),
    enabled: Boolean(selectedApplicationId),
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'APPLIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" /> Under Review
          </span>
        );
      case 'SHORTLISTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" /> Shortlisted
          </span>
        );
      case 'INTERVIEW_SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Calendar className="w-3 h-3 text-indigo-600" /> Interview Scheduled
          </span>
        );
      case 'SELECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 className="w-3 h-3 text-teal-600" /> Candidate Selected
          </span>
        );
      case 'HIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Offer Extended / Hired
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
            <XCircle className="w-3 h-3 text-slate-500" /> Archived
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return <LoadingSpinner label="Loading your applications..." />;
  }

  if (error) {
    return <ErrorState title="Failed to load applications" error={error} />;
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="w-6 h-6" />}
        title="No Job Applications Submitted Yet"
        description="Explore open recruitment requisitions, review requirements, and apply with your uploaded resume documents."
        action={
          onFindJobsClick ? (
            <Button onClick={onFindJobsClick} className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
              Browse Open Jobs
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Submitted Applications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status updates and transparent recruitment pipeline stage history.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
          {applications.length} {applications.length === 1 ? 'Application' : 'Applications'} On File
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {applications.map((app) => (
          <Card key={app.id} className="p-5 hover:border-slate-300 transition-all shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  {getStatusBadge(app.status)}
                  <h3 className="text-base font-bold text-slate-900">{app.job_title}</h3>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {app.company_name}
                  </span>
                  <span>·</span>
                  <span className="text-slate-600">{app.department_name}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {app.job_location}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-2xs text-slate-500 flex-wrap pt-1">
                  <span className="flex items-center gap-1 text-slate-600">
                    <FileText className="w-3 h-3 text-slate-400" />
                    Resume: <strong className="font-medium text-slate-700">{app.resume_file_name}</strong>
                  </span>
                  <span>|</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Applied: {new Date(app.applied_at).toLocaleDateString()} at{' '}
                    {new Date(app.applied_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedApplicationId(app.id)}
                  className="cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  View History
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* --- APPLICATION DETAIL & AUDIT TIMELINE MODAL --- */}
      {selectedApplicationId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 animate-in fade-in duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-2xs font-semibold text-blue-600 uppercase tracking-wider">
                  Application Stage Tracking
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {detailData?.application.job_title || 'Application Details'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailData?.application.company_name} · {detailData?.application.department_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApplicationId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailLoading ? (
              <LoadingSpinner label="Loading application timeline..." />
            ) : detailError ? (
              <ErrorState title="Failed to load application history" error={detailError} />
            ) : detailData ? (
              <div className="space-y-6 text-xs">
                {/* Current Status Overview */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Current Recruitment Stage
                    </span>
                    <div className="mt-1">{getStatusBadge(detailData.application.status)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Application Submitted
                    </span>
                    <span className="font-semibold text-slate-700 text-xs">
                      {new Date(detailData.application.applied_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Cover Letter Section (if exists) */}
                {detailData.application.cover_letter && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Cover Letter / Note
                    </h4>
                    <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-line leading-relaxed">
                      {detailData.application.cover_letter}
                    </p>
                  </div>
                )}

                {/* Stage History Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    Official Status Transition Timeline
                  </h4>

                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {detailData.history.map((hist, index) => (
                      <div key={hist.id} className="relative pl-8 space-y-1">
                        <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">
                            {hist.from_status ? `${hist.from_status} → ${hist.to_status}` : hist.to_status}
                          </span>
                          <span className="text-2xs text-slate-400">
                            {new Date(hist.changed_at).toLocaleString()}
                          </span>
                        </div>
                        {hist.note && (
                          <p className="text-2xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                            "{hist.note}"
                          </p>
                        )}
                        <span className="text-[11px] text-slate-400 block">
                          Recorded by: {hist.actor_name || 'System / Candidate'} ({hist.actor_role || 'RECRUITER'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedApplicationId(null)}
                className="cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
