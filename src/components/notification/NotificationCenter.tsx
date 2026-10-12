import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  Check,
  Calendar,
  FileText,
  UserCheck,
  XCircle,
  Briefcase,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import type { AppNotification } from '../../types';

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'APPLICATION_SUBMITTED':
    case 'NEW_APPLICATION_RECEIVED':
      return <FileText className="w-4 h-4 text-indigo-600" />;
    case 'APPLICATION_SHORTLISTED':
    case 'APPLICATION_SELECTED':
    case 'APPLICATION_HIRED':
      return <UserCheck className="w-4 h-4 text-emerald-600" />;
    case 'APPLICATION_REJECTED':
      return <XCircle className="w-4 h-4 text-rose-500" />;
    case 'INTERVIEW_SCHEDULED':
    case 'INTERVIEW_ASSIGNED':
    case 'INTERVIEW_RESCHEDULED':
      return <Calendar className="w-4 h-4 text-blue-600" />;
    case 'INTERVIEW_CANCELLED':
      return <AlertCircle className="w-4 h-4 text-amber-600" />;
    case 'INTERVIEW_FEEDBACK_RECEIVED':
      return <Briefcase className="w-4 h-4 text-purple-600" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Real-time unread count query
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 15000,
    retry: (failureCount, error: any) => error?.status !== 401 && failureCount < 2,
  });

  // Notifications query (only fetch when open or unread count changes)
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: notificationService.listNotifications,
    enabled: isOpen,
  });

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displayedNotifications = notifications.filter((notif) => {
    if (filter === 'UNREAD') return notif.is_read === 0;
    return true;
  });

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-rose-100 text-rose-700 rounded-md">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-1 bg-white text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter === 'ALL'
                  ? 'bg-slate-100 font-semibold text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter === 'UNREAD'
                  ? 'bg-slate-100 font-semibold text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications Scroll Area */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-slate-400" />
                Loading notifications...
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Real domain events (applications, interviews, status updates) appear here automatically.
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isUnread = notif.is_read === 0;
                return (
                  <div
                    key={notif.id}
                    className={`p-3 transition-colors flex items-start gap-3 ${
                      isUnread ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs shrink-0">
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400">
                          {notif.type}
                        </span>
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => markReadMutation.mutate(notif.id)}
                            disabled={markReadMutation.isPending}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-center">
            <span className="text-[10px] text-slate-400 font-normal">
              Database-backed domain notifications · Real-time event tracking
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
