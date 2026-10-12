import crypto from 'crypto';
import { jobRepository } from '../repositories/jobRepository.js';
import { interviewRepository } from '../repositories/interviewRepository.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import {
  applicantSkillRepository,
  applicantProfileRepository,
} from '../repositories/applicantProfileRepository.js';
import { auditLogRepository } from '../repositories/notificationRepository.js';
import { aiOrchestrator } from '../ai/aiOrchestrator.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AiCallerContext } from '../ai/toolRegistry.js';
import type {
  GenerateInterviewQuestionsRequest,
  InterviewQuestionsOutput,
} from '../ai/schemas.js';

export class InterviewQuestionService {
  /**
   * Generates job-aligned, competency-grounded interview questions
   * for interviewers, recruiters, and HR managers.
   */
  async generateQuestions(
    caller: AiCallerContext,
    params: GenerateInterviewQuestionsRequest
  ): Promise<{
    success: boolean;
    data: InterviewQuestionsOutput;
    modelUsed: string;
    promptVersion: string;
    generatedAt: string;
  }> {
    // 1. Authorization role gate: Applicants cannot generate evaluator questions
    if (caller.role === 'APPLICANT') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Applicants are not permitted to generate interview evaluation questions.'
      );
    }

    // 2. Fetch targeted job requisition
    const job = await jobRepository.findById(params.jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Target job requisition was not found.');
    }

    // 3. Multi-tenant company boundary validation
    if (
      (caller.role === 'RECRUITER' || caller.role === 'HR_MANAGER') &&
      caller.companyId &&
      job.company_id !== caller.companyId
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Company scope authorization denied. You cannot generate interview questions for jobs outside your company.'
      );
    }

    // 4. Interviewer scope verification (if interviewId is provided or checked)
    let candidateContext: {
      headline?: string;
      skills?: Array<{ skillName: string; level: string }>;
    } | null = null;

    if (params.interviewId) {
      const interview = await interviewRepository.findById(params.interviewId);
      if (!interview) {
        throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Specified interview was not found.');
      }

      if (caller.role === 'INTERVIEWER' && interview.interviewer_id !== caller.userId) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Interviewers can only generate questions for interviews assigned to them.'
        );
      }

      // Fetch candidate signals for question calibration (excluding PII)
      const application = await applicationRepository.findById(interview.application_id);
      if (application) {
        const skills = await applicantSkillRepository.listByApplicant(application.applicant_id);
        const profile = await applicantProfileRepository.findByUserId(application.applicant_id);
        candidateContext = {
          headline: profile?.headline || undefined,
          skills: skills.map((s) => ({ skillName: s.skill_name, level: s.level })),
        };
      }
    } else if (caller.role === 'INTERVIEWER') {
      // If no interviewId provided, interviewer must belong to same company
      if (caller.companyId && job.company_id !== caller.companyId) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Interviewers can only generate questions for company requisitions or assigned sessions.'
        );
      }
    }

    // 5. Orchestrate AI generation
    const result = await aiOrchestrator.generateInterviewQuestions(
      {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        experienceLevel: job.experience_level,
        employmentType: job.employment_type,
      },
      candidateContext,
      params.category || 'ALL',
      params.count || 5,
      caller
    );

    // 6. Record forensic audit log
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: caller.userId,
      action: 'INTERVIEW_QUESTIONS_GENERATED',
      entity_type: 'JOB',
      entity_id: job.id,
      metadata_json: JSON.stringify({
        jobTitle: job.title,
        interviewId: params.interviewId || null,
        questionCount: result.data.questions.length,
        category: params.category || 'ALL',
        modelUsed: result.modelUsed,
        durationMs: result.durationMs,
      }),
    });

    return {
      success: true,
      data: result.data,
      modelUsed: result.modelUsed,
      promptVersion: result.promptVersion,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const interviewQuestionService = new InterviewQuestionService();
