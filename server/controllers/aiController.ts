import type { Request, Response, NextFunction } from 'express';
import { resumeAnalysisService } from '../services/resumeAnalysisService.js';
import { jobRecommendationService } from '../services/jobRecommendationService.js';
import { interviewQuestionService } from '../services/interviewQuestionService.js';
import { assistantService } from '../services/assistantService.js';
import { toolRegistry } from '../ai/toolRegistry.js';
import {
  AnalyzeResumeRequestSchema,
  ConfirmAnalysisRequestSchema,
  GenerateRecommendationsRequestSchema,
  GenerateInterviewQuestionsRequestSchema,
  AssistantChatRequestSchema,
} from '../ai/schemas.js';

export class AiController {
  /**
   * POST /api/v1/ai/jobs/recommend
   * Generates or refreshes grounded AI job recommendations based on confirmed candidate signals
   */
  async recommendJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = GenerateRecommendationsRequestSchema.parse(req.body);
      const traceId = (req as any).traceId || `srats-rec-${Date.now()}`;
      const result = await jobRecommendationService.generateRecommendations(
        req.user!.sub,
        validated.consentAccepted,
        validated.refresh,
        {
          userId: req.user!.sub,
          role: req.user!.role,
          companyId: req.user!.companyId,
          email: req.user!.email,
          traceId,
        }
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/jobs/recommendations
   * Retrieves active, unexpired job recommendations for authenticated applicant
   */
  async getJobRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await jobRecommendationService.getLatestRecommendations(req.user!.sub);
      if (!result) {
        res.status(200).json({
          success: true,
          recommendations: [],
          overallSummary: 'No active AI recommendations found. Click "Generate Recommendations" to discover matching jobs.',
          modelUsed: 'none',
          generatedAt: new Date().toISOString(),
          isFromCache: false,
        });
        return;
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  /**
   * POST /api/v1/ai/resume/analyze
   * Initiates applicant-controlled, consent-verified resume extraction
   */
  async analyzeResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = AnalyzeResumeRequestSchema.parse(req.body);
      const traceId = (req as any).traceId || `srats-trace-${Date.now()}`;
      const result = await resumeAnalysisService.analyzeResume(
        req.user!.sub,
        validated.resumeId,
        validated.consentAccepted,
        traceId
      );

      res.status(200).json({
        success: true,
        message: 'Resume analysis completed successfully.',
        analysis: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ai/resume/:resumeId
   * Retrieves existing completed analysis for a resume
   */
  async getResumeAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resumeId } = req.params;
      const result = await resumeAnalysisService.getAnalysis(req.user!.sub, resumeId);

      if (!result) {
        res.status(404).json({
          status: 404,
          error: 'NOT_FOUND',
          message: 'No AI analysis found for this resume document.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        analysis: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ai/resume/confirm
   * Human-in-the-loop: Candidate explicitly reviews & applies extracted profile/skills
   */
  async confirmResumeAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = ConfirmAnalysisRequestSchema.parse(req.body);
      const result = await resumeAnalysisService.confirmAnalysis(req.user!.sub, validated);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ai/tools/execute
   * Phase 12 Tool Registry execution foundation with strict authorization
   */
  async executeTool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, arguments: toolArgs } = req.body;
      const traceId = (req as any).traceId || `srats-tool-${Date.now()}`;

      const result = await toolRegistry.executeTool(name, toolArgs, {
        userId: req.user!.sub,
        role: req.user!.role,
        companyId: req.user!.companyId,
        email: req.user!.email,
        traceId,
      });

        res.status(200).json({
        success: true,
        tool: name,
        result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ai/interview/questions
   * Generate evidence-grounded interview questions for assigned evaluators & recruiters
   */
  async generateInterviewQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = GenerateInterviewQuestionsRequestSchema.parse(req.body);
      const traceId = (req as any).traceId || `srats-iq-${Date.now()}`;

      const result = await interviewQuestionService.generateQuestions(
        {
          userId: req.user!.sub,
          role: req.user!.role,
          companyId: req.user!.companyId,
          email: req.user!.email,
          traceId,
        },
        validated
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ai/assistant/chat
   * Role-aware natural language assistant with authorized tool grounding
   */
  async chatAssistant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = AssistantChatRequestSchema.parse(req.body);
      const traceId = (req as any).traceId || `srats-chat-${Date.now()}`;

      const result = await assistantService.chat(
        {
          userId: req.user!.sub,
          role: req.user!.role,
          companyId: req.user!.companyId,
          email: req.user!.email,
          traceId,
        },
        validated.message,
        validated.conversationId
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
