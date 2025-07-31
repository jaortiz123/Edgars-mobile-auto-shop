/**
 * Test Type Guards and Utilities
 * This file contains runtime type checking functions for test types
 */

// ===============================
// MOCK API RESPONSE INTERFACES
// ===============================

export interface MockApiResponse<T = unknown> {
  success: boolean;
  data: T;
  errors: string[] | null;
  meta: {
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}

export interface MockApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MockResponseEnvelope<T> {
  data: T;
  errors: MockApiError[] | null;
  meta: {
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}

// ===============================
// APPOINTMENT TEST INTERFACES
// ===============================

export interface MockAppointmentData {
  id: string;
  customer_name: string;
  customer_phone?: string;
  service: string;
  scheduled_at: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: number;
  paid_amount: number;
  location_address?: string;
  notes?: string;
}

export interface MockBoardData {
  columns: MockBoardColumn[];
  cards: MockBoardCard[];
}

export interface MockBoardColumn {
  key: string;
  title: string;
  count: number;
  sum: number;
}

export interface MockBoardCard {
  id: string;
  customerName: string;
  vehicle: string;
  servicesSummary: string;
  status: string;
  position: number;
  price: number;
  start: string;
  end: string;
}

// ===============================
// DASHBOARD STATS INTERFACES
// ===============================

export interface MockDashboardStats {
  jobsToday: number;
  carsOnPremises: number;
  scheduled: number;
  inProgress: number;
  ready: number;
  completed: number;
  noShow: number;
  unpaidTotal: number;
}

export interface MockDetailedStats {
  totals: {
    today: number;
    week: number;
    unpaid_total: number;
  };
  countsByStatus: {
    scheduled: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  carsOnPremises: MockCarOnPremises[];
}

export interface MockCarOnPremises {
  license: string;
  customer: string;
  arrival: string;
}

// ===============================
// MOVE APPOINTMENT INTERFACES
// ===============================

export interface MockMoveAppointmentRequest {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  position: number;
}

export interface MockMoveAppointmentResponse {
  id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  position: number;
}

// ===============================
// NOTIFICATION INTERFACES
// ===============================

export interface MockNotification {
  id: string;
  type: 'arrival' | 'late' | 'overdue' | 'reminder' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  urgent?: boolean;
  autoClose?: boolean;
  persistent?: boolean;
  read?: boolean;
}

export interface MockNotificationOptions {
  urgent?: boolean;
  autoClose?: boolean;
  persistent?: boolean;
  metadata?: Record<string, unknown>;
}

// ===============================
// TIME MOCK INTERFACES
// ===============================

export interface MockTimeConfig {
  fixedNow?: Date;
  autoAdvance?: boolean;
  cacheEnabled?: boolean;
  timezone?: string;
}

export interface MockTimeCacheStats {
  size: number;
  hitRate: number;
  memoryUsage: number;
}

// ===============================
// API MOCK CONFIG INTERFACES
// ===============================

export interface MockApiConfig {
  networkDelay?: number;
  failureRate?: number;
  enableCaching?: boolean;
  responseVariations?: boolean;
}

export interface MockApiRequestParams {
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

export interface MockApiResponseData {
  items: MockAppointmentData[];
  nextCursor: string | null;
  totalCount: number;
}

// ===============================
// FACTORY CONFIG INTERFACES
// ===============================

export interface TestMockFactoryConfig {
  time?: MockTimeConfig;
  api?: MockApiConfig;
  enableBrowserApis?: boolean;
  enableNotifications?: boolean;
}

// ===============================
// TEST UTILITY INTERFACES
// ===============================

export interface TestScenarioConfig {
  appointmentCount?: number;
  timeOffset?: number; // minutes from now
  statuses?: ('scheduled' | 'in_progress' | 'completed' | 'cancelled')[];
}

export interface AppointmentTestScenario {
  id: string;
  customer_name: string;
  service: string;
  scheduledAt: string;
  status: string;
  minutesUntilStart: number;
  isOverdue: boolean;
  isStartingSoon: boolean;
}

// ===============================
// BROWSER API MOCK INTERFACES
// ===============================

export interface MockIntersectionObserverEntry {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio: number;
  boundingClientRect: DOMRectReadOnly;
  rootBounds: DOMRectReadOnly | null;
  time: number;
}

export interface MockIntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export interface MockResizeObserverEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  borderBoxSize: readonly ResizeObserverSize[];
  contentBoxSize: readonly ResizeObserverSize[];
}

export interface MockGeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export interface MockGeolocationError {
  code: number;
  message: string;
}

export interface MockGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

// ===============================
// DOM MOCK INTERFACES
// ===============================

export interface MockComputedStyle {
  getPropertyValue: (property: string) => string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  outlineWidth: string;
  margin: string;
  padding?: string;
}

export interface MockElementStyle {
  getPropertyValue: (property: string) => string;
  setProperty: (property: string, value: string) => void;
}

export interface MockDocumentElement {
  style: MockElementStyle;
}

export interface MockDocument {
  documentElement: MockDocumentElement;
  createElement: (tagName: string) => HTMLElement;
  querySelectorAll: (selector: string) => Element[];
  styleSheets: MockStyleSheet[];
}

export interface MockWindow {
  getComputedStyle: (element: Element) => MockComputedStyle;
  performance: {
    now: () => number;
  };
}

export interface MockElement {
  getBoundingClientRect: () => DOMRect;
  matches: (selector: string) => boolean;
  className?: string;
}

export interface MockCSSRule {
  cssText: string;
}

export interface MockStyleSheet {
  cssRules: MockCSSRule[];
}

// ===============================
// DESIGN SYSTEM TEST INTERFACES
// ===============================

export interface MockAccessibilityElement {
  getBoundingClientRect: () => { width: number; height: number };
  matches: (selector: string) => boolean;
  className?: string;
}

export interface MockPerformanceElement {
  getBoundingClientRect: () => { width: number; height: number };
}

// Type-safe global mock declarations - standalone interfaces
export interface MockGlobalDocument {
  documentElement: {
    style: {
      getPropertyValue: (property: string) => string;
      setProperty: (property: string, value: string) => void;
    };
  };
  createElement: (tagName: string) => HTMLElement;
  querySelectorAll: (selector: string) => Element[];
  styleSheets: MockStyleSheet[];
}

export interface MockGlobalWindow {
  getComputedStyle: (element: Element) => MockComputedStyle;
  performance: {
    now: () => number;
  };
}

// ===============================
// UTILITY TYPES
// ===============================

export type MockAppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MockNotificationType = 'arrival' | 'late' | 'overdue' | 'reminder' | 'info' | 'warning' | 'error';
export type MockUrgencyLevel = 'normal' | 'medium' | 'high' | 'critical';

// Generic mock factory function type
export type MockFactory<T> = () => T;

// Mock function with tracking capabilities
export interface TrackedMockFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T>;
  getCallCount(): number;
  getLastCall(): Parameters<T> | undefined;
  reset(): void;
}

// ===============================
// TYPE GUARDS
// ===============================

export function isMockAppointmentData(obj: unknown): obj is MockAppointmentData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as MockAppointmentData).id === 'string' &&
    typeof (obj as MockAppointmentData).customer_name === 'string' &&
    typeof (obj as MockAppointmentData).service === 'string' &&
    typeof (obj as MockAppointmentData).scheduled_at === 'string' &&
    typeof (obj as MockAppointmentData).status === 'string' &&
    typeof (obj as MockAppointmentData).total_amount === 'number' &&
    typeof (obj as MockAppointmentData).paid_amount === 'number'
  );
}

export function isMockNotification(obj: unknown): obj is MockNotification {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as MockNotification).id === 'string' &&
    typeof (obj as MockNotification).type === 'string' &&
    typeof (obj as MockNotification).message === 'string' &&
    (obj as MockNotification).timestamp instanceof Date
  );
}
