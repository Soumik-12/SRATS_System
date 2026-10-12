import { apiClient } from '../api/client';
import type { AuthSessionResponse, AuthUser, UserRole } from '../types';

export const authService = {
  async register(data: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    companyId?: string | null;
  }): Promise<{ message: string; user: AuthUser }> {
    return apiClient.post<{ message: string; user: AuthUser }>('/auth/register', data);
  },

  async login(data: {
    email: string;
    password: string;
    expectedRole?: UserRole;
  }): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>('/auth/login', data);
  },

  async refresh(refreshToken: string): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>('/auth/refresh', { refreshToken });
  },

  async logout(refreshToken?: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/logout', { refreshToken });
  },

  async getMe(): Promise<{ user: AuthUser }> {
    return apiClient.get<{ user: AuthUser }>('/auth/me');
  },
};
