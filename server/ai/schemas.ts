import { z } from 'zod';
import { Type } from '@google/genai';

/**
 * Skill level enumeration matching SRATS domain standard
 */
export const SkillLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

/**
 * Extracted skill with evidence citation and fact vs inference flag
 */
export const ExtractedSkillSchema = z.object({
  skillName: z.string().min(1).max(100),
  level: SkillLevelSchema,
  evidenceQuote: z.string().max(500).default(''),
  isDirectFact: z.boolean().default(true),
});
export type ExtractedSkill = z.infer<typeof ExtractedSkillSchema>;

/**
 * Extracted work experience entry
 */
export const ExtractedExperienceSchema = z.object({
  company: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  duration: z.string().max(100).default(''),
  highlights: z.array(z.string().max(500)).default([]),
  evidence: z.string().max(500).default(''),
});
export type ExtractedExperience = z.infer<typeof ExtractedExperienceSchema>;

/**
 * Extracted education entry
 */
export const ExtractedEducationSchema = z.object({
  institution: z.string().min(1).max(255),
  degree: z.string().max(255).default(''),
  fieldOfStudy: z.string().max(255).default(''),
  year: z.string().max(50).default(''),
});
export type ExtractedEducation = z.infer<typeof ExtractedEducationSchema>;

/**
 * Extracted certification entry
 */
export const ExtractedCertificationSchema = z.object({
  name: z.string().min(1).max(255),
  issuer: z.string().max(255).default(''),
  year: z.string().max(50).optional().default(''),
});
export type ExtractedCertification = z.infer<typeof ExtractedCertificationSchema>;

/**
 * Complete Structured Resume Extraction Schema
 */
export const ResumeAnalysisOutputSchema = z.object({
  headline: z.string().max(255).default(''),
  summary: z.string().max(4000).default(''),
  skills: z.array(ExtractedSkillSchema).default([]),
  experience: z.array(ExtractedExperienceSchema).default([]),
  education: z.array(ExtractedEducationSchema).default([]),
  certifications: z.array(ExtractedCertificationSchema).default([]),
  overallConfidenceScore: z.number().min(0).max(1).default(0.85),
  confidenceExplanation: z.string().max(1000).default('Grounding verified against resume text.'),
});
export type ResumeAnalysisOutput = z.infer<typeof ResumeAnalysisOutputSchema>;

/**
 * Response schema for @google/genai structured outputs
 */
export const genAiResumeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: 'Concise professional headline based strictly on explicit resume experience (max 100 characters)',
    },
    summary: {
      type: Type.STRING,
      description: 'Professional summary grounded directly in resume evidence without hallucinating facts (max 500 words)',
    },
    skills: {
      type: Type.ARRAY,
      description: 'List of technical and domain skills with direct citations from the resume',
      items: {
        type: Type.OBJECT,
        properties: {
          skillName: { type: Type.STRING, description: 'Normalized name of the skill' },
          level: {
            type: Type.STRING,
            description: 'Proficiency level strictly one of: BEGINNER, INTERMEDIATE, EXPERT',
          },
          evidenceQuote: {
            type: Type.STRING,
            description: 'Exact or near-exact short snippet from resume text evidencing this skill',
          },
          isDirectFact: {
            type: Type.BOOLEAN,
            description: 'True if explicitly stated in text; False if inferred from project context',
          },
        },
        required: ['skillName', 'level'],
      },
    },
    experience: {
      type: Type.ARRAY,
      description: 'Work experience history extracted from resume',
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING, description: 'Company or organization name' },
          role: { type: Type.STRING, description: 'Job title or role' },
          duration: { type: Type.STRING, description: 'Time period or dates' },
          highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key responsibilities or accomplishments',
          },
          evidence: { type: Type.STRING, description: 'Source citation from resume' },
        },
        required: ['company', 'role'],
      },
    },
    education: {
      type: Type.ARRAY,
      description: 'Educational history extracted from resume',
      items: {
        type: Type.OBJECT,
        properties: {
          institution: { type: Type.STRING, description: 'Institution or university name' },
          degree: { type: Type.STRING, description: 'Degree earned or in progress' },
          fieldOfStudy: { type: Type.STRING, description: 'Major or field of study' },
          year: { type: Type.STRING, description: 'Graduation or attendance year' },
        },
        required: ['institution'],
      },
    },
    certifications: {
      type: Type.ARRAY,
      description: 'Professional licenses or certifications',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Certification title' },
          issuer: { type: Type.STRING, description: 'Issuing body' },
          year: { type: Type.STRING, description: 'Year obtained if specified' },
        },
        required: ['name'],
      },
    },
    overallConfidenceScore: {
      type: Type.NUMBER,
      description: 'Estimated confidence score between 0.0 and 1.0 based on clarity and completeness of resume',
    },
    confidenceExplanation: {
      type: Type.STRING,
      description: 'Reasoning behind the confidence assessment',
    },
  },
  required: ['headline', 'summary', 'skills', 'experience', 'education'],
};

/**
 * Controller API Request Validation Schemas
 */
export const AnalyzeResumeRequestSchema = z.object({
  resumeId: z.string().min(1, 'resumeId is required'),
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'Explicit applicant consent is required before processing documents with Google Gemini.',
  }),
});
export type AnalyzeResumeRequest = z.infer<typeof AnalyzeResumeRequestSchema>;

export const ConfirmAnalysisRequestSchema = z.object({
  resumeId: z.string().min(1, 'resumeId is required'),
  analysisId: z.string().min(1, 'analysisId is required'),
  headline: z.string().max(255).optional(),
  summary: z.string().max(4000).optional(),
  selectedSkills: z
    .array(
      z.object({
        skill_name: z.string().min(1).max(100),
        level: SkillLevelSchema,
      })
    )
    .default([]),
});
export type ConfirmAnalysisRequest = z.infer<typeof ConfirmAnalysisRequestSchema>;

/**
 * Phase 14: Job Recommendation Schemas
 */
export const JobRecommendationItemSchema = z.object({
  jobId: z.string().min(1),
  relevanceScore: z.number().min(0).max(100).default(80),
  matchReason: z.string().max(500),
  matchedSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  preferenceAlignment: z.string().max(500).default('Aligns with confirmed profile background'),
  evidenceExplanation: z.string().max(1000).default('Evidence verified against confirmed candidate skills and requirements.'),
});
export type JobRecommendationItem = z.infer<typeof JobRecommendationItemSchema>;

export const JobRecommendationOutputSchema = z.object({
  recommendedJobs: z.array(JobRecommendationItemSchema).default([]),
  overallSummary: z.string().max(1000).default('AI recommendations grounded in confirmed candidate competencies and published jobs.'),
});
export type JobRecommendationOutput = z.infer<typeof JobRecommendationOutputSchema>;

export const genAiJobRecommendationSchema = {
  type: Type.OBJECT,
  properties: {
    recommendedJobs: {
      type: Type.ARRAY,
      description: 'List of recommended jobs strictly chosen from the provided candidate job set',
      items: {
        type: Type.OBJECT,
        properties: {
          jobId: { type: Type.STRING, description: 'ID of the job strictly from candidate set' },
          relevanceScore: { type: Type.NUMBER, description: 'Estimated relevance score between 0 and 100' },
          matchReason: { type: Type.STRING, description: 'Concise summary of why this job matches the candidate' },
          matchedSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Skills explicitly confirmed by candidate that match job requirements',
          },
          missingSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Job requirements not explicitly evidenced in candidate profile',
          },
          preferenceAlignment: { type: Type.STRING, description: 'Domain, experience, or role type alignment' },
          evidenceExplanation: { type: Type.STRING, description: 'Grounded citation explaining the match' },
        },
        required: ['jobId', 'relevanceScore', 'matchReason', 'matchedSkills'],
      },
    },
    overallSummary: {
      type: Type.STRING,
      description: 'High-level synthesis of career discovery alignment',
    },
  },
  required: ['recommendedJobs'],
};

export const GenerateRecommendationsRequestSchema = z.object({
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'Explicit candidate consent is required before generating AI job recommendations.',
  }),
  refresh: z.boolean().optional().default(false),
});
export type GenerateRecommendationsRequest = z.infer<typeof GenerateRecommendationsRequestSchema>;

/**
 * Phase 15: Assistant Chat Schemas
 */
export const AssistantChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000),
  conversationId: z.string().optional(),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

/**
 * Phase 15: Interview Questions Schemas
 */
export const InterviewQuestionCategorySchema = z.enum(['TECHNICAL', 'BEHAVIORAL', 'DOMAIN', 'SITUATIONAL']);
export type InterviewQuestionCategory = z.infer<typeof InterviewQuestionCategorySchema>;

export const EvaluationRubricSchema = z.object({
  poor: z.string(),
  acceptable: z.string(),
  excellent: z.string(),
});
export type EvaluationRubric = z.infer<typeof EvaluationRubricSchema>;

export const InterviewQuestionItemSchema = z.object({
  question: z.string().min(1),
  category: InterviewQuestionCategorySchema,
  competency: z.string().min(1),
  rationale: z.string(),
  expectedSignals: z.array(z.string()).default([]),
  evaluationRubric: EvaluationRubricSchema,
  probingFollowUps: z.array(z.string()).default([]),
});
export type InterviewQuestionItem = z.infer<typeof InterviewQuestionItemSchema>;

export const InterviewQuestionsOutputSchema = z.object({
  jobTitle: z.string(),
  summary: z.string().default(''),
  questions: z.array(InterviewQuestionItemSchema),
});
export type InterviewQuestionsOutput = z.infer<typeof InterviewQuestionsOutputSchema>;

export const genAiInterviewQuestionsResponseSchema = {
  type: Type.OBJECT,
  properties: {
    jobTitle: {
      type: Type.STRING,
      description: 'Job requisition title under evaluation',
    },
    summary: {
      type: Type.STRING,
      description: 'Overview of evaluation focus and competency alignment',
    },
    questions: {
      type: Type.ARRAY,
      description: 'Structured interview questions grounded in job specifications',
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: 'The clear interview question to present to the candidate',
          },
          category: {
            type: Type.STRING,
            description: 'Category: TECHNICAL, BEHAVIORAL, DOMAIN, or SITUATIONAL',
          },
          competency: {
            type: Type.STRING,
            description: 'Core skill or capability assessed (e.g. Distributed Systems, Conflict Resolution)',
          },
          rationale: {
            type: Type.STRING,
            description: 'Why this question matters for the specific job requirements',
          },
          expectedSignals: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key behaviors or technical points candidate should demonstrate',
          },
          evaluationRubric: {
            type: Type.OBJECT,
            properties: {
              poor: { type: Type.STRING, description: 'Indicators of inadequate answer' },
              acceptable: { type: Type.STRING, description: 'Indicators of competent answer' },
              excellent: { type: Type.STRING, description: 'Indicators of superior, exceptional answer' },
            },
            required: ['poor', 'acceptable', 'excellent'],
          },
          probingFollowUps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Follow-up questions to dig deeper into candidate response',
          },
        },
        required: ['question', 'category', 'competency', 'rationale', 'expectedSignals', 'evaluationRubric', 'probingFollowUps'],
      },
    },
  },
  required: ['jobTitle', 'questions'],
};

export const GenerateInterviewQuestionsRequestSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  interviewId: z.string().optional(),
  category: z.enum(['TECHNICAL', 'BEHAVIORAL', 'DOMAIN', 'SITUATIONAL', 'ALL']).optional().default('ALL'),
  count: z.number().int().min(1).max(10).optional().default(5),
});
export type GenerateInterviewQuestionsRequest = z.infer<typeof GenerateInterviewQuestionsRequestSchema>;

