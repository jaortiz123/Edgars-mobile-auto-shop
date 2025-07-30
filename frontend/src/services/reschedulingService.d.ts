// TypeScript declarations for reschedulingService.js
export interface RescheduleResult {
  success: boolean;
  newDateTime?: string;
  message?: string;
  error?: string;
}

export interface RescheduleOptions {
  daysAhead?: number;
  reason?: string;
}

export declare function rescheduleToTimeSlot(
  appointmentId: string,
  newTime: string,
  newDate: string,
  options?: RescheduleOptions
): Promise<RescheduleResult>;

export declare function quickRescheduleToNext(
  appointmentId: string,
  serviceType: string,
  options?: RescheduleOptions
): Promise<RescheduleResult>;

export declare function validateReschedule(
  appointmentId: string,
  newTime: string,
  newDate: string
): Promise<{
  valid: boolean;
  reason?: string;
  slot?: any;
}>;

export declare function getSuggestedRescheduleOptions(
  appointmentId: string,
  serviceType: string,
  maxOptions?: number
): Promise<Array<{
  time: string;
  date: string;
  datetime: string;
  label: string;
}>>;

export declare function clearRescheduleCache(appointmentId?: string): void;

declare const reschedulingService: {
  rescheduleToTimeSlot: typeof rescheduleToTimeSlot;
  quickRescheduleToNext: typeof quickRescheduleToNext;
  validateReschedule: typeof validateReschedule;
  getSuggestedRescheduleOptions: typeof getSuggestedRescheduleOptions;
  clearRescheduleCache: typeof clearRescheduleCache;
};

export default reschedulingService;
