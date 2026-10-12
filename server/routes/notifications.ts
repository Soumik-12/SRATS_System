import { Router } from 'express';
import { notificationRepository } from '../repositories/notificationRepository.js';
import { authenticate } from '../security/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

export const notificationsRouter = Router();

// Protect all notification routes with active JWT authentication
notificationsRouter.use(authenticate);

/**
 * GET /api/v1/notifications
 * List notifications strictly scoped to the authenticated caller with pagination.
 */
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(0, parseInt(req.query.page as string, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit || req.query.size) as string, 10) || 20));
    const offset = page * limit;

    const notifications = await notificationRepository.listByUser(req.user!.sub, limit, offset);
    res.json({
      notifications,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Returns database-derived unread notification count for authenticated user.
 */
notificationsRouter.get('/unread-count', async (req, res, next) => {
  try {
    const unreadCount = await notificationRepository.getUnreadCount(req.user!.sub);
    res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
});

/**
 * Handle marking single notification as read
 */
async function handleMarkAsRead(req: any, res: any, next: any) {
  try {
    const notif = await notificationRepository.findById(req.params.id);
    if (!notif) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', `Notification ${req.params.id} not found.`);
    }

    if (notif.user_id !== req.user!.sub) {
      throw new AppError(
        403,
        'FORBIDDEN_IDOR',
        'Object-level authorization denied. You cannot mark another user’s notification as read.'
      );
    }

    await notificationRepository.markAsRead(req.params.id, req.user!.sub);
    res.json({
      message: 'Notification marked as read.',
      success: true,
    });
  } catch (err) {
    next(err);
  }
}

notificationsRouter.post('/:id/read', handleMarkAsRead);
notificationsRouter.put('/:id/read', handleMarkAsRead);

/**
 * Handle marking all notifications as read for authenticated caller
 */
async function handleMarkAllRead(req: any, res: any, next: any) {
  try {
    const markedCount = await notificationRepository.markAllAsRead(req.user!.sub);
    res.json({
      message: 'All notifications marked as read.',
      markedCount,
    });
  } catch (err) {
    next(err);
  }
}

notificationsRouter.post('/mark-all-read', handleMarkAllRead);
notificationsRouter.put('/mark-all-read', handleMarkAllRead);
