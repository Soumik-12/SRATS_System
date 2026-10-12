import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewService } from '../../services/interviewService';
import { ScheduleInterviewModal } from '../interview/ScheduleInterviewModal';
import { RescheduleInterviewModal } from '../interview/RescheduleInterviewModal';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Plus,
  AlertCircle,
  ExternalLink,
  Award,
  Star,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Ban,
  User,
  X,
} from 'lucide-react';
import type { InterviewWithDetails, InterviewStatus } from '../../types';

export function InterviewManagement() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<InterviewWithDetails | null>(null);
  const [viewFeedbackTarget, setViewFeedbackTarget] = useState<InterviewWithDetails | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InterviewWithDetails | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: interviews = [], isLoading, error } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.listInterviews(),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      setActionError(null);
      return interviewService.cancelInterview(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setCancelTarget(null);
      setCancelReason('');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to cancel interview.');
    },
  });

  const filteredInterviews = interviews.filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.status === statusFilter;
  });

  const getStatusBadge = (status: InterviewStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Calendar className="w-3 h-3" /> Scheduled
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <RotateCcw className="w-3 h-3" /> Rescheduled
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
            <Ban className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Interview Operations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Coordinate real candidate evaluations, interviewer assignments, and UTC schedules
            </p>
          </div>
          <Button size="sm" onClick={() => setIsScheduleOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Schedule Interview
          </Button>
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-100 pt-4 overflow-x-auto">
          {['ALL', 'SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Interviews' : st}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 font-medium">
            Showing {filteredInterviews.length} {filteredInterviews.length === 1 ? 'record' : 'records'}
          </span>
        </div>
      </Card>

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{actionError}</div>
        </div>
      )}

      {/* Interviews Listing */}
      {isLoading ? (
        <Card className="p-12 text-center text-xs text-slate-400">Loading interview records...</Card>
      ) : filteredInterviews.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No interviews found"
          description={
            statusFilter === 'ALL'
              ? 'No interviews have been scheduled yet for your organization. Click "Schedule Interview" to assign an evaluation session.'
              : `No interviews currently match status "${statusFilter}".`
          }
          action={
            <Button size="sm" onClick={() => setIsScheduleOpen(true)}>
              Schedule Interview
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredInterviews.map((item) => (
            <Card key={item.id} className="p-5 hover:border-slate-300 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getStatusBadge(item.status)}
                    <span className="text-xs font-semibold text-slate-400">·</span>
                    <span className="text-xs font-bold text-slate-900">{item.job_title}</span>
                    <span className="text-xs text-slate-500">({item.department_name})</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {item.applicant_name} ({item.applicant_email})
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="flex items-center gap-1.5 text-purple-700 font-medium">
                      Evaluator: {item.interviewer_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                    <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {new Date(item.scheduled_at_utc).toLocaleString()} ({item.duration_minutes} min)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      UTC: {new Date(item.scheduled_at_utc).toISOString()}
                    </span>

                    {item.interview_type === 'ONLINE' ? (
                      <span className="flex items-center gap-1.5 text-blue-700 font-medium bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100">
                        <Video className="w-3.5 h-3.5" />
                        Online:
                        {item.location_url ? (
                          <a
                            href={item.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline flex items-center gap-1 hover:text-blue-900"
                          >
                            Meeting Link <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          'Link pending'
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100">
                        <MapPin className="w-3.5 h-3.5" />
                        In-Person: {item.location_url || 'Location specified'}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2 font-mono whitespace-pre-line">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {item.feedback && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewFeedbackTarget(item)}
                      className="text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center gap-1.5"
                    >
                      <Award className="w-3.5 h-3.5" />
                      View Feedback
                    </Button>
                  )}

                  {(item.status === 'SCHEDULED' || item.status === 'RESCHEDULED') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRescheduleTarget(item)}
                        className="text-amber-700 border-amber-200 hover:bg-amber-50"
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTarget(item)}
                        className="text-rose-700 border-rose-200 hover:bg-rose-50"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Schedule Interview Modal */}
      <ScheduleInterviewModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
      />

      {/* Reschedule Interview Modal */}
      <RescheduleInterviewModal
        isOpen={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        interview={rescheduleTarget}
      />

      {/* Cancel Confirmation Dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <Ban className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cancel Interview</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to cancel the interview for{' '}
              <strong className="text-slate-900">{cancelTarget.applicant_name}</strong>? The record will remain preserved in the relational audit trail.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cancellation Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
                Go Back
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() =>
                  cancelMutation.mutate({
                    id: cancelTarget.id,
                    reason: cancelReason,
                  })
                }
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Feedback Modal */}
      {viewFeedbackTarget && viewFeedbackTarget.feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100/60 flex items-center justify-center text-purple-700">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Interview Evaluation</h3>
                  <p className="text-xs text-slate-500">
                    Candidate: {viewFeedbackTarget.applicant_name} · Position: {viewFeedbackTarget.job_title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewFeedbackTarget(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-purple-50/50 rounded-xl border border-purple-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Rating:</span>
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= viewFeedbackTarget.feedback!.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs font-bold text-slate-800">
                      {viewFeedbackTarget.feedback.rating}/5
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 mr-2">Recommendation:</span>
                  <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    {viewFeedbackTarget.feedback.recommendation}
                  </span>
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-700 block mb-1.5 uppercase tracking-wider text-[11px]">
                  Evaluator Assessment Notes:
                </span>
                <p className="text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-line leading-relaxed">
                  {viewFeedbackTarget.feedback.notes}
                </p>
              </div>
              <p className="text-[11px] text-slate-400">
                Submitted on {new Date(viewFeedbackTarget.feedback.submitted_at).toLocaleString()} by assigned evaluator {viewFeedbackTarget.interviewer_name}.
              </p>
            </div>
            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
              <Button variant="outline" size="sm" onClick={() => setViewFeedbackTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
