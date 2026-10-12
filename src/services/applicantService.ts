import { apiClient } from '../api/client';
import type {
  ApplicantProfileData,
  ApplicantSkill,
  ResumeMetadata,
  SkillLevel,
} from '../types';

export const applicantService = {
  async getProfile(): Promise<ApplicantProfileData> {
    const res = await apiClient.get<{ profile: ApplicantProfileData }>('/applicant/profile');
    return res.profile;
  },

  async updateProfile(data: {
    headline?: string | null;
    summary?: string | null;
    phone?: string | null;
    location?: string | null;
    website?: string | null;
    education_json?: string | null;
    experience_json?: string | null;
  }): Promise<ApplicantProfileData> {
    const res = await apiClient.put<{ message: string; profile: ApplicantProfileData }>(
      '/applicant/profile',
      data
    );
    return res.profile;
  },

  async getSkills(): Promise<ApplicantSkill[]> {
    const res = await apiClient.get<{ skills: ApplicantSkill[] }>('/applicant/skills');
    return res.skills;
  },

  async addSkill(data: { skill_name: string; level: SkillLevel }): Promise<ApplicantSkill> {
    const res = await apiClient.post<{ message: string; skill: ApplicantSkill }>(
      '/applicant/skills',
      data
    );
    return res.skill;
  },

  async removeSkill(skillId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/applicant/skills/${skillId}`);
  },

  async listResumes(): Promise<ResumeMetadata[]> {
    const res = await apiClient.get<{ resumes: ResumeMetadata[] }>('/applicant/resumes');
    return res.resumes;
  },

  async uploadResume(file: File): Promise<ResumeMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{ message: string; resume: ResumeMetadata }>(
      '/applicant/resumes',
      formData
    );
    return res.resume;
  },

  async downloadResume(resumeId: string): Promise<{ blob: Blob; fileName: string }> {
    return apiClient.download(`/applicant/resumes/${resumeId}/file`);
  },

  async deleteResume(resumeId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/applicant/resumes/${resumeId}`);
  },
};
