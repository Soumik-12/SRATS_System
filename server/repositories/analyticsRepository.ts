import { getDatabase } from '../db/connection.js';

export interface ApplicantAnalyticsDTO {
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
    applicationsByStatus?: Record<string, number>;
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

export interface RecruiterAnalyticsDTO {
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
    applicationsByStatus?: Record<string, number>;
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

export interface InterviewerAnalyticsDTO {
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

export interface HrAnalyticsDTO {
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

export interface AdminAnalyticsDTO {
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

export class AnalyticsRepository {
  private get db() {
    return getDatabase();
  }

  async getApplicantAnalytics(applicantId: string): Promise<ApplicantAnalyticsDTO> {
    const nowIso = new Date().toISOString();

    // 1. Status breakdown
    const statusRows = this.db.query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM applications
       WHERE applicant_id = ?
       GROUP BY status;`,
      [applicantId]
    );

    const counts: Record<string, number> = {};
    let totalApps = 0;
    for (const row of statusRows) {
      counts[row.status] = row.count;
      totalApps += row.count;
    }

    // 2. Upcoming interviews
    const upcomingInterviewsRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(i.id) AS count
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       WHERE a.applicant_id = ?
         AND i.status = 'SCHEDULED'
         AND i.scheduled_at_utc >= ?;`,
      [applicantId, nowIso]
    );
    const upcomingInterviewsCount = upcomingInterviewsRow?.count || 0;

    // 3. Unread notifications
    const unreadRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = ? AND is_read = 0;`,
      [applicantId]
    );
    const unreadNotificationsCount = unreadRow?.count || 0;

    // 4. Profile completeness
    const profile = this.db.queryOne<{
      headline: string | null;
      summary: string | null;
      location: string | null;
      phone: string | null;
    }>(
      `SELECT headline, summary, location, phone
       FROM applicant_profiles
       WHERE user_id = ?;`,
      [applicantId]
    );

    const activeResumeRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM resumes
       WHERE applicant_id = ? AND is_active = 1 AND deleted_at IS NULL;`,
      [applicantId]
    );
    const hasActiveResume = (activeResumeRow?.count || 0) > 0;

    const skillsRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM applicant_skills
       WHERE applicant_id = ?;`,
      [applicantId]
    );
    const skillsCount = skillsRow?.count || 0;

    const hasHeadline = Boolean(profile?.headline && profile.headline.trim().length > 0);
    const hasSummary = Boolean(profile?.summary && profile.summary.trim().length > 0);
    const hasLocation = Boolean(profile?.location && profile.location.trim().length > 0);
    const hasPhone = Boolean(profile?.phone && profile.phone.trim().length > 0);

    let completedCheckpoints = 0;
    const totalCheckpoints = 6;
    if (hasHeadline) completedCheckpoints++;
    if (hasSummary) completedCheckpoints++;
    if (hasLocation) completedCheckpoints++;
    if (hasPhone) completedCheckpoints++;
    if (hasActiveResume) completedCheckpoints++;
    if (skillsCount > 0) completedCheckpoints++;

    const profileCompletenessPercent = Math.round((completedCheckpoints / totalCheckpoints) * 100);

    // 5. Recent applications (latest 5)
    const recentApplications = this.db.query<{
      id: string;
      job_id: string;
      status: string;
      created_at: string;
      job_title: string;
      company_name: string;
      location: string;
    }>(
      `SELECT a.id, a.job_id, a.status, a.applied_at AS created_at,
              j.title AS job_title,
              c.name AS company_name,
              j.location AS location
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       WHERE a.applicant_id = ?
       ORDER BY a.applied_at DESC
       LIMIT 5;`,
      [applicantId]
    );

    // 6. Upcoming interviews list
    const upcomingInterviews = this.db.query<{
      id: string;
      scheduled_at_utc: string;
      duration_minutes: number;
      interview_type: string;
      location_url: string | null;
      job_title: string;
      company_name: string;
    }>(
      `SELECT i.id, i.scheduled_at_utc, i.duration_minutes, i.interview_type, i.location_url,
              j.title AS job_title,
              c.name AS company_name
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       JOIN companies c ON j.company_id = c.id
       WHERE a.applicant_id = ?
         AND i.status = 'SCHEDULED'
         AND i.scheduled_at_utc >= ?
       ORDER BY i.scheduled_at_utc ASC
       LIMIT 5;`,
      [applicantId, nowIso]
    );

    return {
      metrics: {
        totalApplications: totalApps,
        appliedCount: counts['APPLIED'] || 0,
        shortlistedCount: counts['SHORTLISTED'] || 0,
        interviewScheduledCount: counts['INTERVIEW_SCHEDULED'] || 0,
        selectedCount: counts['SELECTED'] || 0,
        hiredCount: counts['HIRED'] || 0,
        rejectedCount: counts['REJECTED'] || 0,
        upcomingInterviewsCount,
        unreadNotificationsCount,
        profileCompletenessPercent,
        applicationsByStatus: counts,
      },
      recentApplications,
      upcomingInterviews,
      profileChecklist: {
        hasHeadline,
        hasSummary,
        hasLocation,
        hasPhone,
        hasActiveResume,
        skillsCount,
      },
    };
  }

  async getRecruiterAnalytics(companyId: string): Promise<RecruiterAnalyticsDTO> {
    const nowIso = new Date().toISOString();
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();

    // 1. Jobs breakdown
    const jobStatusRows = this.db.query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM jobs
       WHERE company_id = ? AND deleted_at IS NULL
       GROUP BY status;`,
      [companyId]
    );

    let activeJobs = 0;
    let draftJobs = 0;
    let closedJobs = 0;
    let totalJobs = 0;

    for (const r of jobStatusRows) {
      totalJobs += r.count;
      if (r.status === 'PUBLISHED') activeJobs += r.count;
      else if (r.status === 'DRAFT') draftJobs += r.count;
      else if (r.status === 'CLOSED') closedJobs += r.count;
    }

    // 2. Application status breakdown
    const appStatusRows = this.db.query<{ status: string; count: number }>(
      `SELECT a.status, COUNT(a.id) AS count
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE j.company_id = ?
       GROUP BY a.status;`,
      [companyId]
    );

    const appCounts: Record<string, number> = {};
    let totalApps = 0;
    for (const r of appStatusRows) {
      appCounts[r.status] = r.count;
      totalApps += r.count;
    }

    // 3. Upcoming interviews for company jobs
    const upcomingRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(i.id) AS count
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       WHERE j.company_id = ?
         AND i.status = 'SCHEDULED'
         AND i.scheduled_at_utc >= ?;`,
      [companyId, nowIso]
    );
    const upcomingInterviewsCount = upcomingRow?.count || 0;

    // 4. Pending feedback (interviews passed scheduled time with no feedback)
    const pendingFbRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(i.id) AS count
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN interview_feedback f ON i.id = f.interview_id
       WHERE j.company_id = ?
         AND i.status != 'CANCELLED'
         AND i.scheduled_at_utc <= ?
         AND f.id IS NULL;`,
      [companyId, nowIso]
    );
    const pendingFeedbackCount = pendingFbRow?.count || 0;

    // 5. Application trends (last 30 days)
    const trendRows = this.db.query<{ date: string; count: number }>(
      `SELECT substr(a.applied_at, 1, 10) AS date, COUNT(a.id) AS count
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE j.company_id = ?
         AND a.applied_at >= ?
       GROUP BY substr(a.applied_at, 1, 10)
       ORDER BY date ASC;`,
      [companyId, thirtyDaysAgoIso]
    );

    // 6. Recent applications
    const recentApplications = this.db.query<{
      id: string;
      status: string;
      created_at: string;
      job_title: string;
      candidate_name: string;
      candidate_email: string;
    }>(
      `SELECT a.id, a.status, a.applied_at AS created_at,
              j.title AS job_title,
              u.first_name || ' ' || u.last_name AS candidate_name,
              u.email AS candidate_email
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN users u ON a.applicant_id = u.id
       WHERE j.company_id = ?
       ORDER BY a.applied_at DESC
       LIMIT 6;`,
      [companyId]
    );

    // 7. Jobs nearing deadline (published jobs with deadlines within 14 days)
    const fourteenDaysFutureIso = new Date(Date.now() + 14 * 86400000).toISOString();
    const jobsNearingDeadline = this.db.query<{
      id: string;
      title: string;
      status: string;
      deadline_utc: string;
      application_count: number;
    }>(
      `SELECT j.id, j.title, j.status, j.deadline_utc,
              COUNT(a.id) AS application_count
       FROM jobs j
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE j.company_id = ?
         AND j.status = 'PUBLISHED'
         AND j.deleted_at IS NULL
         AND j.deadline_utc IS NOT NULL
         AND j.deadline_utc >= ?
         AND j.deadline_utc <= ?
       GROUP BY j.id
       ORDER BY j.deadline_utc ASC
       LIMIT 5;`,
      [companyId, nowIso, fourteenDaysFutureIso]
    );

    return {
      metrics: {
        activeJobsCount: activeJobs,
        draftJobsCount: draftJobs,
        closedJobsCount: closedJobs,
        totalJobsCount: totalJobs,
        totalApplicationsCount: totalApps,
        appliedCount: appCounts['APPLIED'] || 0,
        shortlistedCount: appCounts['SHORTLISTED'] || 0,
        interviewScheduledCount: appCounts['INTERVIEW_SCHEDULED'] || 0,
        selectedCount: appCounts['SELECTED'] || 0,
        hiredCount: appCounts['HIRED'] || 0,
        rejectedCount: appCounts['REJECTED'] || 0,
        upcomingInterviewsCount,
        pendingFeedbackCount,
        applicationsByStatus: appCounts,
      },
      applicationTrends: trendRows,
      recentApplications,
      jobsNearingDeadline,
    };
  }

  async getInterviewerAnalytics(interviewerId: string): Promise<InterviewerAnalyticsDTO> {
    const nowIso = new Date().toISOString();

    // 1. Upcoming interviews count
    const upcomingRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM interviews
       WHERE interviewer_id = ?
         AND status = 'SCHEDULED'
         AND scheduled_at_utc >= ?;`,
      [interviewerId, nowIso]
    );
    const upcomingInterviewsCount = upcomingRow?.count || 0;

    // 2. Past interviews count
    const pastRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM interviews
       WHERE interviewer_id = ?
         AND (status = 'COMPLETED' OR (status = 'SCHEDULED' AND scheduled_at_utc < ?));`,
      [interviewerId, nowIso]
    );
    const pastInterviewsCount = pastRow?.count || 0;

    // 3. Completed evaluations count
    const completedFbRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM interview_feedback
       WHERE interviewer_id = ?;`,
      [interviewerId]
    );
    const completedEvaluationsCount = completedFbRow?.count || 0;

    // 4. Pending feedback count
    const pendingRow = this.db.queryOne<{ count: number }>(
      `SELECT COUNT(i.id) AS count
       FROM interviews i
       LEFT JOIN interview_feedback f ON i.id = f.interview_id
       WHERE i.interviewer_id = ?
         AND i.status != 'CANCELLED'
         AND i.scheduled_at_utc <= ?
         AND f.id IS NULL;`,
      [interviewerId, nowIso]
    );
    const pendingFeedbackCount = pendingRow?.count || 0;

    // 5. Upcoming assigned interviews list
    const upcomingInterviews = this.db.query<{
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
    }>(
      `SELECT i.id, i.scheduled_at_utc, i.duration_minutes, i.interview_type, i.location_url, i.status,
              u.first_name || ' ' || u.last_name AS candidate_name,
              u.email AS candidate_email,
              j.title AS job_title,
              d.name AS department_name
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN departments d ON j.department_id = d.id
       JOIN users u ON a.applicant_id = u.id
       WHERE i.interviewer_id = ?
         AND i.status = 'SCHEDULED'
         AND i.scheduled_at_utc >= ?
       ORDER BY i.scheduled_at_utc ASC
       LIMIT 10;`,
      [interviewerId, nowIso]
    );

    // 6. Recent submitted evaluations
    const recentEvaluations = this.db.query<{
      id: string;
      interview_id: string;
      rating: number;
      recommendation: string;
      candidate_name: string;
      job_title: string;
      created_at: string;
    }>(
      `SELECT f.id, f.interview_id, f.rating, f.recommendation, f.submitted_at AS created_at,
              u.first_name || ' ' || u.last_name AS candidate_name,
              j.title AS job_title
       FROM interview_feedback f
       JOIN interviews i ON f.interview_id = i.id
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       JOIN users u ON a.applicant_id = u.id
       WHERE f.interviewer_id = ?
       ORDER BY f.submitted_at DESC
       LIMIT 5;`,
      [interviewerId]
    );

    return {
      metrics: {
        upcomingInterviewsCount,
        pastInterviewsCount,
        completedEvaluationsCount,
        pendingFeedbackCount,
      },
      upcomingInterviews,
      recentEvaluations,
    };
  }

  async getHrAnalytics(companyId: string): Promise<HrAnalyticsDTO> {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();

    // 1. Job counts
    const jobStatusRows = this.db.query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count
       FROM jobs
       WHERE company_id = ? AND deleted_at IS NULL
       GROUP BY status;`,
      [companyId]
    );

    let activeJobs = 0;
    let draftJobs = 0;
    let closedJobs = 0;
    let totalJobs = 0;

    for (const r of jobStatusRows) {
      totalJobs += r.count;
      if (r.status === 'PUBLISHED') activeJobs += r.count;
      else if (r.status === 'DRAFT') draftJobs += r.count;
      else if (r.status === 'CLOSED') closedJobs += r.count;
    }

    // 2. Application status breakdown
    const appStatusRows = this.db.query<{ status: string; count: number }>(
      `SELECT a.status, COUNT(a.id) AS count
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE j.company_id = ?
       GROUP BY a.status;`,
      [companyId]
    );

    const appCounts: Record<string, number> = {};
    let totalApps = 0;
    for (const r of appStatusRows) {
      appCounts[r.status] = r.count;
      totalApps += r.count;
    }

    // 3. Interview counts
    const intRows = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(i.id) AS total
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       WHERE j.company_id = ?;`,
      [companyId]
    );
    const totalInterviewsCount = intRows?.total || 0;

    // 4. Department metrics
    const deptRows = this.db.query<{
      department_id: string;
      department_name: string;
      job_count: number;
      active_job_count: number;
      application_count: number;
      hired_count: number;
    }>(
      `SELECT d.id AS department_id,
              d.name AS department_name,
              COUNT(DISTINCT j.id) AS job_count,
              COUNT(DISTINCT CASE WHEN j.status = 'PUBLISHED' AND j.deleted_at IS NULL THEN j.id END) AS active_job_count,
              COUNT(a.id) AS application_count,
              COUNT(CASE WHEN a.status = 'HIRED' THEN a.id END) AS hired_count
       FROM departments d
       LEFT JOIN jobs j ON d.id = j.department_id AND j.deleted_at IS NULL
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE d.company_id = ?
       GROUP BY d.id, d.name
       ORDER BY d.name ASC;`,
      [companyId]
    );

    // 5. Hiring trends (applications and hires grouped by date)
    const trendsRows = this.db.query<{
      date: string;
      applications_count: number;
      hired_count: number;
    }>(
      `SELECT substr(a.applied_at, 1, 10) AS date,
              COUNT(a.id) AS applications_count,
              COUNT(CASE WHEN a.status = 'HIRED' THEN a.id END) AS hired_count
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE j.company_id = ?
         AND a.applied_at >= ?
       GROUP BY substr(a.applied_at, 1, 10)
       ORDER BY date ASC;`,
      [companyId, thirtyDaysAgoIso]
    );

    return {
      metrics: {
        totalJobsCount: totalJobs,
        activeJobsCount: activeJobs,
        draftJobsCount: draftJobs,
        closedJobsCount: closedJobs,
        totalApplicationsCount: totalApps,
        totalInterviewsCount,
        hiredCount: appCounts['HIRED'] || 0,
        selectedCount: appCounts['SELECTED'] || 0,
        shortlistedCount: appCounts['SHORTLISTED'] || 0,
        interviewScheduledCount: appCounts['INTERVIEW_SCHEDULED'] || 0,
        appliedCount: appCounts['APPLIED'] || 0,
        rejectedCount: appCounts['REJECTED'] || 0,
      },
      departmentMetrics: deptRows,
      hiringTrends: trendsRows,
    };
  }

  async getAdminAnalytics(): Promise<AdminAnalyticsDTO> {
    // 1. Users count and active status
    const userRows = this.db.query<{ role: string; is_active: number; count: number }>(
      `SELECT role, is_active, COUNT(*) AS count
       FROM users
       WHERE deleted_at IS NULL
       GROUP BY role, is_active;`
    );

    let totalUsers = 0;
    let activeUsers = 0;
    let deactivatedUsers = 0;
    const usersByRole = {
      APPLICANT: 0,
      RECRUITER: 0,
      INTERVIEWER: 0,
      HR_MANAGER: 0,
      ADMIN: 0,
    };

    for (const r of userRows) {
      totalUsers += r.count;
      if (r.is_active === 1) activeUsers += r.count;
      else deactivatedUsers += r.count;

      if (r.role in usersByRole) {
        usersByRole[r.role as keyof typeof usersByRole] += r.count;
      }
    }

    // 2. Companies
    const companyRow = this.db.queryOne<{ total: number; active: number }>(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN is_active = 1 THEN 1 END) AS active
       FROM companies;`
    );

    // 3. Jobs
    const jobRow = this.db.queryOne<{ total: number; published: number }>(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END) AS published
       FROM jobs
       WHERE deleted_at IS NULL;`
    );

    // 4. Applications
    const appRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM applications;`
    );

    // 5. Interviews
    const intRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM interviews;`
    );

    // 6. Audit logs total
    const auditRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM audit_logs;`
    );

    // 7. Recent audit logs (latest 10)
    const recentAuditLogs = this.db.query<{
      id: string;
      actor_id: string | null;
      actor_email: string | null;
      actor_role: string | null;
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: string;
    }>(
      `SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.created_at,
              u.email AS actor_email,
              u.role AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 10;`
    );

    return {
      metrics: {
        totalUsersCount: totalUsers,
        activeUsersCount: activeUsers,
        deactivatedUsersCount: deactivatedUsers,
        totalCompaniesCount: companyRow?.total || 0,
        activeCompaniesCount: companyRow?.active || 0,
        totalJobsCount: jobRow?.total || 0,
        publishedJobsCount: jobRow?.published || 0,
        totalApplicationsCount: appRow?.total || 0,
        totalInterviewsCount: intRow?.total || 0,
        totalAuditLogsCount: auditRow?.total || 0,
      },
      usersByRole,
      recentAuditLogs,
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();
