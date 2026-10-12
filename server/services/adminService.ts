import { userRepository } from '../repositories/userRepository.js';
import { companyRepository } from '../repositories/companyRepository.js';
import { auditLogRepository } from '../repositories/notificationRepository.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AccessTokenPayload } from '../types/index.js';
import type { UserRole } from '../domain/entities.js';

export class AdminService {
  private assertAdmin(caller: AccessTokenPayload) {
    if (caller.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', `Access denied. Role "${caller.role}" is not authorized for administrative operations.`);
    }
  }

  async listUsers(
    caller: AccessTokenPayload,
    filters: {
      search?: string;
      role?: string;
      status?: string;
      companyId?: string;
      page?: number;
      limit?: number;
    }
  ) {
    this.assertAdmin(caller);

    const page = Math.max(0, filters.page || 0);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = page * limit;

    const [users, totalElements] = await Promise.all([
      userRepository.queryUsers({
        search: filters.search,
        role: filters.role,
        status: filters.status,
        companyId: filters.companyId,
        limit,
        offset,
      }),
      userRepository.countUsers({
        search: filters.search,
        role: filters.role,
        status: filters.status,
        companyId: filters.companyId,
      }),
    ]);

    const totalPages = Math.ceil(totalElements / limit);

    return {
      content: users,
      page,
      size: limit,
      totalElements,
      totalPages,
    };
  }

  async updateUserStatus(
    caller: AccessTokenPayload,
    targetUserId: string,
    newStatus: 'ACTIVE' | 'PENDING' | 'DEACTIVATED'
  ) {
    this.assertAdmin(caller);

    if (caller.sub === targetUserId && newStatus !== 'ACTIVE') {
      throw new AppError(400, 'CANNOT_DEACTIVATE_SELF', 'Administrator self-protection: You cannot deactivate your own administrative account.');
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', `User ${targetUserId} not found.`);
    }

    if (targetUser.role === 'ADMIN' && newStatus !== 'ACTIVE') {
      const activeAdminCount = await userRepository.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw new AppError(
          400,
          'CANNOT_DEACTIVATE_LAST_ADMIN',
          'Operation rejected. Cannot deactivate the system’s last active administrator.'
        );
      }
    }

    await userRepository.updateAccountStatus(targetUserId, newStatus);

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'ADMIN_USER_STATUS_UPDATED',
      entity_type: 'USER',
      entity_id: targetUserId,
      metadata_json: JSON.stringify({
        targetEmail: targetUser.email,
        fromStatus: targetUser.account_status,
        toStatus: newStatus,
      }),
    });

    return {
      message: `User account status updated to ${newStatus}.`,
      userId: targetUserId,
      status: newStatus,
    };
  }

  async updateUserRole(caller: AccessTokenPayload, targetUserId: string, newRole: UserRole) {
    this.assertAdmin(caller);

    const validRoles: UserRole[] = ['APPLICANT', 'RECRUITER', 'INTERVIEWER', 'HR_MANAGER', 'ADMIN'];
    if (!validRoles.includes(newRole)) {
      throw new AppError(400, 'INVALID_ROLE', `Role "${newRole}" is not a valid system role.`);
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', `User ${targetUserId} not found.`);
    }

    if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
      const activeAdminCount = await userRepository.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw new AppError(
          400,
          'CANNOT_DOWNGRADE_LAST_ADMIN',
          'Operation rejected. Cannot downgrade the system’s last active administrator.'
        );
      }
    }

    await userRepository.updateRole(targetUserId, newRole);

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'ADMIN_USER_ROLE_UPDATED',
      entity_type: 'USER',
      entity_id: targetUserId,
      metadata_json: JSON.stringify({
        targetEmail: targetUser.email,
        fromRole: targetUser.role,
        toRole: newRole,
      }),
    });

    return {
      message: `User role successfully updated to ${newRole}.`,
      userId: targetUserId,
      role: newRole,
    };
  }

  async bindUserCompany(caller: AccessTokenPayload, targetUserId: string, companyId: string | null) {
    this.assertAdmin(caller);

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', `User ${targetUserId} not found.`);
    }

    if (companyId) {
      const company = await companyRepository.findById(companyId);
      if (!company) {
        throw new AppError(404, 'COMPANY_NOT_FOUND', `Target company ${companyId} not found.`);
      }
    }

    await userRepository.updateCompany(targetUserId, companyId || '');

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'ADMIN_USER_COMPANY_BOUND',
      entity_type: 'USER',
      entity_id: targetUserId,
      metadata_json: JSON.stringify({
        targetEmail: targetUser.email,
        fromCompanyId: targetUser.company_id,
        toCompanyId: companyId,
      }),
    });

    return {
      message: companyId ? `User bound to company ${companyId}.` : 'User company binding removed.',
      userId: targetUserId,
      companyId,
    };
  }

  async listCompanies(caller: AccessTokenPayload) {
    this.assertAdmin(caller);
    return companyRepository.listAllAdmin();
  }

  async createCompany(
    caller: AccessTokenPayload,
    data: {
      name: string;
      domain?: string | null;
      industry?: string | null;
      size?: string | null;
      location?: string | null;
    }
  ) {
    this.assertAdmin(caller);

    const name = data.name?.trim();
    if (!name || name.length < 2) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Company name must be at least 2 characters long.');
    }

    const existing = await companyRepository.findByName(name);
    if (existing) {
      throw new AppError(409, 'COMPANY_NAME_CONFLICT', `A company with name "${name}" already exists.`);
    }

    const companyId = `comp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const created = await companyRepository.create({
      id: companyId,
      name,
      domain: data.domain || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      industry: data.industry || 'Technology',
      size: data.size || '10-50',
      location: data.location || 'Remote',
    });

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'ADMIN_COMPANY_CREATED',
      entity_type: 'COMPANY',
      entity_id: created.id,
      metadata_json: JSON.stringify({ name: created.name, domain: created.domain }),
    });

    return created;
  }

  async updateCompanyStatus(caller: AccessTokenPayload, companyId: string, isActive: boolean) {
    this.assertAdmin(caller);

    const company = await companyRepository.findById(companyId);
    if (!company) {
      throw new AppError(404, 'COMPANY_NOT_FOUND', `Company ${companyId} not found.`);
    }

    await companyRepository.updateStatus(companyId, isActive ? 1 : 0);

    await auditLogRepository.log({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: caller.sub,
      action: 'ADMIN_COMPANY_STATUS_UPDATED',
      entity_type: 'COMPANY',
      entity_id: companyId,
      metadata_json: JSON.stringify({
        companyName: company.name,
        fromActive: company.is_active,
        toActive: isActive ? 1 : 0,
      }),
    });

    return {
      message: `Company status updated to ${isActive ? 'ACTIVE' : 'INACTIVE'}.`,
      companyId,
      isActive,
    };
  }

  async getAuditLogs(
    caller: AccessTokenPayload,
    filters: {
      actorId?: string;
      action?: string;
      entityType?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ) {
    this.assertAdmin(caller);

    const page = Math.max(0, filters.page || 0);
    const limit = Math.min(100, Math.max(1, filters.limit || 25));
    const offset = page * limit;

    const [logs, totalElements] = await Promise.all([
      auditLogRepository.queryFiltered({
        actorId: filters.actorId,
        action: filters.action,
        entityType: filters.entityType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit,
        offset,
      }),
      auditLogRepository.countFiltered({
        actorId: filters.actorId,
        action: filters.action,
        entityType: filters.entityType,
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
    ]);

    const totalPages = Math.ceil(totalElements / limit);

    return {
      content: logs,
      page,
      size: limit,
      totalElements,
      totalPages,
    };
  }
}

export const adminService = new AdminService();
