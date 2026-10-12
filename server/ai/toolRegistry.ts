import { z } from 'zod';
import type { UserRole } from '../domain/entities.js';
import { AppError } from '../middleware/errorHandler.js';
import { applicantService } from '../services/applicantService.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { interviewRepository } from '../repositories/interviewRepository.js';
import { analyticsRepository } from '../repositories/analyticsRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { logger } from '../utils/logger.js';

export interface AiCallerContext {
  userId: string;
  role: UserRole;
  companyId?: string | null;
  email?: string;
  traceId?: string;
}

export interface AiTool {
  name: string;
  description: string;
  permittedRoles: UserRole[];
  parametersSchema: z.ZodType<any>;
  handler: (context: AiCallerContext, args: any) => Promise<any>;
}

export class ToolRegistry {
  private tools = new Map<string, AiTool>();

  constructor() {
    this.registerDefaultTools();
  }

  public registerTool(tool: AiTool): void {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  public listToolsForRole(role: UserRole): AiTool[] {
    return Array.from(this.tools.values()).filter((t) => t.permittedRoles.includes(role));
  }

  public async executeTool(name: string, rawArgs: unknown, context: AiCallerContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new AppError(404, 'TOOL_NOT_FOUND', `AI tool "${name}" is not registered in the system.`);
    }

    // Role-based privilege enforcement
    if (!tool.permittedRoles.includes(context.role)) {
      logger.warn('AI tool invocation denied due to insufficient role permissions', {
        tool: name,
        userRole: context.role,
        userId: context.userId,
      });
      throw new AppError(
        403,
        'TOOL_UNAUTHORIZED',
        `Role "${context.role}" is not permitted to execute tool "${name}".`
      );
    }

    // Server-side arguments validation
    let validatedArgs: any;
    try {
      validatedArgs = tool.parametersSchema.parse(rawArgs);
    } catch (err: any) {
      const details = err.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new AppError(
        400,
        'TOOL_ARGUMENTS_INVALID',
        `Invalid arguments provided for tool "${name}": ${details || err.message}`
      );
    }

    // Execute approved handler with caller context
    try {
      return await tool.handler(context, validatedArgs);
    } catch (handlerErr: any) {
      if (handlerErr instanceof AppError) {
        throw handlerErr;
      }
      logger.error('Error executing tool handler', { tool: name, error: handlerErr });
      throw new AppError(500, 'TOOL_EXECUTION_FAILED', `Failed to execute tool "${name}".`);
    }
  }

  private registerDefaultTools(): void {
    // 1. Tool: get_applicant_profile
    this.registerTool({
      name: 'get_applicant_profile',
      description: 'Retrieve candidate background and verified profile details with strict ownership and company scope checks.',
      permittedRoles: ['APPLICANT', 'RECRUITER', 'HR_MANAGER', 'ADMIN'],
      parametersSchema: z.object({
        applicantId: z.string().min(1, 'applicantId is required'),
      }),
      handler: async (context, args: { applicantId: string }) => {
        // IDOR / Tenancy check:
        if (context.role === 'APPLICANT' && context.userId !== args.applicantId) {
          throw new AppError(403, 'FORBIDDEN', 'Applicants can only access their own profile details.');
        }

        // For Recruiter / HR_Manager: verify applicant has applied to caller company's job
        if ((context.role === 'RECRUITER' || context.role === 'HR_MANAGER') && context.companyId) {
          const applications = await applicationRepository.listByCompanyWithDetails(context.companyId);
          const hasApplied = applications.some((app) => app.applicant_id === args.applicantId);
          if (!hasApplied) {
            throw new AppError(
              403,
              'FORBIDDEN',
              'Cannot access candidate profile outside of applications submitted to your company.'
            );
          }
        }

        return await applicantService.getProfile(args.applicantId);
      },
    });

    // 2. Tool: list_applicant_resumes
    this.registerTool({
      name: 'list_applicant_resumes',
      description: 'List active and historical uploaded resume documents for the authenticated applicant.',
      permittedRoles: ['APPLICANT'],
      parametersSchema: z.object({
        applicantId: z.string().min(1, 'applicantId is required'),
      }),
      handler: async (context, args: { applicantId: string }) => {
        if (context.userId !== args.applicantId) {
          throw new AppError(403, 'FORBIDDEN', 'Applicants can only view their own resume inventory.');
        }
        return await applicantService.listResumes(args.applicantId);
      },
    });

    // 3. Tool: get_published_jobs
    this.registerTool({
      name: 'get_published_jobs',
      description: 'Query currently published open job requisitions across the system with optional search query.',
      permittedRoles: ['APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN'],
      parametersSchema: z.object({
        query: z.string().optional(),
        location: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      handler: async (_context, args: { query?: string; location?: string; limit: number }) => {
        const result = await jobRepository.searchPublished({
          query: args.query,
          location: args.location,
          size: args.limit,
          page: 0,
        });
        return result.jobs;
      },
    });

    // 4. Tool: get_company_job_details
    this.registerTool({
      name: 'get_company_job_details',
      description: 'Retrieve full job requisition specification scoped strictly to the caller company.',
      permittedRoles: ['RECRUITER', 'HR_MANAGER'],
      parametersSchema: z.object({
        jobId: z.string().min(1, 'jobId is required'),
      }),
      handler: async (context, args: { jobId: string }) => {
        const job = await jobRepository.findById(args.jobId);
        if (!job) {
          throw new AppError(404, 'JOB_NOT_FOUND', 'Requested job was not found.');
        }

        if (context.companyId && job.company_id !== context.companyId) {
          throw new AppError(403, 'FORBIDDEN', 'Access to other company jobs is strictly prohibited.');
        }

        return job;
      },
    });

    // 5. Tool: get_applicant_applications
    this.registerTool({
      name: 'get_applicant_applications',
      description: 'Fetch submitted job applications and status records for the applicant.',
      permittedRoles: ['APPLICANT', 'RECRUITER', 'HR_MANAGER', 'ADMIN'],
      parametersSchema: z.object({
        applicantId: z.string().min(1, 'applicantId is required'),
      }),
      handler: async (context, args: { applicantId: string }) => {
        if (context.role === 'APPLICANT' && context.userId !== args.applicantId) {
          throw new AppError(403, 'FORBIDDEN', 'Applicants can only view their own applications.');
        }

        const allApps = await applicationRepository.listByApplicantWithDetails(args.applicantId);

        if ((context.role === 'RECRUITER' || context.role === 'HR_MANAGER') && context.companyId) {
          const companyApps = allApps.filter((app) => app.company_id === context.companyId);
          if (companyApps.length === 0) {
            throw new AppError(
              403,
              'FORBIDDEN',
              'Cannot access candidate applications outside of those submitted to your company.'
            );
          }
          return companyApps;
        }

        return allApps;
      },
    });

    // 6. Tool: get_applicant_interviews
    this.registerTool({
      name: 'get_applicant_interviews',
      description: 'Fetch scheduled and past interviews for the authenticated applicant.',
      permittedRoles: ['APPLICANT', 'ADMIN'],
      parametersSchema: z.object({
        applicantId: z.string().min(1, 'applicantId is required'),
      }),
      handler: async (context, args: { applicantId: string }) => {
        if (context.role === 'APPLICANT' && context.userId !== args.applicantId) {
          throw new AppError(403, 'FORBIDDEN', 'Applicants can only view their own interviews.');
        }
        return await interviewRepository.listByApplicantWithDetails(args.applicantId);
      },
    });

    // 7. Tool: get_interviewer_assigned_interviews
    this.registerTool({
      name: 'get_interviewer_assigned_interviews',
      description: 'Fetch assigned technical and behavioral interview sessions for the interviewer.',
      permittedRoles: ['INTERVIEWER', 'RECRUITER', 'HR_MANAGER', 'ADMIN'],
      parametersSchema: z.object({
        interviewerId: z.string().min(1, 'interviewerId is required'),
      }),
      handler: async (context, args: { interviewerId: string }) => {
        if (context.role === 'INTERVIEWER' && context.userId !== args.interviewerId) {
          throw new AppError(403, 'FORBIDDEN', 'Interviewers can only view their own assigned sessions.');
        }

        if ((context.role === 'RECRUITER' || context.role === 'HR_MANAGER') && context.companyId) {
          const interviewer = await userRepository.findById(args.interviewerId);
          if (!interviewer || interviewer.company_id !== context.companyId) {
            throw new AppError(
              403,
              'FORBIDDEN',
              'Cannot access interview schedules for evaluators outside your company.'
            );
          }
        }

        return await interviewRepository.listByInterviewerWithDetails(args.interviewerId);
      },
    });

    // 8. Tool: get_recruiter_pipeline_summary
    this.registerTool({
      name: 'get_recruiter_pipeline_summary',
      description: 'Retrieve real aggregated pipeline metrics and requisition counts for the recruiter company.',
      permittedRoles: ['RECRUITER', 'HR_MANAGER', 'ADMIN'],
      parametersSchema: z.object({}),
      handler: async (context) => {
        if (!context.companyId && context.role !== 'ADMIN') {
          throw new AppError(400, 'BAD_REQUEST', 'Company context required for pipeline summary.');
        }
        return await analyticsRepository.getRecruiterAnalytics(context.companyId || '');
      },
    });

    // 9. Tool: get_admin_platform_overview
    this.registerTool({
      name: 'get_admin_platform_overview',
      description: 'Retrieve platform-wide governance metrics (user counts, active companies, audit volumes).',
      permittedRoles: ['ADMIN'],
      parametersSchema: z.object({}),
      handler: async () => {
        return await analyticsRepository.getAdminAnalytics();
      },
    });
  }
}

export const toolRegistry = new ToolRegistry();
