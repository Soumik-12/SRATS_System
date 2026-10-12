import { apiClient } from '../api/client';
import type { AppNotification } from '../types';

export const notificationService = {
  /**
   * List notifications for authenticated user (ordered by newest first).
   */
  async listNotifications(): Promise<AppNotification[]> {
    const res = await apiClient.get<{ notifications: AppNotification[] }>('/notifications');
    return res.notifications;
  },

  /**
   * Retrieve real database-derived count of unread notifications.
   */
  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get<{ unreadCount: number }>('/notifications/unread-count');
    return res.unreadCount;
  },

  /**
   * Mark single notification as read.
   */
  async markAsRead(id: string): Promise<boolean> {
    const res = await apiClient.post<{ success: boolean }>(`/notifications/${id}/read`);
    return res.success;
  },

  /**
   * Mark all unread notifications as read.
   */
  async markAllAsRead(): Promise<number> {
    const res = await apiClient.post<{ markedCount: number }>('/notifications/mark-all-read');
    return res.markedCount;
  },
};
