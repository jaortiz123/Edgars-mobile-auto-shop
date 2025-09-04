interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const notifications: Notification[] = [];

export const scheduleReminder = (appointment: any, minutesBefore: number) => {
  const reminderTime = new Date(appointment.dateTime.getTime() - minutesBefore * 60 * 1000);
  const now = new Date();

  if (reminderTime > now) {
    const delay = reminderTime.getTime() - now.getTime();
    setTimeout(() => {
      const message = `Appointment with ${appointment.customer} starts in ${minutesBefore} minutes.`;
      addNotification(message);
      // In a real app, you'd also trigger a toast here
      alert(message); // For demonstration
    }, delay);
  }
};

export const addNotification = (message: string) => {
  const newNotification: Notification = {
    id: Date.now().toString(),
    message,
    timestamp: new Date(),
    read: false,
  };
  notifications.push(newNotification);
  // In a real app, you'd update a global state or context here
  console.log('New Notification:', newNotification);
};

export const getNotifications = (): Notification[] => {
  return notifications;
};

export const markNotificationAsRead = (id: string) => {
  const notification = notifications.find(n => n.id === id);
  if (notification) {
    notification.read = true;
  }
};
