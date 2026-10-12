import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewService } from '../../services/interviewService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Calendar, Clock, AlertCircle, X } from 'lucide-react';
import type { InterviewWithDetails } from '../../types';

interface RescheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  interview: InterviewWithDetails | null;
}

export function RescheduleInterviewModal({ isOpen, onClose, interview }: RescheduleInterviewModalProps) {
  const queryClient = useQueryClient();

  const [localDate, setLocalDate] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(interview?.duration_minutes || 45);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!interview) return;
      setErrorMessage(null);
      if (!localDate || !localTime) throw new Error('Please enter new date and time.');

      const localDateTimeStr = `${localDate}T${localTime}`;
      const dateObj = new Date(localDateTimeStr);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date or time format.');
      }
      if (dateObj.getTime() <= Date.now()) {
        throw new Error('Rescheduled time must be in the future.');
      }
      const utcString = dateObj.toISOString();

      return interviewService.rescheduleInterview(interview.id, {
        scheduled_at_utc: utcString,
        duration_minutes: Number(durationMinutes),
        reason: reason.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to reschedule interview.');
    },
  });

  if (!isOpen || !interview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100/60 border border-amber-200/50 flex items-center justify-center text-amber-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Reschedule Interview</h2>
              <p className="text-xs text-slate-500">
                Candidate: {interview.applicant_name} · Position: {interview.job_title}
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
                <span className="font-semibold">Rescheduling Error: </span>
                {errorMessage}
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p>
              <span className="font-semibold text-slate-700">Current Schedule (UTC):</span>{' '}
              {new Date(interview.scheduled_at_utc).toUTCString()}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Current Local:</span>{' '}
              {new Date(interview.scheduled_at_utc).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Date *
              </label>
              <input
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Time *
              </label>
              <input
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Duration
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reschedule Reason (Recorded in audit trail)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Conflict in evaluator schedule; rescheduled to Thursday afternoon..."
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={rescheduleMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => rescheduleMutation.mutate()}
            disabled={rescheduleMutation.isPending || !localDate || !localTime}
          >
            {rescheduleMutation.isPending ? 'Updating...' : 'Confirm Reschedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
