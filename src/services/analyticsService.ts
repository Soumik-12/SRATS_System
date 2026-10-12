import { apiClient } from '../api/client';

export interface ApplicantAnalytics {
  metrics: {
    totalApplications: number;
    appliedCount: number;
    shortlistedCount: number;
    interviewScheduledCount: number;
    selectedCount: number;
    hiredCount: number;
    rejectedCount: number;
    upcomingInterviewsCount: number;
    unreadNotificationsCount: number;
    profileCompletenessPercent: number;
  };
  recentApplications: Array<{
    id: string;
    job_id: string;
    status: string;
    created_at: string;
    job_title: string;
    company_name: string;
    location: string;
  }>;
  upcomingInterviews: Array<{
    id: string;
    scheduled_at_utc: string;
    duration_minutes: number;
    interview_type: string;
    location_url: string | null;
    job_title: string;
    company_name: string;
  }>;
  profileChecklist: {
    hasHeadline: boolean;
    hasSummary: boolean;
    hasLocation: boolean;
    hasPhone: boolean;
    hasActiveResume: boolean;
    skillsCount: number;
  };
}

export interface RecruiterAnalytics {
  metrics: {
    activeJobsCount: number;
    draftJobsCount: number;
    closedJobsCount: number;
    totalJobsCount: number;
    totalApplicationsCount: number;
    appliedCount: number;
    shortlistedCount: number;
    interviewScheduledCount: number;
    selectedCount: number;
    hiredCount: number;
    rejectedCount: number;
    upcomingInterviewsCount: number;
    pendingFeedbackCount: number;
  };
  applicationTrends: Array<{
    date: string;
    count: number;
  }>;
  recentApplications: Array<{
    id: string;
    status: string;
    created_at: string;
    job_title: string;
    candidate_name: string;
    candidate_email: string;
  }>;
  jobsNearingDeadline: Array<{
    id: string;
    title: string;
    status: string;
    deadline_utc: string;
    application_count: number;
  }>;
}

export interface InterviewerAnalytics {
  metrics: {
    upcomingInterviewsCount: number;
    pastInterviewsCount: number;
    completedEvaluationsCount: number;
    pendingFeedbackCount: number;
  };
  upcomingInterviews: Array<{
    id: string;
    scheduled_at_utc: string;
    duration_minutes: number;
    interview_type: string;
    location_url: string | null;
    status: string;
    candidate_name: string;
    candidate_email: string;
    job_title: string;
    department_name: string | null;
  }>;
  recentEvaluations: Array<{
    id: string;
    interview_id: string;
    rating: number;
    recommendation: string;
    candidate_name: string;
    job_title: string;
    created_at: string;
  }>;
}

export interface HrAnalytics {
  metrics: {
    totalJobsCount: number;
    activeJobsCount: number;
    draftJobsCount: number;
    closedJobsCount: number;
    totalApplicationsCount: number;
    totalInterviewsCount: number;
    hiredCount: number;
    selectedCount: number;
    shortlistedCount: number;
    interviewScheduledCount: number;
    appliedCount: number;
    rejectedCount: number;
  };
  departmentMetrics: Array<{
    department_id: string;
    department_name: string;
    job_count: number;
    active_job_count: number;
    application_count: number;
    hired_count: number;
  }>;
  hiringTrends: Array<{
    date: string;
    applications_count: number;
    hired_count: number;
  }>;
}

export interface AdminAnalytics {
  metrics: {
    totalUsersCount: number;
    activeUsersCount: number;
    deactivatedUsersCount: number;
    totalCompaniesCount: number;
    activeCompaniesCount: number;
    totalJobsCount: number;
    publishedJobsCount: number;
    totalApplicationsCount: number;
    totalInterviewsCount: number;
    totalAuditLogsCount: number;
  };
  usersByRole: {
    APPLICANT: number;
    RECRUITER: number;
    INTERVIEWER: number;
    HR_MANAGER: number;
    ADMIN: number;
  };
  recentAuditLogs: Array<{
    id: string;
    actor_id: string | null;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
  }>;
}

export const analyticsService = {
  getApplicantAnalytics(): Promise<ApplicantAnalytics> {
    return apiClient.get<ApplicantAnalytics>('/analytics/applicant');
  },

  getRecruiterAnalytics(): Promise<RecruiterAnalytics> {
    return apiClient.get<RecruiterAnalytics>('/analytics/recruiter');
  },

  getInterviewerAnalytics(): Promise<InterviewerAnalytics> {
    return apiClient.get<InterviewerAnalytics>('/analytics/interviewer');
  },

  getHrAnalytics(): Promise<HrAnalytics> {
    return apiClient.get<HrAnalytics>('/analytics/hr');
  },

  getAdminAnalytics(): Promise<AdminAnalytics> {
    return apiClient.get<AdminAnalytics>('/analytics/admin');
  },
};
