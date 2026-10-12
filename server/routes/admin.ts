import { Router } from 'express';
import { adminService } from '../services/adminService.js';
import { analyticsService } from '../services/analyticsService.js';
import { authenticate, requireRole } from '../security/authMiddleware.js';

export const adminRouter = Router();

// Protect ALL admin routes with authenticate and requireRole('ADMIN')
adminRouter.use(authenticate, requireRole('ADMIN'));

/**
 * GET /api/v1/admin/users
 */
adminRouter.get('/users', async (req, res, next) => {
  try {
    const { search, role, status, companyId, page, limit } = req.query;
    const users = await adminService.listUsers(req.user!, {
      search: typeof search === 'string' ? search : undefined,
      role: typeof role === 'string' ? role : undefined,
      status: typeof status === 'string' ? status : undefined,
      companyId: typeof companyId === 'string' ? companyId : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/users/:id/status
 */
adminRouter.put('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await adminService.updateUserStatus(req.user!, req.params.id, status);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/users/:id/role
 */
adminRouter.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    const result = await adminService.updateUserRole(req.user!, req.params.id, role);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/users/:id/company
 */
adminRouter.put('/users/:id/company', async (req, res, next) => {
  try {
    const { companyId } = req.body;
    const result = await adminService.bindUserCompany(req.user!, req.params.id, companyId ?? null);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/companies
 */
adminRouter.get('/companies', async (req, res, next) => {
  try {
    const companies = await adminService.listCompanies(req.user!);
    res.json({ companies });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/companies
 */
adminRouter.post('/companies', async (req, res, next) => {
  try {
    const company = await adminService.createCompany(req.user!, req.body);
    res.status(201).json({
      message: 'Company successfully created.',
      company,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/companies/:id/status
 */
adminRouter.put('/companies/:id/status', async (req, res, next) => {
  try {
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : req.body.is_active === 1;
    const result = await adminService.updateCompanyStatus(req.user!, req.params.id, isActive);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/audit-logs
 */
adminRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const { actorId, action, entityType, startDate, endDate, page, limit } = req.query;
    const logs = await adminService.getAuditLogs(req.user!, {
      actorId: typeof actorId === 'string' ? actorId : undefined,
      action: typeof action === 'string' ? action : undefined,
      entityType: typeof entityType === 'string' ? entityType : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/analytics
 */
adminRouter.get('/analytics', async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminAnalytics(req.user!);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
