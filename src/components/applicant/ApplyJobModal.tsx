import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicantService } from '../../services/applicantService';
import { applicationService } from '../../services/applicationService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import {
  FileText,
  Send,
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Briefcase,
  Building2,
} from 'lucide-react';
import type { PublicJob } from '../../types';

interface ApplyJobModalProps {
  job: PublicJob;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ApplyJobModal({ job, isOpen, onClose, onSuccess }: ApplyJobModalProps) {
  const queryClient = useQueryClient();
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [coverLetter, setCoverLetter] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch applicant's uploaded resumes
  const {
    data: resumes = [],
    isLoading: isResumesLoading,
    error: resumesError,
  } = useQuery({
    queryKey: ['applicant-resumes'],
    queryFn: applicantService.listResumes,
    enabled: isOpen,
  });

  // Automatically select primary resume if available
  React.useEffect(() => {
    if (resumes.length > 0 && !selectedResumeId) {
      const primary = resumes.find((r) => r.isPrimary) || resumes[0];
      setSelectedResumeId(primary.id);
    }
  }, [resumes, selectedResumeId]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null);
      if (!selectedResumeId) {
        throw new Error('Please select a resume to attach to your application.');
      }
      return applicationService.submitApplication({
        job_id: job.id,
        resume_id: selectedResumeId,
        cover_letter: coverLetter.trim() || null,
      });
    },
    onSuccess: () => {
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    },
    onError: (err: any) => {
      setSubmitError(err.message || 'Failed to submit application. Please verify details and try again.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 my-8 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-2xs font-semibold text-blue-600 uppercase tracking-wider">
              Candidate Application
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Apply for {job.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{job.company_name}</span>
              <span>·</span>
              <span>{job.department_name}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Application Submitted!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your application for <strong className="text-slate-700">{job.title}</strong> has been transmitted to the recruitment team.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyMutation.mutate();
            }}
            className="space-y-5"
          >
            {submitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Submission Failed:</span> {submitError}
                </div>
              </div>
            )}

            {/* Resume Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Select Resume Document <span className="text-red-500">*</span>
              </label>

              {isResumesLoading ? (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
                  Loading stored resumes...
                </div>
              ) : resumes.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    No Uploaded Resumes Found
                  </div>
                  <p className="text-slate-600 text-2xs">
                    You must upload at least one verified resume document (.pdf or .docx) in your Applicant Profile before applying to jobs.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {resumes.map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedResumeId === r.id
                          ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="selectedResume"
                          value={r.id}
                          checked={selectedResumeId === r.id}
                          onChange={() => setSelectedResumeId(r.id)}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div>
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {r.fileName}
                            {r.isPrimary && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-sm font-bold">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {(r.fileSize / 1024).toFixed(1)} KB · Uploaded {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Cover Letter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Cover Letter / Introduction Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <span className="text-2xs text-slate-400">{coverLetter.length} / 4000</span>
              </div>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="Highlight your qualifications, key achievements, or motivation for joining the team..."
                className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-400 resize-y"
              />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={applyMutation.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={applyMutation.isPending || resumes.length === 0 || !selectedResumeId}
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-1.5"
              >
                {applyMutation.isPending ? (
                  <>
                    <LoadingSpinner /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Application
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
