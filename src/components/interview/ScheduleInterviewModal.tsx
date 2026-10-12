import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewService } from '../../services/interviewService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Calendar, Clock, Video, MapPin, AlertCircle, X, CheckCircle2, Info } from 'lucide-react';
import type { InterviewType } from '../../types';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultApplicationId?: string;
}

export function ScheduleInterviewModal({ isOpen, onClose, defaultApplicationId }: ScheduleInterviewModalProps) {
  const queryClient = useQueryClient();

  const [applicationId, setApplicationId] = useState(defaultApplicationId || '');
  const [interviewerId, setInterviewerId] = useState('');
  const [localDate, setLocalDate] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [interviewType, setInterviewType] = useState<InterviewType>('ONLINE');
  const [locationUrl, setLocationUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever modal opens or defaultApplicationId changes
  useEffect(() => {
    if (isOpen) {
      setApplicationId(defaultApplicationId || '');
      setInterviewerId('');
      setLocalDate('');
      setLocalTime('');
      setDurationMinutes(45);
      setInterviewType('ONLINE');
      setLocationUrl('');
      setNotes('');
      setErrorMessage(null);
    }
  }, [isOpen, defaultApplicationId]);

  const { data: applications = [], isLoading: isLoadingApps } = useQuery({
    queryKey: ['eligible-applications'],
    queryFn: () => interviewService.listEligibleApplications(),
    enabled: isOpen,
  });

  const { data: interviewers = [], isLoading: isLoadingInterviewers } = useQuery({
    queryKey: ['available-interviewers'],
    queryFn: () => interviewService.listInterviewers(),
    enabled: isOpen,
  });

  // Calculate detailed field validation
  const validationState = useMemo(() => {
    const isAppSelected = Boolean(applicationId);
    const isInterviewerSelected = Boolean(interviewerId);
    const isDateProvided = Boolean(localDate);
    const isTimeProvided = Boolean(localTime);

    let isFutureDateTime = false;
    let dateTimeError: string | null = null;
    if (isDateProvided && isTimeProvided) {
      const d = new Date(`${localDate}T${localTime}`);
      if (isNaN(d.getTime())) {
        dateTimeError = 'Invalid date/time';
      } else if (d.getTime() <= Date.now()) {
        dateTimeError = 'Must be future date & time';
      } else {
        isFutureDateTime = true;
      }
    }

    const isLocationProvided = Boolean(locationUrl.trim());
    let isLocationValid = false;
    let locationError: string | null = null;
    if (isLocationProvided) {
      if (interviewType === 'ONLINE') {
        try {
          const parsed = new URL(locationUrl.trim());
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            isLocationValid = true;
          } else {
            locationError = 'Must start with http:// or https://';
          }
        } catch {
          locationError = 'Invalid URL format';
        }
      } else {
        isLocationValid = true;
      }
    }

    const missingFields: string[] = [];
    if (!isAppSelected) missingFields.push('Candidate Application');
    if (!isInterviewerSelected) missingFields.push('Assigned Interviewer');
    if (!isDateProvided) missingFields.push('Date');
    if (!isTimeProvided) missingFields.push('Time');
    if (isDateProvided && isTimeProvided && !isFutureDateTime) {
      missingFields.push(dateTimeError || 'Future Date & Time');
    }
    if (!isLocationProvided) {
      missingFields.push(interviewType === 'ONLINE' ? 'Meeting URL' : 'Location Address');
    } else if (!isLocationValid) {
      missingFields.push(locationError || 'Valid Meeting URL');
    }

    const isValid = Boolean(
      isAppSelected &&
      isInterviewerSelected &&
      isDateProvided &&
      isTimeProvided &&
      isFutureDateTime &&
      isLocationProvided &&
      isLocationValid
    );

    return {
      isValid,
      missingFields,
      dateTimeError,
      locationError,
    };
  }, [applicationId, interviewerId, localDate, localTime, durationMinutes, interviewType, locationUrl]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      if (!applicationId) throw new Error('Please select an eligible candidate application.');
      if (!interviewerId) throw new Error('Please select an assigned interviewer.');
      if (!localDate || !localTime) throw new Error('Please select a date and time.');

      // Combine local date and time and convert to ISO UTC string
      const localDateTimeStr = `${localDate}T${localTime}`;
      const dateObj = new Date(localDateTimeStr);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date or time format.');
      }
      if (dateObj.getTime() <= Date.now()) {
        throw new Error('Interview must be scheduled for a future date and time.');
      }
      const utcString = dateObj.toISOString();

      if (!locationUrl.trim()) {
        throw new Error(
          interviewType === 'ONLINE'
            ? 'Meeting URL is required for online interviews.'
            : 'Physical location address/room is required for in-person interviews.'
        );
      }

      if (interviewType === 'ONLINE') {
        try {
          const parsed = new URL(locationUrl.trim());
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Meeting link must use http or https scheme.');
          }
        } catch {
          throw new Error('Please enter a valid HTTP or HTTPS meeting URL (e.g. https://meet.google.com/...).');
        }
      }

      return interviewService.scheduleInterview({
        application_id: applicationId,
        interviewer_id: interviewerId,
        scheduled_at_utc: utcString,
        duration_minutes: Number(durationMinutes),
        interview_type: interviewType,
        location_url: locationUrl.trim(),
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-applications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to schedule interview.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100/60 border border-blue-200/50 flex items-center justify-center text-blue-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Schedule Interview</h2>
              <p className="text-xs text-slate-500">
                Authorized scheduling · Connects candidate application and assigned interviewer
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
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Scheduling Error: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Application Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Candidate Application *
            </label>
            {isLoadingApps ? (
              <div className="text-xs text-slate-400 py-2">Loading eligible candidates...</div>
            ) : applications.length === 0 && !defaultApplicationId ? (
              <div className="space-y-2">
                <select
                  disabled
                  className="w-full px-3 py-2 text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed"
                >
                  <option>No candidate applications currently eligible</option>
                </select>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">No candidates available: </span>
                    Scheduling requires an applicant in <strong>SHORTLISTED</strong> or <strong>INTERVIEW_SCHEDULED</strong> status.
                    Move candidates to Shortlisted in the Candidate Pipeline first.
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select candidate application...</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.applicant_name} ({app.applicant_email}) — {app.job_title} [{app.status}]
                  </option>
                ))}
                {defaultApplicationId && !applications.some((a) => a.id === defaultApplicationId) && (
                  <option value={defaultApplicationId}>
                    Preselected Application #{defaultApplicationId}
                  </option>
                )}
              </select>
            )}
          </div>

          {/* Interviewer Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Interviewer *
            </label>
            {isLoadingInterviewers ? (
              <div className="text-xs text-slate-400 py-2">Loading active interviewers...</div>
            ) : (
              <select
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select evaluator...</option>
                {interviewers.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({inv.email})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Interviewer must have explicit assignment to access candidate details and submit evaluation ratings.
            </p>
          </div>

          {/* Date, Time, Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Date (Local) *
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
                Time (Local) *
              </label>
              <input
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
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
                <option value={60}>60 minutes (1 hour)</option>
                <option value={90}>90 minutes (1.5 hours)</option>
                <option value={120}>120 minutes (2 hours)</option>
              </select>
            </div>
          </div>
          {validationState.dateTimeError ? (
            <p className="text-[11px] text-rose-600 font-medium">
              ⚠️ {validationState.dateTimeError}
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">
              Timestamps are stored canonical UTC in database. Conflict detection checks overlapping interviewer commitments.
            </p>
          )}

          {/* Interview Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Interview Format *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInterviewType('ONLINE')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  interviewType === 'ONLINE'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Video className="w-4 h-4 text-blue-600" />
                Online / Video Conference
              </button>
              <button
                type="button"
                onClick={() => setInterviewType('IN_PERSON')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  interviewType === 'IN_PERSON'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MapPin className="w-4 h-4 text-emerald-600" />
                In-Person / On-Site
              </button>
            </div>
          </div>

          {/* Location or Meeting Link */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {interviewType === 'ONLINE' ? 'Meeting URL (HTTPS) *' : 'Location Address / Room *'}
            </label>
            <Input
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder={
                interviewType === 'ONLINE'
                  ? 'https://meet.google.com/abc-defg-hij'
                  : 'Main Campus, Building B, Room 402'
              }
            />
            {validationState.locationError ? (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                ⚠️ {validationState.locationError}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                {interviewType === 'ONLINE'
                  ? 'Protocols are strictly validated. Only secure http/https links accepted.'
                  : 'Provide physical address or office room instructions.'}
              </p>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Internal Interview Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on distributed systems architecture, database scalability, and coding design patterns..."
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Internal notes are visible to interviewers and recruiters. They are strictly omitted from candidate view.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs">
            {validationState.isValid ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All required fields valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11px]">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-xs">
                  Missing: {validationState.missingFields.join(', ')}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose} disabled={scheduleMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending || !validationState.isValid}
              title={
                !validationState.isValid
                  ? `Please complete required fields: ${validationState.missingFields.join(', ')}`
                  : 'Confirm and schedule this interview session'
              }
            >
              {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm & Schedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
