import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { interviewService } from '../../services/interviewService';
import { FeedbackModal } from '../../components/interview/FeedbackModal';
import { AiInterviewQuestionsModal } from '../../components/interview/AiInterviewQuestionsModal';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { analyticsService } from '../../services/analyticsService';
import {
  UserCheck,
  ShieldCheck,
  Calendar,
  Clock,
  Video,
  MapPin,
  ExternalLink,
  Award,
  Star,
  CheckCircle2,
  RotateCcw,
  Ban,
  User,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { InterviewWithDetails, InterviewStatus } from '../../types';

export function InterviewerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'all'>('upcoming');
  const [selectedFeedbackInterview, setSelectedFeedbackInterview] = useState<InterviewWithDetails | null>(null);
  const [questionInterview, setQuestionInterview] = useState<InterviewWithDetails | null>(null);

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.listInterviews(),
  });

  const { data: analytics } = useQuery({
    queryKey: ['interviewer-analytics'],
    queryFn: analyticsService.getInterviewerAnalytics,
  });

  const nowTime = Date.now();

  const filteredInterviews = interviews.filter((item) => {
    const isCompletedOrCancelled = item.status === 'COMPLETED' || item.status === 'CANCELLED';
    if (activeTab === 'upcoming') {
      return !isCompletedOrCancelled;
    }
    if (activeTab === 'completed') {
      return item.status === 'COMPLETED';
    }
    return true;
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
            <CheckCircle2 className="w-3 h-3" /> Evaluation Completed
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
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Evaluator Portal: {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Technical & Domain Evaluation · Assigned Candidate Reviews
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          Explicit Assignment Scope
        </div>
      </div>

      {/* Real Assignment Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Upcoming Interviews
            </span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.upcomingInterviewsCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Assigned future sessions
          </p>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Feedback
            </span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.pendingFeedbackCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Awaiting evaluation scoring
          </p>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Reviews
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.completedEvaluationsCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Submitted evaluations
          </p>
        </Card>

        <Card className="p-5 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Conducted Total
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {analytics?.metrics.pastInterviewsCount ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Historical assigned interviews
          </p>
        </Card>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'upcoming'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Upcoming & Scheduled
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'completed'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Completed Reviews
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'all'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          All Assigned ({interviews.length})
        </button>
      </div>

      {/* Assigned Interviews List */}
      {isLoading ? (
        <Card className="p-12 text-center text-xs text-slate-400">Loading assigned evaluations...</Card>
      ) : filteredInterviews.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No interviews assigned"
          description={
            activeTab === 'upcoming'
              ? 'You have no pending evaluation interviews scheduled. When a recruiter assigns an interview to you, it will appear here.'
              : activeTab === 'completed'
              ? 'No completed evaluation records found.'
              : 'No interviews assigned to your account.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredInterviews.map((item) => (
            <Card key={item.id} className="p-6 hover:border-slate-300 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="space-y-3 flex-1">
                  {/* Status & Position */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getStatusBadge(item.status)}
                    <span className="text-xs font-semibold text-slate-400">·</span>
                    <span className="text-sm font-bold text-slate-900">{item.job_title}</span>
                    <span className="text-xs text-slate-500">
                      ({item.company_name} · {item.department_name})
                    </span>
                  </div>

                  {/* Candidate Details */}
                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <User className="w-4 h-4 text-purple-600" />
                      Candidate: {item.applicant_name}
                    </div>
                    {item.applicant_headline && (
                      <p className="text-xs text-slate-600 pl-6">{item.applicant_headline}</p>
                    )}
                    <p className="text-[11px] text-slate-400 pl-6">{item.applicant_email}</p>
                  </div>

                  {/* Time & Meeting Location */}
                  <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap pt-1">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      <Clock className="w-4 h-4 text-blue-600" />
                      {new Date(item.scheduled_at_utc).toLocaleString()} ({item.duration_minutes} min)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      UTC: {new Date(item.scheduled_at_utc).toISOString()}
                    </span>

                    {item.interview_type === 'ONLINE' ? (
                      <span className="flex items-center gap-1.5 text-blue-700 font-medium bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                        <Video className="w-3.5 h-3.5" />
                        Meeting Link:
                        {item.location_url ? (
                          <a
                            href={item.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline flex items-center gap-1 hover:text-blue-900 font-semibold"
                          >
                            Open Video Call <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                        <MapPin className="w-3.5 h-3.5" />
                        Location: {item.location_url || 'On-site'}
                      </span>
                    )}
                  </div>

                  {/* Scheduler Notes */}
                  {item.notes && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-700 block mb-1">
                        Recruiter Session Notes:
                      </span>
                      <p className="whitespace-pre-line text-[11px]">{item.notes}</p>
                    </div>
                  )}

                  {/* Completed Feedback Display */}
                  {item.feedback && (
                    <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <span className="text-xs font-semibold text-slate-700 mr-1">Your Rating:</span>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${
                                s <= item.feedback!.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-slate-800 ml-1">
                            {item.feedback.rating}/5
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-600 mr-1.5">Recommendation:</span>
                          <span className="font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-md">
                            {item.feedback.recommendation}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-800 whitespace-pre-line bg-white/80 p-3 rounded-lg border border-purple-100">
                        {item.feedback.notes}
                      </p>
                      <p className="text-[10px] text-slate-400 text-right">
                        Submitted: {new Date(item.feedback.submitted_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="shrink-0 pt-2 lg:pt-0 flex flex-col sm:flex-row gap-2 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuestionInterview(item)}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5 text-xs shadow-2xs"
                    title="Generate job-grounded evaluation questions"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    AI Questions
                  </Button>

                  {item.status !== 'CANCELLED' && !item.feedback && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedFeedbackInterview(item)}
                      className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 text-xs shadow-2xs"
                    >
                      <Award className="w-4 h-4" />
                      Submit Evaluation
                    </Button>
                  )}
                  {item.feedback && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                      Evaluation Submitted
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Feedback Submission Modal */}
      <FeedbackModal
        isOpen={Boolean(selectedFeedbackInterview)}
        onClose={() => setSelectedFeedbackInterview(null)}
        interview={selectedFeedbackInterview}
      />

      {/* AI Interview Question Intelligence Modal */}
      {questionInterview && (
        <AiInterviewQuestionsModal
          isOpen={Boolean(questionInterview)}
          onClose={() => setQuestionInterview(null)}
          jobId={questionInterview.job_id}
          jobTitle={questionInterview.job_title}
          interviewId={questionInterview.id}
          candidateName={questionInterview.applicant_name}
        />
      )}
    </div>
  );
}
