import { apiClient } from '../api/client';
import type { SkillLevel } from '../types';

export interface ExtractedSkill {
  skillName: string;
  level: SkillLevel;
  evidenceQuote: string;
  isDirectFact: boolean;
}

export interface ExtractedExperience {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
  evidence: string;
}

export interface ExtractedEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  year: string;
}

export interface ExtractedCertification {
  name: string;
  issuer: string;
  year?: string;
}

export interface ExtractedResumeData {
  headline: string;
  summary: string;
  skills: ExtractedSkill[];
  experience: ExtractedExperience[];
  education: ExtractedEducation[];
  certifications: ExtractedCertification[];
  overallConfidenceScore: number;
  confidenceExplanation: string;
}

export interface ResumeAnalysisResult {
  analysisId: string;
  resumeId: string;
  applicantId: string;
  consentGiven: boolean;
  consentTimestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  modelUsed: string;
  promptVersion: string;
  extracted: ExtractedResumeData;
  isConfirmed: boolean;
  confirmedAt: string | null;
  injectionDetected: boolean;
  createdAt: string;
}

export interface ConfirmAnalysisPayload {
  resumeId: string;
  analysisId: string;
  headline?: string;
  summary?: string;
  selectedSkills: Array<{
    skill_name: string;
    level: SkillLevel;
  }>;
}

export const aiService = {
  async analyzeResume(resumeId: string, consentAccepted: boolean): Promise<ResumeAnalysisResult> {
    const res = await apiClient.post<{ success: boolean; message: string; analysis: ResumeAnalysisResult }>(
      '/ai/resume/analyze',
      { resumeId, consentAccepted }
    );
    return res.analysis;
  },

  async getResumeAnalysis(resumeId: string): Promise<ResumeAnalysisResult | null> {
    try {
      const res = await apiClient.get<{ success: boolean; analysis: ResumeAnalysisResult }>(
        `/ai/resume/${resumeId}`
      );
      return res.analysis;
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  async confirmResumeAnalysis(
    payload: ConfirmAnalysisPayload
  ): Promise<{ success: boolean; message: string; addedSkillsCount: number; updatedProfile: any }> {
    return apiClient.post('/ai/resume/confirm', payload);
  },

  async getJobRecommendations(): Promise<JobRecommendationsData> {
    return apiClient.get('/ai/jobs/recommendations');
  },

  async generateJobRecommendations(
    consentAccepted: boolean,
    refresh = false
  ): Promise<JobRecommendationsData> {
    return apiClient.post('/ai/jobs/recommend', { consentAccepted, refresh });
  },

  async generateInterviewQuestions(payload: {
    jobId: string;
    interviewId?: string;
    category?: 'TECHNICAL' | 'BEHAVIORAL' | 'DOMAIN' | 'SITUATIONAL' | 'ALL';
    count?: number;
  }): Promise<InterviewQuestionsResponse> {
    return apiClient.post('/ai/interview/questions', payload);
  },

  async chatWithAssistant(payload: {
    message: string;
    conversationId?: string;
  }): Promise<AssistantChatResponse> {
    return apiClient.post('/ai/assistant/chat', payload);
  },
};

export interface RecommendedJobItem {
  jobId: string;
  relevanceScore: number;
  matchReason: string;
  matchedSkills: string[];
  missingSkills: string[];
  preferenceAlignment: string;
  evidenceExplanation: string;
  job: {
    id: string;
    title: string;
    company_name?: string;
    department_name?: string;
    location: string;
    employment_type: string;
    experience_level: string;
    description: string;
    requirements: string;
    salary_min: number | null;
    salary_max: number | null;
    deadline_utc: string | null;
  };
}

export interface JobRecommendationsData {
  success: boolean;
  recommendations: RecommendedJobItem[];
  overallSummary: string;
  modelUsed: string;
  generatedAt: string;
  isFromCache: boolean;
}

export interface EvaluationRubric {
  poor: string;
  acceptable: string;
  excellent: string;
}

export interface InterviewQuestionItem {
  question: string;
  category: 'TECHNICAL' | 'BEHAVIORAL' | 'DOMAIN' | 'SITUATIONAL';
  competency: string;
  rationale: string;
  expectedSignals: string[];
  evaluationRubric: EvaluationRubric;
  probingFollowUps: string[];
}

export interface InterviewQuestionsResponse {
  success: boolean;
  data: {
    jobTitle: string;
    summary: string;
    questions: InterviewQuestionItem[];
  };
  modelUsed: string;
  promptVersion: string;
  generatedAt: string;
}

export interface AssistantChatResponse {
  success: boolean;
  response: string;
  toolCallsExecuted: Array<{ tool: string; args: any; result: any }>;
  modelUsed: string;
  conversationId: string;
}
