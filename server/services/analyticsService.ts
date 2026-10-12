import { analyticsRepository, type ApplicantAnalyticsDTO, type RecruiterAnalyticsDTO, type InterviewerAnalyticsDTO, type HrAnalyticsDTO, type AdminAnalyticsDTO } from '../repositories/analyticsRepository.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AccessTokenPayload } from '../types/index.js';

export class AnalyticsService {
  async getApplicantAnalytics(caller: AccessTokenPayload): Promise<ApplicantAnalyticsDTO> {
    if (caller.role !== 'APPLICANT') {
      throw new AppError(403, 'FORBIDDEN', `Role "${caller.role}" is not authorized for applicant analytics.`);
    }
    return analyticsRepository.getApplicantAnalytics(caller.sub);
  }

  async getRecruiterAnalytics(caller: AccessTokenPayload, _untrustedCompanyId?: string): Promise<RecruiterAnalyticsDTO> {
    if (caller.role !== 'RECRUITER' && caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Role "${caller.role}" is not authorized for recruiter analytics.`);
    }

    let companyId: string | undefined;
    if (caller.role === 'ADMIN') {
      companyId = _untrustedCompanyId || caller.companyId || undefined;
      if (!companyId) {
        // Return blank analytics if admin has not specified a company scope
        return {
          metrics: {
            activeJobsCount: 0,
            draftJobsCount: 0,
            closedJobsCount: 0,
            totalJobsCount: 0,
            totalApplicationsCount: 0,
            appliedCount: 0,
            shortlistedCount: 0,
            interviewScheduledCount: 0,
            selectedCount: 0,
            hiredCount: 0,
            rejectedCount: 0,
            upcomingInterviewsCount: 0,
            pendingFeedbackCount: 0,
          },
          applicationTrends: [],
          recentApplications: [],
          jobsNearingDeadline: [],
        };
      }
    } else {
      // NEVER trust query parameter for recruiter or HR manager - strictly enforce caller.companyId
      if (!caller.companyId) {
        throw new AppError(403, 'NO_COMPANY_ASSIGNED', 'No company assigned to recruiter.');
      }
      companyId = caller.companyId;
    }

    return analyticsRepository.getRecruiterAnalytics(companyId);
  }

  async getInterviewerAnalytics(caller: AccessTokenPayload): Promise<InterviewerAnalyticsDTO> {
    if (caller.role !== 'INTERVIEWER' && caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Role "${caller.role}" is not authorized for interviewer analytics.`);
    }
    return analyticsRepository.getInterviewerAnalytics(caller.sub);
  }

  async getHrAnalytics(caller: AccessTokenPayload, _untrustedCompanyId?: string): Promise<HrAnalyticsDTO> {
    if (caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Role "${caller.role}" is not authorized for HR analytics.`);
    }

    let companyId: string | undefined;
    if (caller.role === 'ADMIN') {
      companyId = _untrustedCompanyId || caller.companyId || undefined;
      if (!companyId) {
        return {
          metrics: {
            totalJobsCount: 0,
            activeJobsCount: 0,
            draftJobsCount: 0,
            closedJobsCount: 0,
            totalApplicationsCount: 0,
            totalInterviewsCount: 0,
            hiredCount: 0,
            selectedCount: 0,
            shortlistedCount: 0,
            interviewScheduledCount: 0,
            appliedCount: 0,
            rejectedCount: 0,
          },
          departmentMetrics: [],
          hiringTrends: [],
        };
      }
    } else {
      if (!caller.companyId) {
        throw new AppError(403, 'NO_COMPANY_ASSIGNED', 'No company assigned to HR manager.');
      }
      companyId = caller.companyId;
    }

    return analyticsRepository.getHrAnalytics(companyId);
  }

  async getAdminAnalytics(caller: AccessTokenPayload): Promise<AdminAnalyticsDTO> {
    if (caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Access denied. Role "${caller.role}" is not authorized for administrator analytics.`);
    }
    return analyticsRepository.getAdminAnalytics();
  }
}

export const analyticsService = new AnalyticsService();
