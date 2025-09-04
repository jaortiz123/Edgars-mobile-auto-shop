interface AvailableSlot {
  date: string;
  time: string;
}

export const getAvailableSlots = (serviceId: string): Promise<AvailableSlot[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock data for demonstration
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const slots: AvailableSlot[] = [
        { date: today.toISOString().split('T')[0], time: '09:00 AM' },
        { date: today.toISOString().split('T')[0], time: '10:00 AM' },
        { date: tomorrow.toISOString().split('T')[0], time: '09:00 AM' },
        { date: tomorrow.toISOString().split('T')[0], time: '11:00 AM' },
      ];
      resolve(slots);
    }, 500);
  });
};
