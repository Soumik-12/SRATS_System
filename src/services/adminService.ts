import { apiClient } from '../api/client';
import type { UserRole, AccountStatus } from '../types';

export interface AdminUserItem {
  id: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  first_name: string;
  last_name: string;
  company_id: string | null;
  company_name: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminCompanyItem {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  user_count?: number;
  job_count?: number;
}

export interface AdminAuditLogItem {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string | null;
  created_at: string;
}

export const adminService = {
  getUsers(params?: {
    search?: string;
    role?: string;
    status?: string;
    companyId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AdminUserItem>> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    if (params?.companyId) query.set('companyId', params.companyId);
    if (params?.page !== undefined) query.set('page', params.page.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return apiClient.get<PaginatedResponse<AdminUserItem>>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  updateUserStatus(userId: string, status: AccountStatus): Promise<{ message: string; userId: string; status: string }> {
    return apiClient.put<{ message: string; userId: string; status: string }>(`/admin/users/${userId}/status`, { status });
  },

  updateUserRole(userId: string, role: UserRole): Promise<{ message: string; userId: string; role: string }> {
    return apiClient.put<{ message: string; userId: string; role: string }>(`/admin/users/${userId}/role`, { role });
  },

  bindUserCompany(userId: string, companyId: string | null): Promise<{ message: string; userId: string; companyId: string | null }> {
    return apiClient.put<{ message: string; userId: string; companyId: string | null }>(`/admin/users/${userId}/company`, { companyId });
  },

  getCompanies(): Promise<{ companies: AdminCompanyItem[] }> {
    return apiClient.get<{ companies: AdminCompanyItem[] }>('/admin/companies');
  },

  createCompany(data: {
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    location?: string;
  }): Promise<{ message: string; company: AdminCompanyItem }> {
    return apiClient.post<{ message: string; company: AdminCompanyItem }>('/admin/companies', data);
  },

  updateCompanyStatus(companyId: string, isActive: boolean): Promise<{ message: string; companyId: string; isActive: boolean }> {
    return apiClient.put<{ message: string; companyId: string; isActive: boolean }>(`/admin/companies/${companyId}/status`, { isActive });
  },

  getAuditLogs(params?: {
    actorId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AdminAuditLogItem>> {
    const query = new URLSearchParams();
    if (params?.actorId) query.set('actorId', params.actorId);
    if (params?.action) query.set('action', params.action);
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page !== undefined) query.set('page', params.page.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return apiClient.get<PaginatedResponse<AdminAuditLogItem>>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
