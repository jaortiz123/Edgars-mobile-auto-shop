import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { getNotifications, markNotificationAsRead, clearAllNotifications } from '@/services/notificationService';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState(getNotifications());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen for real-time notification updates
    const handleNotificationAdded = () => {
      setNotifications(getNotifications());
    };
    
    const handleNotificationUpdated = () => {
      setNotifications(getNotifications());
    };

    window.addEventListener('notificationAdded', handleNotificationAdded);
    window.addEventListener('notificationUpdated', handleNotificationUpdated);
    
    return () => {
      window.removeEventListener('notificationAdded', handleNotificationAdded);
      window.removeEventListener('notificationUpdated', handleNotificationUpdated);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id);
    setNotifications(getNotifications()); // Refresh state
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-sp-2 rounded-full hover:bg-gray-200 relative"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-4 w-4 rounded-full ring-2 ring-white bg-red-500 text-white text-fs-0 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-sp-2 w-80 bg-white rounded-lg shadow-xl z-50">
          <div className="p-sp-3 border-b flex justify-between items-center">
            <h3 className="font-bold">Notifications</h3>
            <div className="flex items-center gap-sp-2">
              {notifications.length > 0 && (
                <button 
                  onClick={() => {
                    clearAllNotifications();
                    setNotifications([]);
                  }}
                  className="text-fs-0 text-blue-500 hover:underline"
                  title="Clear all notifications"
                >
                  Clear All
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-sp-1 rounded-full hover:bg-gray-100"
                aria-label="Close notifications"
                title="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-sp-3 text-fs-1 text-gray-500">No new notifications.</p>
            ) : (
              notifications.map(notification => (
                <div key={notification.id} className={`p-sp-3 border-b ${
                  notification.read ? 'bg-gray-50' : 'bg-white'
                }`}>
                  <p className="text-fs-1">{notification.message}</p>
                  <p className="text-fs-0 text-gray-500 mt-sp-1">
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="text-fs-0 text-blue-500 hover:underline mt-sp-1"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
