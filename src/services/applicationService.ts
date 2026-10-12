import { apiClient } from '../api/client';
import type {
  Application,
  ApplicationWithDetails,
  ApplicationStatusHistoryItem,
  SubmitApplicationInput,
  UpdateApplicationStatusInput,
} from '../types';

export const applicationService = {
  /**
   * Submit application to a published job position
   */
  async submitApplication(input: SubmitApplicationInput): Promise<{ message: string; application: Application }> {
    return apiClient.post<{ message: string; application: Application }>('/applications', input);
  },

  /**
   * Candidate lists their submitted applications
   */
  async listMyApplications(): Promise<ApplicationWithDetails[]> {
    const res = await apiClient.get<{ applications: ApplicationWithDetails[] }>('/applications/my');
    return res.applications;
  },

  /**
   * Recruiter / HR lists company applications (optionally filtered by jobId and status)
   */
  async listCompanyApplications(jobId?: string, status?: string): Promise<ApplicationWithDetails[]> {
    const params = new URLSearchParams();
    if (jobId && jobId.trim()) params.append('jobId', jobId.trim());
    if (status && status !== 'ALL') params.append('status', status);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{ applications: ApplicationWithDetails[] }>(`/applications${queryString}`);
    return res.applications;
  },

  /**
   * Get single application details and stage transition history
   */
  async getApplicationDetails(
    id: string
  ): Promise<{ application: ApplicationWithDetails; history: ApplicationStatusHistoryItem[] }> {
    return apiClient.get<{ application: ApplicationWithDetails; history: ApplicationStatusHistoryItem[] }>(
      `/applications/${id}`
    );
  },

  /**
   * Recruiter updates application status in the pipeline
   */
  async updateApplicationStatus(
    id: string,
    input: UpdateApplicationStatusInput
  ): Promise<{ message: string; application: Application }> {
    return apiClient.put<{ message: string; application: Application }>(`/applications/${id}/status`, input);
  },
};
