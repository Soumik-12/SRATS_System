import { apiClient } from '../api/client';
import type {
  Interview,
  InterviewWithDetails,
  InterviewFeedback,
  ScheduleInterviewInput,
  RescheduleInterviewInput,
  SubmitFeedbackInput,
  InterviewerUser,
  EligibleApplication,
} from '../types';

export const interviewService = {
  /**
   * List interviews scoped to the authenticated caller's role:
   * - APPLICANT: only own scheduled interviews (sanitized)
   * - INTERVIEWER: only assigned interviews
   * - RECRUITER / HR_MANAGER: company-scoped interviews
   * - ADMIN: system-wide interviews
   */
  async listInterviews(): Promise<InterviewWithDetails[]> {
    const res = await apiClient.get<{ interviews: InterviewWithDetails[] }>('/interviews');
    return res.interviews;
  },

  /**
   * Get single interview details by ID.
   */
  async getInterviewById(id: string): Promise<InterviewWithDetails> {
    const res = await apiClient.get<{ interview: InterviewWithDetails }>(`/interviews/${id}`);
    return res.interview;
  },

  /**
   * List available interviewers for assignment dropdown.
   */
  async listInterviewers(): Promise<InterviewerUser[]> {
    const res = await apiClient.get<{ interviewers: InterviewerUser[] }>('/interviews/interviewers');
    return res.interviewers;
  },

  /**
   * List applications eligible for scheduling (SHORTLISTED or INTERVIEW_SCHEDULED).
   */
  async listEligibleApplications(): Promise<EligibleApplication[]> {
    const res = await apiClient.get<{ applications: EligibleApplication[] }>(
      '/interviews/eligible-applications'
    );
    return res.applications;
  },

  /**
   * Schedule an interview (Recruiter / HR / Admin).
   */
  async scheduleInterview(input: ScheduleInterviewInput): Promise<Interview> {
    const res = await apiClient.post<{ message: string; interview: Interview }>('/interviews', input);
    return res.interview;
  },

  /**
   * Reschedule an interview (Recruiter / HR / Admin).
   */
  async rescheduleInterview(id: string, input: RescheduleInterviewInput): Promise<Interview> {
    const res = await apiClient.post<{ message: string; interview: Interview }>(
      `/interviews/${id}/reschedule`,
      input
    );
    return res.interview;
  },

  /**
   * Cancel an interview (Recruiter / HR / Admin).
   */
  async cancelInterview(id: string, reason?: string): Promise<Interview> {
    const res = await apiClient.post<{ message: string; interview: Interview }>(
      `/interviews/${id}/cancel`,
      { reason }
    );
    return res.interview;
  },

  /**
   * Submit evaluation feedback (Assigned interviewer only).
   */
  async submitFeedback(interviewId: string, input: SubmitFeedbackInput): Promise<InterviewFeedback> {
    const res = await apiClient.post<{ message: string; feedback: InterviewFeedback }>(
      `/interviews/${interviewId}/feedback`,
      input
    );
    return res.feedback;
  },

  /**
   * Get submitted evaluation feedback for an interview.
   */
  async getFeedback(interviewId: string): Promise<InterviewFeedback | null> {
    const res = await apiClient.get<{ feedback: InterviewFeedback | null }>(
      `/interviews/${interviewId}/feedback`
    );
    return res.feedback;
  },
};
