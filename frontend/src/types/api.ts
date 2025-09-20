/**
 * API Type Definitions for Edgar's Mobile Auto Shop Status Board
 * Generated from T8 Frontend Integration Contracts
 * Based on T7 Load Testing Results: Board 385ms p95, Stats 411ms p95
 */

// ===== PERFORMANCE CONSTANTS =====

export const API_TIMEOUTS = {
  statusBoard: 2000,      // 2s (5x measured p95 + margin)
  dashboardStats: 1500,   // 1.5s (3x measured p95 + margin)
  moveOperations: 1000,   // 1s (2.5x measured p95 + margin)
  healthCheck: 500        // 0.5s (fast fail)
} as const;

export const SLO_THRESHOLDS = {
  statusBoard: 800,       // ms p95
  dashboardStats: 500,    // ms p95
  moveOperations: 400,    // ms p95
  errorRate: 0.005        // <0.5%
} as const;

// ===== CORE DATA TYPES =====

export type AppointmentStatus =
  | 'scheduled'
  | 'in_progress'
  | 'ready'
  | 'completed'
  | 'no_show';

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes?: number;
}

export interface StatusColumn {
  id: AppointmentStatus;
  label: string;
  count: number;
  position: number;
}

export interface AppointmentCard {
  id: string;
  version: number;           // For optimistic updates & conflict detection
  customer_name: string;
  customer_phone: string;
  vehicle_info: string;
  services: Service[];
  status: AppointmentStatus;
  position: number;          // Within column
  appt_start: string;        // ISO datetime
  appt_end: string;          // ISO datetime
  tech_name?: string;
  total_amount?: number;
  paid_amount?: number;
  check_in_at?: string;      // ISO datetime
  check_out_at?: string;     // ISO datetime
}

// ===== API REQUEST/RESPONSE TYPES =====

export interface BoardRequest {
  from: string;        // ISO date: "2025-09-20"
  to: string;          // ISO date: "2025-09-20"
  techId?: string;     // Optional filter
}

export interface BoardResponse {
  columns: StatusColumn[];
  cards: AppointmentCard[];
  metadata: {
    total_appointments: number;
    response_time_ms: number;
    cache_status?: 'hit' | 'miss';
    generated_at: string;  // ISO timestamp
  };
}

export interface StatsRequest {
  from: string;        // ISO date: "2025-09-20"
  to: string;          // ISO date: "2025-09-20"
}

export interface StatsResponse {
  jobs_today: number;
  cars_on_premises: number;
  status_counts: Record<AppointmentStatus, number>;
  unpaid_total: number;
  revenue_today: number;
  metadata: {
    response_time_ms: number;
    as_of: string;  // ISO timestamp
  };
}

export interface MoveRequest {
  status: AppointmentStatus;
  position: number;
  version: number;     // For conflict detection
}

export interface MoveResponse {
  id: string;
  version: number;     // Incremented after successful move
  status: AppointmentStatus;
  position: number;
  updated_at: string;  // ISO timestamp
}

// ===== ERROR TYPES =====

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  retry_after?: number;  // ms
}

export class ApiErrorClass extends Error implements ApiError {
  public readonly error: string;
  public readonly details?: Record<string, unknown>;
  public readonly retry_after?: number;

  constructor(message: string, error: string, details?: Record<string, unknown>, retry_after?: number) {
    super(message);
    this.name = 'ApiError';
    this.error = error;
    this.details = details;
    this.retry_after = retry_after;
  }
}

export interface ValidationError extends ApiError {
  error: 'validation_error';
  field_errors: Record<string, string[]>;
}

export interface ConflictError extends ApiError {
  error: 'version_conflict';
  current_version: number;
  provided_version: number;
  current_state: Partial<AppointmentCard>;
}

export interface TimeoutError extends ApiError {
  error: 'timeout_error';
  timeout_ms: number;
}

export interface RateLimitError extends ApiError {
  error: 'rate_limit_exceeded';
  retry_after: number;  // seconds
  limit: number;
  remaining: number;
}

// ===== HTTP CLIENT TYPES =====

export interface RequestConfig {
  timeout?: number;
  retries?: number;
  baseDelay?: number;    // ms
  maxDelay?: number;     // ms
  headers?: Record<string, string>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;     // ms
  maxDelay: number;      // ms
  shouldRetry: (error: ApiError) => boolean;
}

// ===== STORE/STATE TYPES =====

export interface LoadingStates {
  boardLoading: boolean;
  statsLoading: boolean;
  refreshing: boolean;
  movePending: Record<string, boolean>;  // appointmentId -> pending
}

export interface ErrorStates {
  boardError?: ApiError;
  statsError?: ApiError;
  moveErrors: Record<string, ApiError | undefined>;  // appointmentId -> error
}

export interface OptimisticUpdate {
  appointmentId: string;
  originalState: Partial<AppointmentCard>;
  pendingState: Partial<AppointmentCard>;
  timestamp: number;
  retryCount: number;
}

export interface StatusBoardState {
  board?: BoardResponse;
  stats?: StatsResponse;
  loading: LoadingStates;
  errors: ErrorStates;
  optimisticUpdates: OptimisticUpdate[];
  lastFetch: Record<string, number>;  // endpoint -> timestamp
}

// ===== ACTION TYPES =====

export type StatusBoardAction =
  | { type: 'FETCH_BOARD_START' }
  | { type: 'FETCH_BOARD_SUCCESS'; payload: BoardResponse }
  | { type: 'FETCH_BOARD_ERROR'; payload: ApiError }
  | { type: 'FETCH_STATS_START' }
  | { type: 'FETCH_STATS_SUCCESS'; payload: StatsResponse }
  | { type: 'FETCH_STATS_ERROR'; payload: ApiError }
  | { type: 'MOVE_START'; payload: { appointmentId: string } }
  | { type: 'MOVE_SUCCESS'; payload: { appointmentId: string; response: MoveResponse } }
  | { type: 'MOVE_ERROR'; payload: { appointmentId: string; error: ApiError } }
  | { type: 'MOVE_OPTIMISTIC'; payload: OptimisticUpdate }
  | { type: 'MOVE_ROLLBACK'; payload: { appointmentId: string } }
  | { type: 'CLEAR_ERROR'; payload: { type: keyof ErrorStates; id?: string } }
  | { type: 'SET_REFRESHING'; payload: boolean };

// ===== HOOK RETURN TYPES =====

export interface UseStatusBoardReturn {
  // Data
  board?: BoardResponse;
  stats?: StatsResponse;

  // State
  loading: LoadingStates;
  errors: ErrorStates;

  // Actions
  fetchBoard: (params: BoardRequest, config?: RequestConfig) => Promise<BoardResponse>;
  fetchStats: (params: StatsRequest, config?: RequestConfig) => Promise<StatsResponse>;
  moveAppointment: (
    appointmentId: string,
    status: AppointmentStatus,
    position: number,
    config?: RequestConfig
  ) => Promise<MoveResponse>;

  // Utilities
  refreshBoard: (preserveOptimistic?: boolean) => Promise<void>;
  refreshStats: () => Promise<void>;
  clearError: (type: keyof ErrorStates, id?: string) => void;
  retryFailedMove: (appointmentId: string) => Promise<void>;
}

// ===== API CLIENT INTERFACE =====

export interface StatusBoardApiClient {
  fetchBoard(params: BoardRequest, config?: RequestConfig): Promise<BoardResponse>;
  fetchStats(params: StatsRequest, config?: RequestConfig): Promise<StatsResponse>;
  moveAppointment(
    appointmentId: string,
    request: MoveRequest,
    config?: RequestConfig
  ): Promise<MoveResponse>;

  // Health & utilities
  healthCheck(config?: RequestConfig): Promise<{ status: 'ok'; timestamp: string }>;
  getAppointment(appointmentId: string, config?: RequestConfig): Promise<AppointmentCard>;
}

// ===== CONFIGURATION TYPES =====

export interface ApiClientConfig {
  baseURL: string;
  defaultTimeout: number;
  retryConfig: RetryConfig;
  headers?: Record<string, string>;
}

export interface StatusBoardConfig {
  apiClient: StatusBoardApiClient;
  pollingInterval?: number;     // ms
  optimisticTimeout?: number;   // ms
  maxOptimisticUpdates?: number;
  enablePolling?: boolean;
}

// ===== UTILITY TYPES =====

export type ApiEndpoint = 'board' | 'stats' | 'move' | 'health';

export interface PerformanceMetrics {
  endpoint: ApiEndpoint;
  latency: number;        // ms
  success: boolean;
  timestamp: number;
  retryCount: number;
}

export interface SLOViolation {
  endpoint: ApiEndpoint;
  threshold: number;      // ms
  actual: number;         // ms
  timestamp: number;
}

// ===== COMPONENT PROP TYPES =====

export interface StatusBoardProps {
  dateRange: { from: string; to: string };
  techId?: string;
  onAppointmentClick?: (appointment: AppointmentCard) => void;
  onMoveAppointment?: (
    appointmentId: string,
    fromStatus: AppointmentStatus,
    toStatus: AppointmentStatus,
    position: number
  ) => void;
  className?: string;
}

export interface StatusColumnProps {
  column: StatusColumn;
  cards: AppointmentCard[];
  onMoveCard: (cardId: string, position: number) => void;
  onCardClick?: (card: AppointmentCard) => void;
  loading?: boolean;
  className?: string;
}

export interface AppointmentCardProps {
  appointment: AppointmentCard;
  onClick?: (appointment: AppointmentCard) => void;
  dragging?: boolean;
  optimistic?: boolean;
  error?: ApiError;
  className?: string;
}

export interface DashboardStatsProps {
  dateRange: { from: string; to: string };
  refreshInterval?: number;  // ms
  onStatsClick?: (metric: keyof StatsResponse) => void;
  className?: string;
}

// ===== HELPER FUNCTION TYPES =====

export type DateFormatter = (date: string) => string;
export type TimeFormatter = (datetime: string) => string;
export type CurrencyFormatter = (amount: number) => string;
export type StatusFormatter = (status: AppointmentStatus) => string;

export interface FormatUtils {
  formatDate: DateFormatter;
  formatTime: TimeFormatter;
  formatCurrency: CurrencyFormatter;
  formatStatus: StatusFormatter;
  formatLatency: (ms: number) => string;
}

// ===== VALIDATION HELPERS =====

export interface ValidationUtils {
  isValidDate: (date: string) => boolean;
  isValidStatus: (status: string) => status is AppointmentStatus;
  isValidPosition: (position: number, columnLength: number) => boolean;
  isValidVersion: (version: unknown) => version is number;
}

// ===== EXPORT CONVENIENCE =====

export type {
  // Re-export commonly used types for convenience
  AppointmentCard as Appointment,
  StatusColumn as Column,
  AppointmentStatus as Status,
  BoardResponse as Board,
  StatsResponse as Stats,
};

// Default export for the main API client config
export const DEFAULT_API_CONFIG: ApiClientConfig = {
  baseURL: process.env.REACT_APP_API_URL || 'https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws',
  defaultTimeout: API_TIMEOUTS.statusBoard,
  retryConfig: {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 1000,
    shouldRetry: (error) => {
      // Retry on 5xx, timeout, network errors - not on 4xx client errors
      return error.error === 'timeout_error' ||
             error.error === 'internal_server_error' ||
             (error as any).status >= 500;
    }
  },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};
