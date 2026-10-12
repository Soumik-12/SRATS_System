import { apiClient } from '../api/client';
import type {
  Job,
  PublicJob,
  PaginatedResponse,
  CreateJobInput,
  UpdateJobInput,
  Company,
  Department,
} from '../types';

export interface JobQueryFilters {
  query?: string;
  location?: string;
  employment_type?: string;
  experience_level?: string;
  company_id?: string;
  department_id?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export const jobService = {
  /**
   * Search and browse real published jobs with pagination, filters, and controlled sorting.
   */
  async searchPublicJobs(filters: JobQueryFilters = {}): Promise<PaginatedResponse<PublicJob>> {
    const params = new URLSearchParams();
    if (filters.query?.trim()) params.set('query', filters.query.trim());
    if (filters.location?.trim()) params.set('location', filters.location.trim());
    if (filters.employment_type?.trim()) params.set('employment_type', filters.employment_type.trim());
    if (filters.experience_level?.trim()) params.set('experience_level', filters.experience_level.trim());
    if (filters.company_id?.trim()) params.set('company_id', filters.company_id.trim());
    if (filters.department_id?.trim()) params.set('department_id', filters.department_id.trim());
    if (filters.sort?.trim()) params.set('sort', filters.sort.trim());
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.size !== undefined) params.set('size', String(filters.size));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<PaginatedResponse<PublicJob>>(`/jobs${queryString}`);
  },

  /**
   * Retrieve real public job details. Rejects drafts with 404.
   */
  async getPublicJob(id: string): Promise<PublicJob> {
    const res = await apiClient.get<{ job: PublicJob }>(`/jobs/${id}`);
    return res.job;
  },

  /**
   * List jobs for recruiter's company.
   */
  async listRecruiterJobs(status?: string): Promise<Job[]> {
    const query = status && status !== 'ALL' ? `?status=${status}` : '';
    const res = await apiClient.get<{ jobs: Job[] }>(`/recruiter/jobs${query}`);
    return res.jobs;
  },

  /**
   * Create a new job requisition in DRAFT status.
   */
  async createJob(data: CreateJobInput): Promise<Job> {
    const res = await apiClient.post<{ message: string; job: Job }>('/jobs', data);
    return res.job;
  },

  /**
   * Update an existing job requisition.
   */
  async updateJob(id: string, data: UpdateJobInput): Promise<Job> {
    const res = await apiClient.put<{ message: string; job: Job }>(`/jobs/${id}`, data);
    return res.job;
  },

  /**
   * Transition job from DRAFT to PUBLISHED with server-side validation.
   */
  async publishJob(id: string): Promise<Job> {
    const res = await apiClient.post<{ message: string; job: Job }>(`/jobs/${id}/publish`);
    return res.job;
  },

  /**
   * Transition job from PUBLISHED to CLOSED.
   */
  async closeJob(id: string): Promise<Job> {
    const res = await apiClient.post<{ message: string; job: Job }>(`/jobs/${id}/close`);
    return res.job;
  },

  /**
   * Get the recruiter's company profile.
   */
  async getRecruiterCompany(): Promise<Company | null> {
    const res = await apiClient.get<{ company: Company | null }>('/recruiter/company');
    return res.company;
  },

  /**
   * List departments in recruiter's company.
   */
  async getRecruiterDepartments(): Promise<Department[]> {
    const res = await apiClient.get<{ departments: Department[] }>('/recruiter/departments');
    return res.departments;
  },

  /**
   * Add a new department to the recruiter's company.
   */
  async createDepartment(name: string): Promise<Department> {
    const res = await apiClient.post<{ message: string; department: Department }>('/recruiter/departments', {
      name,
    });
    return res.department;
  },

  /**
   * Setup company organization profile if unassigned.
   */
  async setupCompany(data: {
    name: string;
    industry?: string;
    location?: string;
    domain?: string;
    size?: string;
  }): Promise<Company> {
    const res = await apiClient.post<{ message: string; company: Company }>('/recruiter/setup-company', data);
    return res.company;
  },
};
