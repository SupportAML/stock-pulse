'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'alert' | 'success' | 'signal' | 'trade' | 'prediction';
  title: string;
  message: string;
  // API returns "createdAt" (number ms) not "timestamp"
  createdAt?: number;
  timestamp?: string | number;
  read: boolean;
  urgency?: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/markets/notifications');
        if (!response.ok) throw new Error('Failed to fetch notifications');
        const data = await response.json();
        setNotifications(data.notifications || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/markets/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Route expects { action: 'markRead', id } — not { notificationId }
        body: JSON.stringify({ action: 'markRead', id: notificationId }),
      });

      if (!response.ok) throw new Error('Failed to mark as read');
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) => handleMarkAsRead(n.id))
      );
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIconColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'alert':
        return 'text-red-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  };

  const getUrgencyColor = (type: string) => {
    switch (type) {
      case 'alert':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'success':
        return 'text-green-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  };

  const getTimeAgo = (notification: Notification) => {
    // API returns createdAt (number ms); fall back to timestamp field
    const raw = notification.createdAt ?? notification.timestamp;
    if (!raw) return 'recently';
    const date = new Date(typeof raw === 'number' ? raw : raw);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-700">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-white font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-blue-500 hover:text-blue-400 text-xs font-semibold transition"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <p>Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <p>No notifications</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-700 hover:bg-gray-700/50 transition cursor-pointer ${
                    !notification.read ? 'bg-gray-700/30' : ''
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    <div className={`mt-1 ${getIconColor(notification.type)}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-white font-semibold text-sm">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></div>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className={`text-xs mt-1 ${getUrgencyColor(notification.type)}`}>
                        {getTimeAgo(notification)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="px-4 py-2 border-t border-gray-700 text-center">
              <a href="/notifications" className="text-blue-500 hover:text-blue-400 text-xs font-semibold">
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
