import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiService, type RecommendedJobItem } from '../../services/aiService';
import { applicationService } from '../../services/applicationService';
import { ApplyJobModal } from './ApplyJobModal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { EmptyState } from '../ui/EmptyState';
import {
  Sparkles,
  RefreshCw,
  Briefcase,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
} from 'lucide-react';
import type { PublicJob } from '../../types';

interface JobRecommendationsProps {
  onSwitchToAllJobs: () => void;
  onOpenJobDetail: (jobId: string) => void;
}

export function JobRecommendations({ onSwitchToAllJobs, onOpenJobDetail }: JobRecommendationsProps) {
  const queryClient = useQueryClient();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [applyModalJob, setApplyModalJob] = useState<PublicJob | null>(null);

  const { data: myApplications = [] } = useQuery({
    queryKey: ['my-applications'],
    queryFn: applicationService.listMyApplications,
  });

  const appliedJobIds = new Set(myApplications.map((app) => app.job_id));

  // Fetch cached recommendations
  const {
    data: recommendationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['job-recommendations'],
    queryFn: aiService.getJobRecommendations,
  });

  // Generate / Refresh Mutation
  const generateMutation = useMutation({
    mutationFn: (refresh: boolean) => aiService.generateJobRecommendations(true, refresh),
    onSuccess: (data) => {
      queryClient.setQueryData(['job-recommendations'], data);
    },
  });

  const handleGenerate = (refresh = false) => {
    generateMutation.mutate(refresh);
  };

  const isBusy = isLoading || generateMutation.isPending;
  const recommendations = recommendationsData?.recommendations || [];
  const hasGeneratedBefore = Boolean(recommendationsData && recommendationsData.modelUsed !== 'none');

  return (
    <div className="space-y-6">
      {/* Informative Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI-Assisted Job Recommendations</h1>
            <span className="text-2xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Advisory Match
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Grounded strictly in your confirmed skills and currently published positions. Recommendations are discovery suggestions only and do not restrict what you can explore or apply to.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasGeneratedBefore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(true)}
              isLoading={generateMutation.isPending}
              className="text-xs cursor-pointer border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh Matches
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onSwitchToAllJobs}
            className="text-xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 mr-1" />
            Find All Jobs
          </Button>
        </div>
      </div>

      {/* Advisory Notice Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">Non-Discriminatory & Grounded Discovery</p>
          <p className="text-blue-800 leading-relaxed">
            Every recommended position corresponds to an authentic, active requisition in the SRATS database. Evaluated purely on job-related skills and qualifications. You retain complete freedom to browse and apply for any opportunity.
          </p>
        </div>
      </div>

      {/* Content State Handling */}
      {isBusy ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-slate-200">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-medium text-slate-600">
            {generateMutation.isPending
              ? 'Analyzing confirmed profile skills against published requisitions...'
              : 'Loading recommended opportunities...'}
          </p>
        </div>
      ) : generateMutation.isError || isError ? (
        <Card className="p-8 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Recommendation Service Temporarily Unavailable</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              AI recommendation features are temporarily degraded, but normal job discovery and application workflows are completely functional.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(true)}
              className="text-xs"
            >
              Try Again
            </Button>
            <Button
              size="sm"
              onClick={onSwitchToAllJobs}
              className="text-xs bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Browse All Jobs Directly
            </Button>
          </div>
        </Card>
      ) : !hasGeneratedBefore ? (
        /* First-Time Consent & Generate Prompt */
        <Card className="p-8 text-center space-y-5 max-w-xl mx-auto border-indigo-100 bg-linear-to-b from-white to-indigo-50/30">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-900">Discover Opportunities Matched to Your Skills</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              SRATS can analyze published vacancies to suggest roles matching your confirmed profile qualifications. To generate suggestions, minimal job-related skills are processed using Google Gemini.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-left text-xs text-slate-700 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-2xs leading-normal text-slate-600">
                I understand that my confirmed skills and qualifications will be evaluated against active jobs using Google Gemini. No personal contact information or unconfirmed data is transmitted.
              </span>
            </label>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              size="sm"
              disabled={!consentAccepted}
              onClick={() => handleGenerate(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Generate My Recommendations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToAllJobs}
              className="text-xs cursor-pointer"
            >
              Browse All Jobs
            </Button>
          </div>
        </Card>
      ) : recommendations.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="w-6 h-6 text-slate-400" />}
          title="No Direct Skill Matches at this Time"
          description={
            recommendationsData?.overallSummary ||
            'None of the current published vacancies closely align with your confirmed skills. You can still explore and apply to all published jobs.'
          }
          action={
            <Button size="sm" onClick={onSwitchToAllJobs} className="text-xs bg-indigo-600 text-white">
              Browse All Published Jobs
            </Button>
          }
        />
      ) : (
        /* Render Grounded Recommendations List */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Found <strong className="text-slate-800">{recommendations.length}</strong> suggested positions
            </span>
            <span>
              Updated: {new Date(recommendationsData?.generatedAt || '').toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {recommendations.map((item) => {
              const job = item.job;
              const hasApplied = appliedJobIds.has(item.jobId);

              return (
                <div
                  key={item.jobId}
                  className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-300 transition-colors space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                          onClick={() => onOpenJobDetail(item.jobId)}
                        >
                          {job.title}
                        </h3>
                        <span className="text-2xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                          {item.relevanceScore}% Advisory Match
                        </span>
                        {hasApplied && (
                          <span className="text-2xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                            Applied
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {job.company_name || 'Organization'}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {job.location}
                        </span>
                        <span className="text-slate-500">
                          {job.employment_type?.replace('_', ' ')} · {job.experience_level}
                        </span>
                        {(job.salary_min || job.salary_max) && (
                          <span className="flex items-center gap-0.5 text-emerald-700 font-medium">
                            <DollarSign className="w-3.5 h-3.5" />
                            {job.salary_min ? `$${job.salary_min.toLocaleString()}` : ''}
                            {job.salary_min && job.salary_max ? ' - ' : ''}
                            {job.salary_max ? `$${job.salary_max.toLocaleString()}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenJobDetail(item.jobId)}
                        className="text-xs cursor-pointer"
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        disabled={hasApplied}
                        onClick={() => setApplyModalJob(job as any)}
                        className={`text-xs cursor-pointer ${
                          hasApplied
                            ? 'bg-slate-100 text-slate-400 border border-slate-200'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {hasApplied ? 'Applied' : 'Apply Now'}
                      </Button>
                    </div>
                  </div>

                  {/* Grounded Match Explanation Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {item.matchReason}
                    </p>

                    {item.matchedSkills.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-2xs font-semibold text-slate-500">Confirmed Skills:</span>
                        {item.matchedSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-2xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.missingSkills.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-2xs font-semibold text-slate-500">Unverified / Target Skills:</span>
                        {item.missingSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-2xs font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Apply Modal */}
      {applyModalJob && (
        <ApplyJobModal
          job={applyModalJob}
          isOpen={Boolean(applyModalJob)}
          onClose={() => setApplyModalJob(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['my-applications'] });
            setApplyModalJob(null);
          }}
        />
      )}
    </div>
  );
}
