import { apiClient } from '../api/client';
import type { HealthCheckData } from '../types';

export const healthService = {
  async checkHealth(): Promise<HealthCheckData> {
    return apiClient.get<HealthCheckData>('/health');
  },

  async triggerTestError(): Promise<unknown> {
    return apiClient.get<unknown>('/test/error');
  },

  async triggerTest404(): Promise<unknown> {
    return apiClient.get<unknown>('/non-existent-endpoint');
  },
};
