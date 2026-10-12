import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewService } from '../../services/interviewService';
import { Button } from '../ui/Button';
import { Star, CheckCircle2, AlertCircle, X, Award } from 'lucide-react';
import type { InterviewWithDetails, RecommendationDecision } from '../../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  interview: InterviewWithDetails | null;
}

export function FeedbackModal({ isOpen, onClose, interview }: FeedbackModalProps) {
  const queryClient = useQueryClient();

  const [rating, setRating] = useState<number>(4);
  const [recommendation, setRecommendation] = useState<RecommendationDecision>('HIRE');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      if (!interview) return;
      setErrorMessage(null);
      if (!notes || notes.trim().length < 5) {
        throw new Error('Evaluation notes must be at least 5 characters.');
      }

      return interviewService.submitFeedback(interview.id, {
        rating,
        recommendation,
        notes: notes.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to submit feedback.');
    },
  });

  if (!isOpen || !interview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100/60 border border-purple-200/50 flex items-center justify-center text-purple-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Candidate Evaluation Feedback</h2>
              <p className="text-xs text-slate-500">
                {interview.applicant_name} · {interview.job_title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Submission Error: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Rating Stars */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Performance Rating (1 to 5) *
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      star <= rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-slate-700">
                {rating === 5 && '5 - Exceptional'}
                {rating === 4 && '4 - Strong / Exceeds'}
                {rating === 3 && '3 - Satisfactory / Meets'}
                {rating === 2 && '2 - Developing / Below'}
                {rating === 1 && '1 - Unsatisfactory'}
              </span>
            </div>
          </div>

          {/* Recommendation Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Hiring Recommendation *
            </label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as RecommendationDecision)}
              className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="STRONG_HIRE">Strong Hire</option>
              <option value="HIRE">Hire</option>
              <option value="NO_HIRE">No Hire</option>
              <option value="STRONG_NO_HIRE">Strong No Hire</option>
            </select>
          </div>

          {/* Evaluation Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Evaluation Assessment Notes *
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide concrete evaluation of candidate's domain knowledge, problem-solving ability, and alignment with position requirements..."
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 5 characters. Submitting feedback will transition interview state to COMPLETED.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={feedbackMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => feedbackMutation.mutate()}
            disabled={feedbackMutation.isPending || !notes.trim()}
          >
            {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </div>
    </div>
  );
}
