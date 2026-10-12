import { AppError } from '../middleware/errorHandler.js';
import { withTransaction } from '../db/transactions.js';
import {
  CreateJobSchema,
  CreateJobInputSchema,
  UpdateJobInputSchema,
  validateJobForPublication,
  isValidJobStatusTransition,
  CreateApplicationSchema,
  CreateApplicationInputSchema,
  UpdateApplicationStatusSchema,
  isValidApplicationStatusTransition,
  CreateInterviewSchema,
  CreateInterviewInputSchema,
  RescheduleInterviewInputSchema,
  CancelInterviewInputSchema,
  SubmitInterviewFeedbackSchema,
  SubmitInterviewFeedbackInputSchema,
} from '../domain/validation.js';
import {
  jobRepository,
  type JobWithDetails,
  type PublicJob,
  type JobSearchParams,
} from '../repositories/jobRepository.js';
import { companyRepository, departmentRepository } from '../repositories/companyRepository.js';
import { applicationRepository, type ApplicationWithDetails, type ApplicationStatusHistoryWithActor } from '../repositories/applicationRepository.js';
import { interviewRepository, type InterviewWithDetails } from '../repositories/interviewRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { resumeRepository } from '../repositories/applicantProfileRepository.js';
import { notificationRepository, auditLogRepository } from '../repositories/notificationRepository.js';
import type {
  Job,
  JobStatus,
  Application,
  ApplicationStatus,
  Interview,
  InterviewFeedback,
  Company,
  Department,
} from '../domain/entities.js';
import type { AccessTokenPayload } from '../types/index.js';
import { getDatabase } from '../db/connection.js';

export class JobService {
  /**
   * Internal / Test creation method using full domain entity schema.
   */
  async createJob(data: unknown): Promise<Job> {
    const validated = CreateJobSchema.parse(data);
    const job = await jobRepository.create({
      ...validated,
      salary_min: validated.salary_min ?? null,
      salary_max: validated.salary_max ?? null,
      deadline_utc: validated.deadline_utc ?? null,
    });
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: validated.created_by,
      action: 'JOB_CREATED',
      entity_type: 'JOB',
      entity_id: job.id,
      metadata_json: JSON.stringify({ title: job.title, company_id: job.company_id }),
    });
    return job;
  }

  /**
   * Recruiter / HR create job workflow:
   * 1. Authenticates & Authorizes caller.
   * 2. Derives authoritative company scope from req.user (ignoring any spoofed frontend companyId).
   * 3. Verifies related Company and Department existence.
   * 4. Enforces default DRAFT status.
   * 5. Returns persisted record with company/dept metadata.
   */
  async createRecruiterJob(caller: AccessTokenPayload, data: unknown): Promise<JobWithDetails> {
    const companyId = caller.role === 'ADMIN' ? (data as any)?.company_id || caller.companyId : caller.companyId;
    if (!companyId) {
      throw new AppError(
        403,
        'NO_COMPANY_ASSIGNED',
        'Recruiter is not assigned to an active organization. Please link a company profile first.'
      );
    }

    const company = await companyRepository.findById(companyId);
    if (!company) {
      throw new AppError(400, 'INVALID_COMPANY', 'Referenced organization does not exist in the platform.');
    }

    const validated = CreateJobInputSchema.parse(data);

    // Verify department belongs to the caller's company
    const department = await departmentRepository.findById(validated.department_id);
    if (!department || department.company_id !== companyId) {
      throw new AppError(
        400,
        'INVALID_DEPARTMENT',
        'Selected department does not exist or does not belong to your organization.'
      );
    }

    if (
      validated.salary_min !== null &&
      validated.salary_min !== undefined &&
      validated.salary_max !== null &&
      validated.salary_max !== undefined &&
      validated.salary_min > validated.salary_max
    ) {
      throw new AppError(400, 'INVALID_SALARY_RANGE', 'Minimum salary cannot exceed maximum salary.');
    }

    if (validated.deadline_utc) {
      const deadline = new Date(validated.deadline_utc).getTime();
      if (isNaN(deadline) || deadline <= Date.now()) {
        throw new AppError(400, 'INVALID_DEADLINE', 'Application deadline must be a valid future UTC timestamp.');
      }
    }

    const newJobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    await jobRepository.create({
      id: newJobId,
      company_id: companyId,
      department_id: validated.department_id,
      created_by: caller.sub,
      title: validated.title.trim(),
      description: validated.description,
      requirements: validated.requirements,
      location: validated.location.trim(),
      employment_type: validated.employment_type,
      experience_level: validated.experience_level,
      salary_min: validated.salary_min ?? null,
      salary_max: validated.salary_max ?? null,
      status: 'DRAFT',
      deadline_utc: validated.deadline_utc ?? null,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'JOB_DRAFT_CREATED',
      entity_type: 'JOB',
      entity_id: newJobId,
      metadata_json: JSON.stringify({ title: validated.title, company_id: companyId, status: 'DRAFT' }),
    });

    return (await jobRepository.findByIdWithDetails(newJobId))!;
  }

  /**
   * Recruiter / HR edit job workflow according to lifecycle policy:
   * - DRAFT: fully editable by authorized recruiter in same company.
   * - PUBLISHED: description, requirements, location, salary, deadline editable; status cannot change here.
   * - CLOSED: strictly immutable to preserve historical integrity.
   */
  async updateJob(caller: AccessTokenPayload, jobId: string, data: unknown): Promise<JobWithDetails> {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    // Object-level authorization & company isolation (IDOR defense)
    if (caller.role !== 'ADMIN' && job.company_id !== caller.companyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Cross-organization modification denied. You can only manage jobs within your assigned company.'
      );
    }

    if (job.status === 'CLOSED') {
      throw new AppError(
        400,
        'CLOSED_JOB_IMMUTABLE',
        'Closed recruitment positions cannot be edited to preserve historical application integrity.'
      );
    }

    const validated = UpdateJobInputSchema.parse(data);

    if (job.status === 'PUBLISHED') {
      // In published state, department changes or title modifications that change the core role are restricted
      if (validated.department_id && validated.department_id !== job.department_id) {
        throw new AppError(
          400,
          'PUBLISHED_FIELD_RESTRICTED',
          'Department cannot be changed on an actively published job.'
        );
      }
    }

    if (validated.department_id) {
      const department = await departmentRepository.findById(validated.department_id);
      if (!department || department.company_id !== job.company_id) {
        throw new AppError(
          400,
          'INVALID_DEPARTMENT',
          'Department does not belong to the authorized organization.'
        );
      }
    }

    const minSalary = validated.salary_min !== undefined ? validated.salary_min : job.salary_min;
    const maxSalary = validated.salary_max !== undefined ? validated.salary_max : job.salary_max;
    if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
      throw new AppError(400, 'INVALID_SALARY_RANGE', 'Minimum salary cannot exceed maximum salary.');
    }

    if (validated.deadline_utc) {
      const deadline = new Date(validated.deadline_utc).getTime();
      if (isNaN(deadline) || deadline <= Date.now()) {
        throw new AppError(400, 'INVALID_DEADLINE', 'Application deadline must be a valid future UTC timestamp.');
      }
    }

    await jobRepository.update(jobId, {
      title: job.status === 'DRAFT' ? validated.title : undefined,
      description: validated.description,
      requirements: validated.requirements,
      location: validated.location,
      employment_type: job.status === 'DRAFT' ? validated.employment_type : undefined,
      experience_level: job.status === 'DRAFT' ? validated.experience_level : undefined,
      department_id: job.status === 'DRAFT' ? validated.department_id : undefined,
      salary_min: validated.salary_min,
      salary_max: validated.salary_max,
      deadline_utc: validated.deadline_utc,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'JOB_UPDATED',
      entity_type: 'JOB',
      entity_id: jobId,
      metadata_json: JSON.stringify({ jobId, callerRole: caller.role }),
    });

    return (await jobRepository.findByIdWithDetails(jobId))!;
  }

  /**
   * Recruiter / HR publish job workflow:
   * Validates server-side that all required publishable fields (including future deadline) are met.
   */
  async publishJob(
    caller: AccessTokenPayload,
    jobId: string,
    options?: { deadline_utc?: string }
  ): Promise<JobWithDetails> {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    if (caller.role !== 'ADMIN' && job.company_id !== caller.companyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Cross-organization action denied. You can only publish jobs within your assigned company.'
      );
    }

    if (job.status === 'PUBLISHED') {
      throw new AppError(400, 'ALREADY_PUBLISHED', 'This job position is already actively published.');
    }

    if (job.status === 'CLOSED') {
      throw new AppError(
        400,
        'INVALID_JOB_STATUS_TRANSITION',
        'Closed job positions cannot be republished. Please create a new job requisition.'
      );
    }

    if (options?.deadline_utc) {
      await jobRepository.update(jobId, { deadline_utc: options.deadline_utc });
      job.deadline_utc = options.deadline_utc;
    }

    // Server-side validation of publishability invariants
    const validationErrors = validateJobForPublication(job);
    if (validationErrors.length > 0) {
      throw new AppError(
        400,
        'JOB_PUBLISH_VALIDATION_FAILED',
        `Cannot publish job: ${validationErrors.join('; ')}`,
        { errors: validationErrors }
      );
    }

    await jobRepository.updateStatus(jobId, 'PUBLISHED');

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'JOB_PUBLISHED',
      entity_type: 'JOB',
      entity_id: jobId,
      metadata_json: JSON.stringify({ jobId, status: 'PUBLISHED' }),
    });

    return (await jobRepository.findByIdWithDetails(jobId))!;
  }

  /**
   * Close job workflow:
   * Transitions from PUBLISHED to CLOSED. Persists in DB. Removes from open applications.
   */
  async closeJob(caller: AccessTokenPayload, jobId: string): Promise<JobWithDetails> {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    if (caller.role !== 'ADMIN' && job.company_id !== caller.companyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Cross-organization action denied. You can only close jobs within your assigned company.'
      );
    }

    if (job.status === 'CLOSED') {
      throw new AppError(400, 'ALREADY_CLOSED', 'This job position is already closed.');
    }

    await jobRepository.updateStatus(jobId, 'CLOSED');

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'JOB_CLOSED',
      entity_type: 'JOB',
      entity_id: jobId,
      metadata_json: JSON.stringify({ jobId, previousStatus: job.status, newStatus: 'CLOSED' }),
    });

    return (await jobRepository.findByIdWithDetails(jobId))!;
  }

  /**
   * Public Job Details:
   * Strips all internal metadata (created_by, internal ids, notes).
   * Rejects DRAFT jobs with 404 to guarantee zero leakage.
   */
  async getPublicJob(jobId: string): Promise<PublicJob> {
    const job = await jobRepository.findByIdWithDetails(jobId);
    if (!job || job.deleted_at !== null) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job position not found or no longer active.');
    }

    if (job.status === 'DRAFT') {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job position not found or not published.');
    }

    return {
      id: job.id,
      title: job.title,
      company_name: job.company_name || 'Organization',
      company_location: job.company_location,
      department_name: job.department_name || 'General',
      location: job.location,
      employment_type: job.employment_type,
      experience_level: job.experience_level,
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      status: job.status as 'PUBLISHED' | 'CLOSED',
      deadline_utc: job.deadline_utc,
      created_at: job.created_at,
    };
  }

  /**
   * Internal Job Details for authorized Recruiter / HR / Admin.
   */
  async getInternalJob(caller: AccessTokenPayload, jobId: string): Promise<JobWithDetails> {
    const job = await jobRepository.findByIdWithDetails(jobId);
    if (!job || job.deleted_at !== null) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    if (caller.role !== 'ADMIN' && job.company_id !== caller.companyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Cross-organization read denied. You can only view jobs within your assigned company.'
      );
    }

    return job;
  }

  /**
   * Public universal job discovery with search, filter, sort, pagination:
   * Draft jobs are strictly excluded server-side.
   */
  async searchPublicJobs(
    params: JobSearchParams
  ): Promise<{ content: PublicJob[]; page: number; size: number; totalElements: number; totalPages: number }> {
    const { jobs, total } = await jobRepository.searchPublished(params);
    const content: PublicJob[] = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      company_name: job.company_name || 'Organization',
      company_location: job.company_location,
      department_name: job.department_name || 'General',
      location: job.location,
      employment_type: job.employment_type,
      experience_level: job.experience_level,
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      status: 'PUBLISHED',
      deadline_utc: job.deadline_utc,
      created_at: job.created_at,
    }));

    const page = Math.max(0, Number(params.page) || 0);
    const size = Math.min(100, Math.max(1, Number(params.size) || 20));
    const totalPages = Math.ceil(total / size);

    return {
      content,
      page,
      size,
      totalElements: total,
      totalPages,
    };
  }

  /**
   * List jobs for recruiter's company (all statuses or filtered).
   */
  async listRecruiterJobs(caller: AccessTokenPayload, status?: string): Promise<JobWithDetails[]> {
    if (caller.role !== 'ADMIN' && !caller.companyId) {
      return [];
    }

    const companyId = caller.role === 'ADMIN' ? caller.companyId || '' : caller.companyId!;
    if (!companyId) {
      return [];
    }

    return jobRepository.listByCompany(companyId, status);
  }

  // Recruiter Organization & Department Helpers
  async getRecruiterCompany(caller: AccessTokenPayload): Promise<Company | null> {
    if (!caller.companyId) return null;
    return companyRepository.findById(caller.companyId);
  }

  async listRecruiterDepartments(caller: AccessTokenPayload): Promise<Department[]> {
    if (!caller.companyId) return [];
    return departmentRepository.listByCompany(caller.companyId);
  }

  async createDepartment(caller: AccessTokenPayload, name: string): Promise<Department> {
    if (!caller.companyId) {
      throw new AppError(403, 'NO_COMPANY_ASSIGNED', 'No company assigned to recruiter.');
    }
    if (!name || !name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Department name is required.');
    }

    const id = `dept-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    return departmentRepository.create({
      id,
      company_id: caller.companyId,
      name: name.trim(),
    });
  }

  async setupCompany(
    caller: AccessTokenPayload,
    data: { name: string; industry?: string; location?: string; domain?: string; size?: string }
  ): Promise<Company> {
    if (caller.companyId) {
      const existing = await companyRepository.findById(caller.companyId);
      if (existing) return existing;
    }

    if (!data.name || !data.name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Organization name is required.');
    }

    const companyId = `comp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const company = await companyRepository.create({
      id: companyId,
      name: data.name.trim(),
      industry: data.industry || 'Technology',
      location: data.location || 'Remote',
      domain: data.domain || `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      size: data.size || '50-200',
    });

    // Create default department
    await departmentRepository.create({
      id: `dept-${Date.now().toString(36)}-gen`,
      company_id: companyId,
      name: 'Engineering',
    });

    // Link user to company
    await userRepository.updateCompany(caller.sub, companyId);

    return company;
  }

  async transitionJobStatus(jobId: string, newStatus: JobStatus, actorId: string): Promise<Job> {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${jobId} does not exist`);
    }

    if (!isValidJobStatusTransition(job.status, newStatus)) {
      throw new AppError(
        400,
        'INVALID_JOB_STATUS_TRANSITION',
        `Cannot transition job from ${job.status} to ${newStatus}`
      );
    }

    await jobRepository.updateStatus(jobId, newStatus);
    const updated = (await jobRepository.findById(jobId))!;

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: actorId,
      action: `JOB_STATUS_${newStatus}`,
      entity_type: 'JOB',
      entity_id: jobId,
      metadata_json: JSON.stringify({ from: job.status, to: newStatus }),
    });

    return updated;
  }
}

export class ApplicationService {
  async applyForJob(callerOrData: AccessTokenPayload | unknown, maybeData?: unknown): Promise<Application> {
    let validated: { id: string; job_id: string; applicant_id: string; resume_id: string; cover_letter?: string | null };

    if (maybeData !== undefined) {
      const caller = callerOrData as AccessTokenPayload;
      if (caller.role !== 'APPLICANT') {
        throw new AppError(403, 'FORBIDDEN', 'Only candidates with APPLICANT role can submit job applications.');
      }
      const input = CreateApplicationInputSchema.parse(maybeData);
      validated = {
        id: (maybeData as any).id || `app-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        job_id: input.job_id,
        applicant_id: caller.sub,
        resume_id: input.resume_id,
        cover_letter: input.cover_letter ?? null,
      };
    } else {
      validated = CreateApplicationSchema.parse(callerOrData);
    }

    // 1. Verify Job exists and is PUBLISHED
    const job = await jobRepository.findById(validated.job_id);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Job ${validated.job_id} not found`);
    }
    if (job.status !== 'PUBLISHED') {
      throw new AppError(
        400,
        'JOB_NOT_PUBLISHED',
        `Applications cannot be submitted to ${job.status} jobs`
      );
    }

    // 2. Enforce deadline if configured
    if (job.deadline_utc) {
      const deadline = new Date(job.deadline_utc).getTime();
      if (Date.now() > deadline) {
        throw new AppError(400, 'APPLICATION_DEADLINE_EXPIRED', 'Application deadline for this job has passed');
      }
    }

    // 3. Prevent duplicate applications (Strict Master Prompt Rule)
    const existing = await applicationRepository.findByJobAndApplicant(
      validated.job_id,
      validated.applicant_id
    );
    if (existing) {
      throw new AppError(
        409,
        'DUPLICATE_APPLICATION',
        'You have already submitted an application for this job position'
      );
    }

    // 4. Verify Resume exists and belongs to applicant
    const resume = await resumeRepository.findById(validated.resume_id);
    if (!resume || resume.applicant_id !== validated.applicant_id) {
      throw new AppError(
        400,
        'INVALID_RESUME',
        'Specified resume does not exist or does not belong to the applicant'
      );
    }

    // 5. Create application with initial APPLIED status
    const app = await applicationRepository.create({
      id: validated.id,
      job_id: validated.job_id,
      applicant_id: validated.applicant_id,
      resume_id: validated.resume_id,
      status: 'APPLIED',
      cover_letter: validated.cover_letter ?? null,
    });

    // 6. Generate domain notifications for applicant and job recruiter
    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: validated.applicant_id,
      type: 'APPLICATION_SUBMITTED',
      title: 'Application Received',
      message: `Your application for "${job.title}" has been successfully submitted.`,
      entity_type: 'APPLICATION',
      entity_id: app.id,
    });

    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: job.created_by,
      type: 'NEW_APPLICATION_RECEIVED',
      title: 'New Candidate Application',
      message: `A new application has been submitted for position "${job.title}".`,
      entity_type: 'APPLICATION',
      entity_id: app.id,
    });

    // 7. Audit log
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: validated.applicant_id,
      action: 'APPLICATION_SUBMITTED',
      entity_type: 'APPLICATION',
      entity_id: app.id,
      metadata_json: JSON.stringify({ job_id: job.id, job_title: job.title }),
    });

    return app;
  }

  async listApplicantApplications(caller: AccessTokenPayload): Promise<ApplicationWithDetails[]> {
    if (caller.role !== 'APPLICANT') {
      throw new AppError(403, 'FORBIDDEN', 'Only candidates with APPLICANT role can access their applications.');
    }
    return applicationRepository.listByApplicantWithDetails(caller.sub);
  }

  async listCompanyApplications(
    caller: AccessTokenPayload,
    jobId?: string,
    status?: string
  ): Promise<ApplicationWithDetails[]> {
    if (caller.role !== 'RECRUITER' && caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Role "${caller.role}" is not authorized to list candidate applications.`);
    }

    if (caller.role !== 'ADMIN' && !caller.companyId) {
      return [];
    }

    const companyId = caller.role === 'ADMIN' ? (caller.companyId || '') : caller.companyId!;
    return applicationRepository.listByCompanyWithDetails(companyId, jobId, status);
  }

  async getApplicationDetails(
    caller: AccessTokenPayload,
    applicationId: string
  ): Promise<{ application: ApplicationWithDetails; history: ApplicationStatusHistoryWithActor[] }> {
    const app = await applicationRepository.findByIdWithDetails(applicationId);
    if (!app) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', `Application ${applicationId} not found`);
    }

    if (caller.role === 'APPLICANT') {
      if (app.applicant_id !== caller.sub) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to this application.');
      }
    } else if (caller.role === 'RECRUITER' || caller.role === 'HR_MANAGER') {
      if (app.company_id !== caller.companyId) {
        throw new AppError(403, 'FORBIDDEN_COMPANY_SCOPE', 'Cross-organization access denied.');
      }
    } else if (caller.role === 'INTERVIEWER') {
      if (app.company_id !== caller.companyId) {
        throw new AppError(403, 'FORBIDDEN', 'Cross-organization access denied.');
      }
    } else if (caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Access denied.');
    }

    const history = await applicationRepository.getStatusHistoryWithActors(applicationId);
    return { application: app, history };
  }

  async transitionStatus(
    arg1: AccessTokenPayload | string,
    arg2: ApplicationStatus | string,
    arg3?: string | ApplicationStatus,
    arg4?: string
  ): Promise<Application> {
    let applicationId: string;
    let toStatus: ApplicationStatus;
    let changedBy: string;
    let note: string | undefined;

    if (typeof arg1 === 'object' && arg1 !== null && 'role' in arg1) {
      const caller = arg1 as AccessTokenPayload;
      if (caller.role !== 'RECRUITER' && caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
        throw new AppError(403, 'FORBIDDEN', `Role "${caller.role}" is not authorized to change application status.`);
      }

      applicationId = arg2 as string;
      toStatus = arg3 as ApplicationStatus;
      note = arg4;
      changedBy = caller.sub;

      const current = await applicationRepository.findByIdWithDetails(applicationId);
      if (!current) {
        throw new AppError(404, 'APPLICATION_NOT_FOUND', `Application ${applicationId} not found`);
      }

      if (caller.role !== 'ADMIN' && current.company_id !== caller.companyId) {
        throw new AppError(
          403,
          'FORBIDDEN_COMPANY_SCOPE',
          'Cross-organization action denied. You can only manage applications within your assigned company.'
        );
      }
    } else {
      applicationId = arg1 as string;
      toStatus = arg2 as ApplicationStatus;
      changedBy = arg3 as string;
      note = arg4;
    }

    const current = await applicationRepository.findById(applicationId);
    if (!current) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', `Application ${applicationId} not found`);
    }

    if (!isValidApplicationStatusTransition(current.status, toStatus)) {
      throw new AppError(
        400,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition application from ${current.status} to ${toStatus}`
      );
    }

    const updated = await applicationRepository.updateStatus(applicationId, toStatus, changedBy, note);

    const job = await jobRepository.findById(current.job_id);
    const jobTitle = job?.title || 'the position';
    let notifTitle = `Application Status Updated: ${toStatus}`;
    let notifMsg = `Your application status has been updated to ${toStatus}.`;

    if (toStatus === 'SHORTLISTED') {
      notifTitle = 'Application Shortlisted';
      notifMsg = `Congratulations! Your application for "${jobTitle}" has been shortlisted for further evaluation.`;
    } else if (toStatus === 'SELECTED') {
      notifTitle = 'Candidate Selected';
      notifMsg = `Congratulations! You have been selected for position "${jobTitle}".`;
    } else if (toStatus === 'HIRED') {
      notifTitle = 'Offer Extended / Hired';
      notifMsg = `Congratulations! You have been marked as hired for position "${jobTitle}". Welcome to the team!`;
    } else if (toStatus === 'REJECTED') {
      notifTitle = 'Application Update';
      notifMsg = `Thank you for your interest in "${jobTitle}". At this time, the recruitment team has decided not to move forward with your application.`;
    }

    // Notify candidate
    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: current.applicant_id,
      type: `APPLICATION_${toStatus}`,
      title: notifTitle,
      message: notifMsg,
      entity_type: 'APPLICATION',
      entity_id: applicationId,
    });

    // Audit log
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: changedBy,
      action: `APPLICATION_STATUS_${toStatus}`,
      entity_type: 'APPLICATION',
      entity_id: applicationId,
      metadata_json: JSON.stringify({ from: current.status, to: toStatus, note }),
    });

    return updated;
  }
}

export class InterviewService {
  async scheduleInterview(callerOrData: AccessTokenPayload | unknown, maybeData?: unknown): Promise<Interview> {
    let caller: AccessTokenPayload | undefined;
    let input: any;
    let schedulerId: string;

    if (maybeData !== undefined) {
      caller = callerOrData as AccessTokenPayload;
      if (caller.role !== 'RECRUITER' && caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
        throw new AppError(403, 'FORBIDDEN', `Access denied. Role "${caller.role}" is not authorized to schedule interviews.`);
      }
      if (caller.role !== 'ADMIN' && !caller.companyId) {
        throw new AppError(403, 'NO_COMPANY_ASSIGNED', 'No company assigned to recruiter.');
      }
      input = CreateInterviewInputSchema.parse(maybeData);
      schedulerId = caller.sub;
    } else {
      input = CreateInterviewSchema.parse(callerOrData);
      schedulerId = input.scheduled_by;
    }

    // Verify application existence and details
    const app = await applicationRepository.findByIdWithDetails(input.application_id);
    if (!app) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', `Application ${input.application_id} not found`);
    }

    // Tenancy isolation (Cross-company IDOR defense)
    if (caller && caller.role !== 'ADMIN') {
      if (app.company_id !== caller.companyId) {
        throw new AppError(
          403,
          'FORBIDDEN_COMPANY_SCOPE',
          'Cross-organization action denied. You can only schedule interviews for applications within your assigned company.'
        );
      }
    }

    // Verify application state: must be SHORTLISTED or INTERVIEW_SCHEDULED
    if (app.status !== 'SHORTLISTED' && app.status !== 'INTERVIEW_SCHEDULED') {
      throw new AppError(
        400,
        'INVALID_APPLICATION_STATE',
        `Interviews can only be scheduled for candidates in SHORTLISTED or INTERVIEW_SCHEDULED state. Current status: ${app.status}.`
      );
    }

    // Verify assigned interviewer
    const interviewer = await userRepository.findById(input.interviewer_id);
    if (!interviewer) {
      throw new AppError(404, 'INTERVIEWER_NOT_FOUND', `Interviewer ${input.interviewer_id} not found`);
    }
    if (interviewer.role !== 'INTERVIEWER') {
      throw new AppError(400, 'INVALID_INTERVIEWER_ROLE', 'Assigned user must have the INTERVIEWER role.');
    }
    if (interviewer.account_status !== 'ACTIVE') {
      throw new AppError(400, 'INTERVIEWER_INACTIVE', 'Assigned interviewer account is not active.');
    }

    // Verify date/time: must be valid future UTC
    const scheduledTime = new Date(input.scheduled_at_utc).getTime();
    if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
      throw new AppError(400, 'INVALID_INTERVIEW_DATE', 'Interview must be scheduled for a future UTC date and time.');
    }

    // Double-booking conflict check
    const duration = input.duration_minutes || 45;
    const hasConflict = await interviewRepository.checkInterviewerConflict(
      input.interviewer_id,
      input.scheduled_at_utc,
      duration
    );
    if (hasConflict) {
      throw new AppError(
        409,
        'INTERVIEWER_CONFLICT',
        'The selected interviewer already has a scheduled interview during this time window. Please choose another time or interviewer.'
      );
    }

    const interviewId = input.id || `int-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // Atomic transaction: create interview + transition Application to INTERVIEW_SCHEDULED + write history
    const interview = await withTransaction(async ({ db: txDb }) => {
      txDb.execute(
        `INSERT INTO interviews (
          id, application_id, interviewer_id, scheduled_by, scheduled_at_utc,
          duration_minutes, status, interview_type, location_url, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?);`,
        [
          interviewId,
          input.application_id,
          input.interviewer_id,
          schedulerId,
          input.scheduled_at_utc,
          duration,
          input.interview_type || 'ONLINE',
          input.location_url || null,
          input.notes || null,
          now,
          now,
        ]
      );

      // Transition application to INTERVIEW_SCHEDULED if currently SHORTLISTED
      if (app.status === 'SHORTLISTED') {
        txDb.execute(
          "UPDATE applications SET status = 'INTERVIEW_SCHEDULED', updated_at = ? WHERE id = ?;",
          [now, app.id]
        );
        const historyId = `hist-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        txDb.execute(
          `INSERT INTO application_status_history (id, application_id, from_status, to_status, changed_by, note, changed_at)
           VALUES (?, ?, 'SHORTLISTED', 'INTERVIEW_SCHEDULED', ?, 'Interview scheduled', ?);`,
          [historyId, app.id, schedulerId, now]
        );
      }

      return (txDb.queryOne<Interview>('SELECT * FROM interviews WHERE id = ?;', [interviewId]))!;
    });

    // Notify candidate and interviewer
    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: app.applicant_id,
      type: 'INTERVIEW_SCHEDULED',
      title: 'Interview Scheduled',
      message: `An interview has been scheduled for ${input.scheduled_at_utc}.`,
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
    });

    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: input.interviewer_id,
      type: 'INTERVIEW_ASSIGNED',
      title: 'New Interview Assignment',
      message: `You have been assigned an interview on ${input.scheduled_at_utc}.`,
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: schedulerId,
      action: 'INTERVIEW_SCHEDULED',
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
      metadata_json: JSON.stringify({ application_id: app.id, interviewer_id: input.interviewer_id }),
    });

    return interview;
  }

  async rescheduleInterview(caller: AccessTokenPayload, interviewId: string, data: unknown): Promise<Interview> {
    if (caller.role !== 'RECRUITER' && caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Access denied. Role "${caller.role}" cannot reschedule interviews.`);
    }

    const validated = RescheduleInterviewInputSchema.parse(data);
    const interview = await interviewRepository.findByIdWithDetails(interviewId);
    if (!interview) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', `Interview ${interviewId} not found`);
    }

    if (caller.role !== 'ADMIN' && interview.company_id !== caller.companyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Cross-organization action denied. You can only reschedule interviews within your assigned company.'
      );
    }

    if (interview.status === 'CANCELLED') {
      throw new AppError(400, 'CANNOT_RESCHEDULE_CANCELLED', 'Cancelled interviews cannot be rescheduled. Please schedule a new interview.');
    }
    if (interview.status === 'COMPLETED') {
      throw new AppError(400, 'CANNOT_RESCHEDULE_COMPLETED', 'Completed interviews cannot be rescheduled.');
    }

    const newTime = new Date(validated.scheduled_at_utc).getTime();
    if (isNaN(newTime) || newTime <= Date.now()) {
      throw new AppError(400, 'INVALID_INTERVIEW_DATE', 'Rescheduled interview must be for a future UTC date and time.');
    }

    const duration = validated.duration_minutes || interview.duration_minutes;
    const hasConflict = await interviewRepository.checkInterviewerConflict(
      interview.interviewer_id,
      validated.scheduled_at_utc,
      duration,
      interview.id
    );
    if (hasConflict) {
      throw new AppError(
        409,
        'INTERVIEWER_CONFLICT',
        'The assigned interviewer already has a scheduled interview during the rescheduled time window.'
      );
    }

    const updated = await interviewRepository.reschedule(
      interviewId,
      validated.scheduled_at_utc,
      duration,
      validated.reason || undefined
    );

    // Notify candidate and interviewer
    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: interview.applicant_id,
      type: 'INTERVIEW_RESCHEDULED',
      title: 'Interview Rescheduled',
      message: `Your interview has been rescheduled to ${validated.scheduled_at_utc}.`,
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
    });

    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: interview.interviewer_id,
      type: 'INTERVIEW_RESCHEDULED',
      title: 'Interview Rescheduled',
      message: `Interview for ${interview.applicant_name} has been rescheduled to ${validated.scheduled_at_utc}.`,
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'INTERVIEW_RESCHEDULED',
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
      metadata_json: JSON.stringify({
        from: interview.scheduled_at_utc,
        to: validated.scheduled_at_utc,
        reason: validated.reason,
      }),
    });

    return updated;
  }

  async cancelInterview(caller: AccessTokenPayload, interviewId: string, reason?: string): Promise<Interview> {
    if (caller.role !== 'RECRUITER' && caller.role !== 'HR_MANAGER' && caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Access denied. Role "${caller.role}" cannot cancel interviews.`);
    }

    const interview = await interviewRepository.findByIdWithDetails(interviewId);
    if (!interview) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', `Interview ${interviewId} not found`);
    }

    if (caller.role !== 'ADMIN' && interview.company_id !== caller.companyId) {
      throw new AppError(
        403,
        'FORBIDDEN_COMPANY_SCOPE',
        'Cross-organization action denied. You can only cancel interviews within your assigned company.'
      );
    }

    if (interview.status === 'CANCELLED') {
      throw new AppError(400, 'ALREADY_CANCELLED', 'This interview is already cancelled.');
    }
    if (interview.status === 'COMPLETED') {
      throw new AppError(400, 'CANNOT_CANCEL_COMPLETED', 'Completed interviews cannot be cancelled.');
    }

    const cancelled = await interviewRepository.cancel(interviewId, reason);

    // Notify candidate and interviewer
    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: interview.applicant_id,
      type: 'INTERVIEW_CANCELLED',
      title: 'Interview Cancelled',
      message: `Your interview scheduled for ${interview.scheduled_at_utc} has been cancelled.`,
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
    });

    await notificationRepository.create({
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: interview.interviewer_id,
      type: 'INTERVIEW_CANCELLED',
      title: 'Interview Cancelled',
      message: `Your interview scheduled for ${interview.scheduled_at_utc} has been cancelled.`,
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'INTERVIEW_CANCELLED',
      entity_type: 'INTERVIEW',
      entity_id: interview.id,
      metadata_json: JSON.stringify({ scheduled_at_utc: interview.scheduled_at_utc, reason }),
    });

    return cancelled;
  }

  async submitFeedback(
    callerOrData: AccessTokenPayload | unknown,
    maybeInterviewIdOrData?: string | unknown,
    maybeData?: unknown
  ): Promise<InterviewFeedback> {
    if (maybeData !== undefined) {
      // API call: (caller, interviewId, body)
      const caller = callerOrData as AccessTokenPayload;
      const interviewId = maybeInterviewIdOrData as string;
      if (caller.role !== 'INTERVIEWER' && caller.role !== 'ADMIN') {
        throw new AppError(403, 'FORBIDDEN', 'Only users with INTERVIEWER role can submit evaluation feedback.');
      }

      const validated = SubmitInterviewFeedbackInputSchema.parse(maybeData);
      const interview = await interviewRepository.findByIdWithDetails(interviewId);
      if (!interview) {
        throw new AppError(404, 'INTERVIEW_NOT_FOUND', `Interview ${interviewId} not found`);
      }

      // Security check: Only assigned interviewer may submit feedback
      if (caller.role !== 'ADMIN' && interview.interviewer_id !== caller.sub) {
        throw new AppError(
          403,
          'UNAUTHORIZED_INTERVIEWER',
          'Only the assigned interviewer is authorized to submit feedback for this interview'
        );
      }

      if (interview.status === 'CANCELLED') {
        throw new AppError(400, 'CANNOT_SUBMIT_FEEDBACK_FOR_CANCELLED', 'Feedback cannot be submitted for a cancelled interview.');
      }

      const feedbackId = `fb-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const feedback = await interviewRepository.submitFeedback({
        id: feedbackId,
        interview_id: interview.id,
        interviewer_id: caller.sub,
        rating: validated.rating,
        notes: validated.notes,
        recommendation: validated.recommendation,
      });

      await auditLogRepository.log({
        id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        actor_id: caller.sub,
        action: 'INTERVIEW_FEEDBACK_SUBMITTED',
        entity_type: 'INTERVIEW_FEEDBACK',
        entity_id: feedback.id,
        metadata_json: JSON.stringify({ rating: feedback.rating, recommendation: feedback.recommendation }),
      });

      // Notify recruiter / scheduler
      await notificationRepository.create({
        id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: interview.scheduled_by,
        type: 'INTERVIEW_FEEDBACK_RECEIVED',
        title: 'Interview Evaluation Submitted',
        message: `Evaluation feedback has been submitted for candidate ${interview.applicant_name} on position "${interview.job_title}".`,
        entity_type: 'INTERVIEW',
        entity_id: interview.id,
      });

      return feedback;
    } else {
      // Programmatic / Test call: submitFeedback(data)
      const validated = SubmitInterviewFeedbackSchema.parse(callerOrData);
      const interview = await interviewRepository.findById(validated.interview_id);
      if (!interview) {
        throw new AppError(404, 'INTERVIEW_NOT_FOUND', `Interview ${validated.interview_id} not found`);
      }

      if (interview.interviewer_id !== validated.interviewer_id) {
        throw new AppError(
          403,
          'UNAUTHORIZED_INTERVIEWER',
          'Only the assigned interviewer is authorized to submit feedback for this interview'
        );
      }

      if (interview.status === 'CANCELLED') {
        throw new AppError(400, 'CANNOT_SUBMIT_FEEDBACK_FOR_CANCELLED', 'Feedback cannot be submitted for a cancelled interview.');
      }

      const feedback = await interviewRepository.submitFeedback(validated);

      await auditLogRepository.log({
        id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        actor_id: validated.interviewer_id,
        action: 'INTERVIEW_FEEDBACK_SUBMITTED',
        entity_type: 'INTERVIEW_FEEDBACK',
        entity_id: feedback.id,
        metadata_json: JSON.stringify({ rating: feedback.rating, recommendation: feedback.recommendation }),
      });

      return feedback;
    }
  }

  async getInterviewById(caller: AccessTokenPayload, interviewId: string): Promise<any> {
    const interview = await interviewRepository.findByIdWithDetails(interviewId);
    if (!interview) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', `Interview ${interviewId} not found`);
    }

    if (caller.role === 'APPLICANT') {
      if (interview.applicant_id !== caller.sub) {
        throw new AppError(403, 'FORBIDDEN_IDOR', 'Access denied to another candidate’s interview schedule.');
      }
      // Sanitized projection for applicant: strictly omit private recruiter notes and internal feedback
      return {
        id: interview.id,
        application_id: interview.application_id,
        job_id: interview.job_id,
        job_title: interview.job_title,
        company_name: interview.company_name,
        department_name: interview.department_name,
        scheduled_at_utc: interview.scheduled_at_utc,
        duration_minutes: interview.duration_minutes,
        status: interview.status,
        interview_type: interview.interview_type || 'ONLINE',
        location_url: interview.location_url,
        interviewer_name: interview.interviewer_name,
        created_at: interview.created_at,
        updated_at: interview.updated_at,
      };
    }

    if (caller.role === 'INTERVIEWER') {
      if (interview.interviewer_id !== caller.sub) {
        throw new AppError(
          403,
          'FORBIDDEN_INTERVIEWER_SCOPE',
          'Access denied. You may only view interviews explicitly assigned to you.'
        );
      }
      return interview;
    }

    if (caller.role === 'RECRUITER' || caller.role === 'HR_MANAGER') {
      if (interview.company_id !== caller.companyId) {
        throw new AppError(
          403,
          'FORBIDDEN_COMPANY_SCOPE',
          'Access denied to interviews belonging to another organization.'
        );
      }
      return interview;
    }

    return interview;
  }

  async listInterviews(caller: AccessTokenPayload): Promise<any[]> {
    if (caller.role === 'APPLICANT') {
      const list = await interviewRepository.listByApplicantWithDetails(caller.sub);
      return list.map((i) => ({
        id: i.id,
        application_id: i.application_id,
        job_id: i.job_id,
        job_title: i.job_title,
        company_name: i.company_name,
        department_name: i.department_name,
        scheduled_at_utc: i.scheduled_at_utc,
        duration_minutes: i.duration_minutes,
        status: i.status,
        interview_type: i.interview_type || 'ONLINE',
        location_url: i.location_url,
        interviewer_name: i.interviewer_name,
        created_at: i.created_at,
        updated_at: i.updated_at,
      }));
    }

    if (caller.role === 'INTERVIEWER') {
      return interviewRepository.listByInterviewerWithDetails(caller.sub);
    }

    if (caller.role === 'RECRUITER' || caller.role === 'HR_MANAGER') {
      if (!caller.companyId) return [];
      return interviewRepository.listByCompanyWithDetails(caller.companyId);
    }

    return interviewRepository.listAllWithDetails();
  }

  async getInterviewFeedback(caller: AccessTokenPayload, interviewId: string): Promise<InterviewFeedback | null> {
    const interview = await interviewRepository.findByIdWithDetails(interviewId);
    if (!interview) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', `Interview ${interviewId} not found`);
    }

    if (caller.role === 'APPLICANT') {
      throw new AppError(403, 'FORBIDDEN', 'Applicants are strictly forbidden from viewing internal interview feedback.');
    }

    if (caller.role === 'INTERVIEWER') {
      if (interview.interviewer_id !== caller.sub) {
        throw new AppError(
          403,
          'FORBIDDEN_INTERVIEWER_SCOPE',
          'Access denied. You may only view feedback for interviews assigned to you.'
        );
      }
    }

    if (caller.role === 'RECRUITER' || caller.role === 'HR_MANAGER') {
      if (interview.company_id !== caller.companyId) {
        throw new AppError(
          403,
          'FORBIDDEN_COMPANY_SCOPE',
          'Access denied to feedback outside your assigned organization.'
        );
      }
    }

    return interview.feedback || null;
  }

  async listAvailableInterviewers(caller: AccessTokenPayload): Promise<Array<{ id: string; name: string; email: string }>> {
    const db = getDatabase();
    return db.query<{ id: string; name: string; email: string }>(
      `SELECT id, (first_name || ' ' || last_name) AS name, email
       FROM users
       WHERE role = 'INTERVIEWER' AND account_status = 'ACTIVE'
       ORDER BY first_name ASC;`
    );
  }

  async listEligibleApplications(caller: AccessTokenPayload): Promise<any[]> {
    const db = getDatabase();
    const companyId = caller.role === 'ADMIN' ? caller.companyId || '' : caller.companyId!;
    if (!companyId && caller.role !== 'ADMIN') return [];

    let sql = `
      SELECT 
        a.id,
        a.job_id,
        j.title AS job_title,
        a.status,
        (u.first_name || ' ' || u.last_name) AS applicant_name,
        u.email AS applicant_email
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN users u ON a.applicant_id = u.id
      WHERE a.status IN ('SHORTLISTED', 'INTERVIEW_SCHEDULED')
    `;
    const params: unknown[] = [];
    if (companyId) {
      sql += ' AND j.company_id = ?';
      params.push(companyId);
    }
    sql += ' ORDER BY a.applied_at DESC;';
    return db.query(sql, params);
  }
}

export const jobService = new JobService();
export const applicationService = new ApplicationService();
export const interviewService = new InterviewService();
