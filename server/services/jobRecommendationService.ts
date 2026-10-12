import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler.js';
import { applicantProfileRepository, applicantSkillRepository } from '../repositories/applicantProfileRepository.js';
import { jobRepository, type JobWithDetails } from '../repositories/jobRepository.js';
import { jobRecommendationRepository, type JobRecommendationRecord } from '../repositories/jobRecommendationRepository.js';
import { auditLogRepository } from '../repositories/notificationRepository.js';
import { aiOrchestrator } from '../ai/aiOrchestrator.js';
import type { AiCallerContext } from '../ai/toolRegistry.js';
import type { JobRecommendationItem } from '../ai/schemas.js';
import { logger } from '../utils/logger.js';

export interface EnrichedJobRecommendation {
  jobId: string;
  relevanceScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
  preferenceAlignment: string;
  evidenceExplanation: string;
  job: JobWithDetails;
}

export interface JobRecommendationsResponse {
  success: boolean;
  recommendations: EnrichedJobRecommendation[];
  overallSummary: string;
  modelUsed: string;
  generatedAt: string;
  isFromCache: boolean;
}

export class JobRecommendationService {
  /**
   * Helper to compute an input fingerprint for caching & freshness checks.
   */
  private computeFingerprint(
    skills: Array<{ skill_name: string; level: string }>,
    headline: string | null | undefined,
    jobIds: string[]
  ): string {
    const sortedSkills = [...skills].sort((a, b) => a.skill_name.localeCompare(b.skill_name));
    const sortedJobIds = [...jobIds].sort();
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ skills: sortedSkills, headline: headline || '', jobIds: sortedJobIds }))
      .digest('hex');
  }

  /**
   * Retrieves the current recommendations for an applicant if still valid and fresh.
   */
  async getLatestRecommendations(applicantId: string): Promise<JobRecommendationsResponse | null> {
    const record = await jobRecommendationRepository.findLatestByApplicant(applicantId);
    if (!record) {
      return null;
    }

    const now = new Date().toISOString();
    if (record.expires_at <= now) {
      return null;
    }

    try {
      const parsed = JSON.parse(record.recommended_jobs_json) as {
        recommendations: JobRecommendationItem[];
        overallSummary: string;
      };

      // Re-verify that all recommended jobs are STILL published, active, and not deleted
      const enriched: EnrichedJobRecommendation[] = [];
      for (const item of parsed.recommendations) {
        const job = await jobRepository.findByIdWithDetails(item.jobId);
        if (
          job &&
          job.status === 'PUBLISHED' &&
          job.is_active === 1 &&
          (!job.deadline_utc || new Date(job.deadline_utc).getTime() > Date.now())
        ) {
          enriched.push({
            ...item,
            job,
          });
        }
      }

      return {
        success: true,
        recommendations: enriched,
        overallSummary: parsed.overallSummary,
        modelUsed: record.model_used,
        generatedAt: record.created_at,
        isFromCache: true,
      };
    } catch (err) {
      logger.error('Failed to parse cached job recommendations JSON', err);
      return null;
    }
  }

  /**
   * Generates grounded AI job recommendations based strictly on real published jobs
   * and confirmed applicant skills/profile without exposing PII.
   */
  async generateRecommendations(
    applicantId: string,
    consentAccepted: boolean,
    refresh = false,
    callerContext: AiCallerContext
  ): Promise<JobRecommendationsResponse> {
    if (callerContext.role !== 'APPLICANT' || callerContext.userId !== applicantId) {
      throw new AppError(403, 'FORBIDDEN', 'Candidates may only access job recommendations for their own profile.');
    }

    if (!consentAccepted) {
      throw new AppError(
        400,
        'CONSENT_REQUIRED',
        'Explicit candidate consent is required before generating AI job recommendations.'
      );
    }

    // 1. Load confirmed applicant profile signals
    const profile = await applicantProfileRepository.findByUserId(applicantId);
    const skills = await applicantSkillRepository.listByApplicant(applicantId);
    const confirmedSkills = skills.map((s) => ({ skill_name: s.skill_name, level: s.level }));

    // 2. Query available published jobs using established visibility rules
    const publishedResult = await jobRepository.searchPublished({ size: 50, page: 0 });
    const nowMs = Date.now();
    const candidateJobs = publishedResult.jobs.filter(
      (j) =>
        j.status === 'PUBLISHED' &&
        j.is_active === 1 &&
        (!j.deadline_utc || new Date(j.deadline_utc).getTime() > nowMs)
    );

    // 3. Check for valid cached recommendation run if refresh is false
    const candidateJobIds = candidateJobs.map((j) => j.id);
    const fingerprint = this.computeFingerprint(confirmedSkills, profile?.headline, candidateJobIds);

    if (!refresh) {
      const existing = await jobRecommendationRepository.findLatestByApplicant(applicantId);
      if (existing && existing.fingerprint === fingerprint && existing.expires_at > new Date().toISOString()) {
        const cached = await this.getLatestRecommendations(applicantId);
        if (cached && cached.recommendations.length > 0) {
          return cached;
        }
      }
    }

    // 4. If zero published jobs available, return truthful empty state immediately
    if (candidateJobs.length === 0) {
      return {
        success: true,
        recommendations: [],
        overallSummary: 'No active published jobs are currently available for recommendation.',
        modelUsed: 'deterministic',
        generatedAt: new Date().toISOString(),
        isFromCache: false,
      };
    }

    // 5. Invoke AI Orchestrator with data minimization
    const validJobMap = new Map<string, JobWithDetails>();
    candidateJobs.forEach((j) => validJobMap.set(j.id, j));

    const orchestratorResult = await aiOrchestrator.recommendJobs(
      {
        confirmedSkills,
        headline: profile?.headline,
        summary: profile?.summary,
      },
      candidateJobs.map((j) => ({
        id: j.id,
        title: j.title,
        company_name: j.company_name,
        department_name: j.department_name,
        location: j.location,
        employment_type: j.employment_type,
        experience_level: j.experience_level,
        description: j.description,
        requirements: j.requirements,
      })),
      callerContext
    );

    // 6. Strict Grounding: Filter out any hallucinated job IDs not in candidate set
    const groundedEnriched: EnrichedJobRecommendation[] = [];
    for (const rec of orchestratorResult.data.recommendedJobs) {
      const dbJob = validJobMap.get(rec.jobId);
      if (dbJob) {
        groundedEnriched.push({
          jobId: rec.jobId,
          relevanceScore: rec.relevanceScore,
          matchReason: rec.matchReason,
          matchedSkills: rec.matchedSkills,
          missingSkills: rec.missingSkills,
          preferenceAlignment: rec.preferenceAlignment,
          evidenceExplanation: rec.evidenceExplanation,
          job: dbJob,
        });
      } else {
        logger.warn('[JobRecommendationService] Discarded hallucinated or inaccessible jobId from AI output', {
          hallucinatedJobId: rec.jobId,
          applicantId,
        });
      }
    }

    // 7. Persist recommendation run with 24-hour expiration
    const recId = `jrec-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const minimalPayload = {
      recommendations: groundedEnriched.map((r) => ({
        jobId: r.jobId,
        relevanceScore: r.relevanceScore,
        matchReason: r.matchReason,
        matchedSkills: r.matchedSkills,
        missingSkills: r.missingSkills,
        preferenceAlignment: r.preferenceAlignment,
        evidenceExplanation: r.evidenceExplanation,
      })),
      overallSummary: orchestratorResult.data.overallSummary,
    };

    await jobRecommendationRepository.save({
      id: recId,
      applicant_id: applicantId,
      consent_given: 1,
      consent_timestamp: createdAt,
      fingerprint,
      recommended_jobs_json: JSON.stringify(minimalPayload),
      model_used: orchestratorResult.modelUsed,
      created_at: createdAt,
      expires_at: expiresAt,
    });

    // 8. Audit log generation event
    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      actor_id: applicantId,
      action: 'JOB_RECOMMENDATIONS_GENERATED',
      entity_type: 'JOB_RECOMMENDATION',
      entity_id: recId,
      metadata_json: JSON.stringify({
        applicantId,
        recId,
        recommendedCount: groundedEnriched.length,
        modelUsed: orchestratorResult.modelUsed,
        executionTimeMs: orchestratorResult.durationMs,
      }),
    });

    return {
      success: true,
      recommendations: groundedEnriched,
      overallSummary: orchestratorResult.data.overallSummary,
      modelUsed: orchestratorResult.modelUsed,
      generatedAt: createdAt,
      isFromCache: false,
    };
  }
}

export const jobRecommendationService = new JobRecommendationService();
