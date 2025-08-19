import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface NotificationRecord {
  appointment_id: string;
  notification_type: string;
  status: 'sent' | 'failed' | 'pending';
  timestamp: string;
  error_message?: string;
  customer_name?: string;
  customer_phone?: string;
  appointment_time?: string;
}

interface NotificationTrackerProps {
  appointmentId?: string;
}

export const NotificationTracker: React.FC<NotificationTrackerProps> = ({ appointmentId }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [appointmentId, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appointmentId) params.append('appointment_id', appointmentId);
      if (filter !== 'all') params.append('status', filter);

      const response = await fetch(`/api/admin/notifications?${params}`);
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      sent: 'success',
      failed: 'destructive',
      pending: 'warning',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const retryNotification = async (appointmentId: string) => {
    try {
      await fetch(`/api/admin/notifications/${appointmentId}/retry`, {
        method: 'POST',
      });
      fetchNotifications(); // Refresh the list
    } catch (error) {
      console.error('Failed to retry notification:', error);
    }
  };

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' || n.status === filter
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Notification Tracking
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNotifications}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {(['all', 'sent', 'failed', 'pending'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No notifications found for the selected filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification, index) => (
              <div
                key={`${notification.appointment_id}-${notification.notification_type}-${index}`}
                className="border rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(notification.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {notification.notification_type.replace('_', ' ').toUpperCase()}
                        </span>
                        {getStatusBadge(notification.status)}
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Appointment:</strong> #{notification.appointment_id}</p>
                        {notification.customer_name && (
                          <p><strong>Customer:</strong> {notification.customer_name}</p>
                        )}
                        {notification.customer_phone && (
                          <p><strong>Phone:</strong> {notification.customer_phone}</p>
                        )}
                        {notification.appointment_time && (
                          <p><strong>Appointment Time:</strong> {new Date(notification.appointment_time).toLocaleString()}</p>
                        )}
                        <p><strong>Sent:</strong> {new Date(notification.timestamp).toLocaleString()}</p>

                        {notification.error_message && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                            <strong>Error:</strong> {notification.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {notification.status === 'failed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryNotification(notification.appointment_id)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationTracker;
