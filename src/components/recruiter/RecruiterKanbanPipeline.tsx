import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationService } from '../../services/applicationService';
import { jobService } from '../../services/jobService';
import { ScheduleInterviewModal } from '../interview/ScheduleInterviewModal';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import {
  Users,
  Briefcase,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  Search,
  ExternalLink,
  History,
  FileText,
  Building2,
  MapPin,
  X,
  Mail,
  Phone,
  User,
  AlertCircle,
  ChevronRight,
  Check,
} from 'lucide-react';
import type {
  ApplicationWithDetails,
  ApplicationStatus,
  ApplicationStatusHistoryItem,
  Job,
} from '../../types';

const PIPELINE_COLUMNS: {
  status: ApplicationStatus;
  title: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}[] = [
  {
    status: 'APPLIED',
    title: 'Applied',
    description: 'New candidate submissions',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    borderColor: 'border-blue-300',
  },
  {
    status: 'SHORTLISTED',
    title: 'Shortlisted',
    description: 'Screened & ready for interview',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderColor: 'border-purple-300',
  },
  {
    status: 'INTERVIEW_SCHEDULED',
    title: 'Interview Scheduled',
    description: 'Evaluator assessment pending',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    borderColor: 'border-indigo-300',
  },
  {
    status: 'SELECTED',
    title: 'Selected',
    description: 'Passed evaluation / Finalists',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    borderColor: 'border-teal-300',
  },
  {
    status: 'HIRED',
    title: 'Hired',
    description: 'Offer accepted & onboarding',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderColor: 'border-emerald-300',
  },
  {
    status: 'REJECTED',
    title: 'Archived / Rejected',
    description: 'Candidate declined / not selected',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    borderColor: 'border-slate-300',
  },
];

export function RecruiterKanbanPipeline() {
  const queryClient = useQueryClient();

  const [selectedJobId, setSelectedJobId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewAppId, setReviewAppId] = useState<string | null>(null);
  const [scheduleModalAppId, setScheduleModalAppId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Transition form state inside review modal
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus | ''>('');
  const [transitionNote, setTransitionNote] = useState('');

  // 1. Fetch Recruiter Jobs for Filter
  const { data: jobs = [] } = useQuery({
    queryKey: ['recruiter-jobs'],
    queryFn: () => jobService.listRecruiterJobs(),
  });

  // 2. Fetch Applications for Selected Job
  const {
    data: applications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['company-applications', selectedJobId],
    queryFn: () =>
      applicationService.listCompanyApplications(
        selectedJobId === 'ALL' ? undefined : selectedJobId,
        'ALL'
      ),
  });

  // 3. Fetch Single Application Details for Review Modal
  const {
    data: reviewData,
    isLoading: isReviewLoading,
    error: reviewError,
  } = useQuery({
    queryKey: ['application-detail', reviewAppId],
    queryFn: () => (reviewAppId ? applicationService.getApplicationDetails(reviewAppId) : Promise.reject('No ID')),
    enabled: Boolean(reviewAppId),
  });

  // Status Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: ApplicationStatus;
      note?: string;
    }) => {
      setActionError(null);
      return applicationService.updateApplicationStatus(id, {
        status,
        note: note?.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-applications'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-detail'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setTargetStatus('');
      setTransitionNote('');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to update candidate status.');
    },
  });

  // Filter applications by search term
  const filteredApps = applications.filter((app) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      app.applicant_name.toLowerCase().includes(term) ||
      app.applicant_email.toLowerCase().includes(term) ||
      app.job_title.toLowerCase().includes(term)
    );
  });

  // Helper for available transitions per state machine rules
  const getAvailableTransitions = (currentStatus: ApplicationStatus): ApplicationStatus[] => {
    switch (currentStatus) {
      case 'APPLIED':
        return ['SHORTLISTED', 'REJECTED'];
      case 'SHORTLISTED':
        return ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'];
      case 'INTERVIEW_SCHEDULED':
        return ['SELECTED', 'REJECTED'];
      case 'SELECTED':
        return ['HIRED'];
      case 'HIRED':
      case 'REJECTED':
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Requisition Filter & Candidate Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 py-1.5 px-3 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Requisitions ({jobs.length})</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Total Candidates in Pipeline: <strong className="text-slate-900">{filteredApps.length}</strong>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner label="Loading recruitment pipeline..." />
      ) : error ? (
        <ErrorState title="Failed to load pipeline applications" error={error} />
      ) : (
        /* Kanban Board Grid (6 columns) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {PIPELINE_COLUMNS.map((col) => {
            const colApps = filteredApps.filter((a) => a.status === col.status);
            return (
              <div
                key={col.status}
                className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {col.title}
                    </h3>
                    <p className="text-[10px] text-slate-400">{col.description}</p>
                  </div>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded ${col.badgeBg} ${col.badgeText}`}
                  >
                    {colApps.length}
                  </span>
                </div>

                {/* Candidate Cards in Column */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colApps.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-2xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      No candidates in this stage
                    </div>
                  ) : (
                    colApps.map((app) => (
                      <Card
                        key={app.id}
                        className={`p-3 bg-white hover:shadow-md transition-all border ${col.borderColor}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs font-bold text-slate-900 leading-tight">
                              {app.applicant_name}
                            </h4>
                          </div>

                          <div className="text-[11px] text-slate-500 font-medium truncate">
                            {app.job_title}
                          </div>

                          <div className="text-2xs text-slate-400">
                            {app.applicant_email}
                          </div>

                          {app.applicant_headline && (
                            <div className="text-2xs text-slate-600 bg-slate-50 p-1.5 rounded-md italic line-clamp-2">
                              "{app.applicant_headline}"
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{app.resume_file_name}</span>
                          </div>

                          <div className="text-[10px] text-slate-400">
                            Applied: {new Date(app.applied_at).toLocaleDateString()}
                          </div>

                          {/* Quick Stage Transition Actions */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                            {app.status === 'APPLIED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionMutation.mutate({
                                      id: app.id,
                                      status: 'SHORTLISTED',
                                      note: 'Candidate screened and shortlisted for technical review.',
                                    })
                                  }
                                  className="text-[10px] font-bold px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md cursor-pointer transition-colors"
                                >
                                  Shortlist
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionMutation.mutate({
                                      id: app.id,
                                      status: 'REJECTED',
                                      note: 'Qualifications do not match current role requisitions.',
                                    })
                                  }
                                  className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {app.status === 'SHORTLISTED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setScheduleModalAppId(app.id)}
                                  className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md cursor-pointer transition-colors flex items-center gap-1"
                                >
                                  <Calendar className="w-3 h-3" /> Schedule
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionMutation.mutate({
                                      id: app.id,
                                      status: 'SELECTED',
                                      note: 'Candidate advanced to selected stage.',
                                    })
                                  }
                                  className="text-[10px] font-bold px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-md cursor-pointer transition-colors"
                                >
                                  Select
                                </button>
                              </>
                            )}

                            {app.status === 'INTERVIEW_SCHEDULED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionMutation.mutate({
                                      id: app.id,
                                      status: 'SELECTED',
                                      note: 'Evaluation completed favorably; candidate selected.',
                                    })
                                  }
                                  className="text-[10px] font-bold px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-md cursor-pointer transition-colors"
                                >
                                  Select
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    transitionMutation.mutate({
                                      id: app.id,
                                      status: 'REJECTED',
                                      note: 'Evaluation did not meet current role benchmark.',
                                    })
                                  }
                                  className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {app.status === 'SELECTED' && (
                              <button
                                type="button"
                                onClick={() =>
                                  transitionMutation.mutate({
                                    id: app.id,
                                    status: 'HIRED',
                                    note: 'Official offer extended and accepted by candidate.',
                                  })
                                }
                                className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Hire
                              </button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReviewAppId(app.id);
                                setTargetStatus('');
                                setTransitionNote('');
                              }}
                              className="text-[10px] text-slate-500 hover:text-slate-800 p-1 h-auto ml-auto cursor-pointer"
                            >
                              Review
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- CANDIDATE REVIEW & STAGE GATE MODAL --- */}
      {reviewAppId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-2xs font-semibold text-blue-600 uppercase tracking-wider">
                  Candidate Dossier & Audit History
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {reviewData?.application.applicant_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Applied for: <strong className="text-slate-700">{reviewData?.application.job_title}</strong> ·{' '}
                  {reviewData?.application.department_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewAppId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isReviewLoading ? (
              <LoadingSpinner label="Loading candidate dossier..." />
            ) : reviewError ? (
              <ErrorState title="Failed to load dossier" error={reviewError} />
            ) : reviewData ? (
              <div className="space-y-6 text-xs text-slate-700 max-h-[70vh] overflow-y-auto pr-1">
                {/* Candidate Overview Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                      Contact Information
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-800">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {reviewData.application.applicant_email}
                    </div>
                    {reviewData.application.applicant_phone && (
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {reviewData.application.applicant_phone}
                      </div>
                    )}
                    {reviewData.application.applicant_location && (
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {reviewData.application.applicant_location}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                      Recruitment Stage & Documents
                    </span>
                    <div>
                      Current Status: <strong className="text-blue-700 font-bold">{reviewData.application.status}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-800 pt-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{reviewData.application.resume_file_name}</span>
                      <span className="text-slate-400 text-2xs">
                        ({(reviewData.application.resume_file_size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Candidate Cover Letter (if exists) */}
                {reviewData.application.cover_letter && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Cover Letter / Statement
                    </h4>
                    <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-line leading-relaxed">
                      {reviewData.application.cover_letter}
                    </p>
                  </div>
                )}

                {/* Stage Transition Control Form */}
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    Transition Recruitment Stage
                  </h4>

                  {getAvailableTransitions(reviewData.application.status).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Candidate has reached a terminal stage ({reviewData.application.status}). Stage cannot be mutated.
                    </p>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (targetStatus) {
                          transitionMutation.mutate({
                            id: reviewData.application.id,
                            status: targetStatus,
                            note: transitionNote,
                          });
                        }
                      }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            New Target Stage <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={targetStatus}
                            onChange={(e) => setTargetStatus(e.target.value as ApplicationStatus)}
                            className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                          >
                            <option value="">Select allowed stage...</option>
                            {getAvailableTransitions(reviewData.application.status).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Audit Note / Justification
                          </label>
                          <input
                            type="text"
                            placeholder="Reason for stage change..."
                            value={transitionNote}
                            onChange={(e) => setTransitionNote(e.target.value)}
                            maxLength={500}
                            className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {reviewData.application.status === 'SHORTLISTED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setScheduleModalAppId(reviewData.application.id);
                              setReviewAppId(null);
                            }}
                            className="cursor-pointer text-xs flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            Schedule Interview Round
                          </Button>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!targetStatus || transitionMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer ml-auto"
                        >
                          {transitionMutation.isPending ? 'Updating Stage...' : 'Execute Transition'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Status Transition Audit Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    Stage Audit Trail
                  </h4>

                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {reviewData.history.map((hist) => (
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
                          Recorded by: {hist.actor_name || 'System / Recruiter'} ({hist.actor_role || 'RECRUITER'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setReviewAppId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal Integration */}
      {scheduleModalAppId && (
        <ScheduleInterviewModal
          isOpen={Boolean(scheduleModalAppId)}
          onClose={() => setScheduleModalAppId(null)}
          defaultApplicationId={scheduleModalAppId}
        />
      )}
    </div>
  );
}
