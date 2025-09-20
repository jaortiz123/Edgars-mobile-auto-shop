/**
 * Status Board API Client Implementation
 * Implements T8 Frontend Integration Contracts
 * Performance: Board 385ms p95, Stats 411ms p95 (validated in T7)
 */

import {
  StatusBoardApiClient,
  BoardRequest,
  BoardResponse,
  StatsRequest,
  StatsResponse,
  MoveRequest,
  MoveResponse,
  AppointmentCard,
  ApiError,
  ConflictError,
  TimeoutError,
  RequestConfig,
  ApiClientConfig,
  DEFAULT_API_CONFIG,
  API_TIMEOUTS
} from '../types/api';

export class StatusBoardClient implements StatusBoardApiClient {
  private config: ApiClientConfig;

  constructor(config?: Partial<ApiClientConfig>) {
    this.config = { ...DEFAULT_API_CONFIG, ...config };
  }

  // ===== PUBLIC API METHODS =====

  async fetchBoard(
    params: BoardRequest,
    config?: RequestConfig
  ): Promise<BoardResponse> {
    const url = `${this.config.baseURL}/api/admin/appointments/board`;
    const queryParams = new URLSearchParams(params as Record<string, string>);

    return this.request<BoardResponse>(
      'GET',
      `${url}?${queryParams}`,
      undefined,
      {
        timeout: API_TIMEOUTS.statusBoard,
        ...config
      }
    );
  }

  async fetchStats(
    params: StatsRequest,
    config?: RequestConfig
  ): Promise<StatsResponse> {
    const url = `${this.config.baseURL}/api/admin/dashboard/stats`;
    const queryParams = new URLSearchParams(params as Record<string, string>);

    return this.request<StatsResponse>(
      'GET',
      `${url}?${queryParams}`,
      undefined,
      {
        timeout: API_TIMEOUTS.dashboardStats,
        ...config
      }
    );
  }

  async moveAppointment(
    appointmentId: string,
    request: MoveRequest,
    config?: RequestConfig
  ): Promise<MoveResponse> {
    const url = `${this.config.baseURL}/api/admin/appointments/${appointmentId}/move`;

    return this.request<MoveResponse>(
      'PATCH',
      url,
      request,
      {
        timeout: API_TIMEOUTS.moveOperations,
        ...config
      }
    );
  }

  async getAppointment(
    appointmentId: string,
    config?: RequestConfig
  ): Promise<AppointmentCard> {
    const url = `${this.config.baseURL}/api/appointments/${appointmentId}`;

    return this.request<AppointmentCard>(
      'GET',
      url,
      undefined,
      config
    );
  }

  async healthCheck(config?: RequestConfig): Promise<{ status: 'ok'; timestamp: string }> {
    const url = `${this.config.baseURL}/health`;

    return this.request<{ status: 'ok'; timestamp: string }>(
      'GET',
      url,
      undefined,
      {
        timeout: API_TIMEOUTS.healthCheck,
        ...config
      }
    );
  }

  // ===== PRIVATE IMPLEMENTATION =====

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    const requestConfig = {
      timeout: this.config.defaultTimeout,
      retries: this.config.retryConfig.maxRetries,
      baseDelay: this.config.retryConfig.baseDelay,
      maxDelay: this.config.retryConfig.maxDelay,
      headers: this.config.headers,
      ...config
    };

    return this.retryWithBackoff(
      () => this.executeRequest<T>(method, url, data, requestConfig),
      {
        maxRetries: requestConfig.retries || 3,
        baseDelay: requestConfig.baseDelay || 100,
        maxDelay: requestConfig.maxDelay || 1000,
        shouldRetry: this.config.retryConfig.shouldRetry
      }
    );
  }

  private async executeRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config?.timeout || this.config.defaultTimeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...config?.headers
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 409) {
          throw this.createConflictError(errorData);
        }

        throw this.createApiError(response.status, errorData);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createTimeoutError(config?.timeout || this.config.defaultTimeout);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other unexpected errors
      throw this.createApiError(0, {
        error: 'network_error',
        message: error instanceof Error ? error.message : 'Unknown network error'
      });
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config: {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      shouldRetry: (error: ApiError) => boolean;
    }
  ): Promise<T> {
    let lastError: ApiError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as ApiError;

        if (attempt === config.maxRetries || !config.shouldRetry(lastError)) {
          throw error;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt),
          config.maxDelay
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private createApiError(status: number, data: any): ApiError {
    return {
      error: data.error || 'api_error',
      message: data.message || `HTTP ${status} error`,
      details: data.details,
      retry_after: data.retry_after
    };
  }

  private createConflictError(data: any): ConflictError {
    return {
      error: 'version_conflict',
      message: data.message || 'Version conflict - resource was modified',
      current_version: data.current_version,
      provided_version: data.provided_version,
      current_state: data.current_state
    };
  }

  private createTimeoutError(timeout: number): TimeoutError {
    return {
      error: 'timeout_error',
      message: `Request timed out after ${timeout}ms`,
      timeout_ms: timeout
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== CONVENIENCE FACTORY =====

export function createStatusBoardClient(config?: Partial<ApiClientConfig>): StatusBoardApiClient {
  return new StatusBoardClient(config);
}

// ===== SINGLETON INSTANCE =====

let defaultClient: StatusBoardApiClient | null = null;

export function getDefaultClient(): StatusBoardApiClient {
  if (!defaultClient) {
    defaultClient = createStatusBoardClient();
  }
  return defaultClient;
}

export function setDefaultClient(client: StatusBoardApiClient): void {
  defaultClient = client;
}

// ===== RESPONSE VALIDATORS =====

export const validateBoardResponse = (data: any): data is BoardResponse => {
  return (
    data &&
    Array.isArray(data.columns) &&
    Array.isArray(data.cards) &&
    typeof data.metadata === 'object' &&
    typeof data.metadata.total_appointments === 'number' &&
    typeof data.metadata.response_time_ms === 'number'
  );
};

export const validateStatsResponse = (data: any): data is StatsResponse => {
  return (
    data &&
    typeof data.jobs_today === 'number' &&
    typeof data.cars_on_premises === 'number' &&
    typeof data.status_counts === 'object' &&
    typeof data.unpaid_total === 'number' &&
    typeof data.revenue_today === 'number' &&
    typeof data.metadata === 'object'
  );
};

export const validateMoveResponse = (data: any): data is MoveResponse => {
  return (
    data &&
    typeof data.id === 'string' &&
    typeof data.version === 'number' &&
    typeof data.status === 'string' &&
    typeof data.position === 'number' &&
    typeof data.updated_at === 'string'
  );
};

// ===== ERROR HELPERS =====

export const isConflictError = (error: unknown): error is ConflictError => {
  return error instanceof Object && 'error' in error && error.error === 'version_conflict';
};

export const isTimeoutError = (error: unknown): error is TimeoutError => {
  return error instanceof Object && 'error' in error && error.error === 'timeout_error';
};

export const isRetryableError = (error: ApiError): boolean => {
  return (
    error.error === 'timeout_error' ||
    error.error === 'network_error' ||
    error.error === 'internal_server_error' ||
    (error.retry_after !== undefined)
  );
};

// ===== PERFORMANCE TRACKING =====

export interface RequestMetrics {
  endpoint: string;
  method: string;
  latency: number;
  success: boolean;
  status?: number;
  timestamp: number;
}

class MetricsCollector {
  private metrics: RequestMetrics[] = [];
  private maxMetrics = 1000;

  recordRequest(metrics: RequestMetrics): void {
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getMetrics(): RequestMetrics[] {
    return [...this.metrics];
  }

  getLatencyStats(endpoint?: string): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    count: number;
  } {
    const filtered = endpoint
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;

    if (filtered.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 };
    }

    const latencies = filtered.map(m => m.latency).sort((a, b) => a - b);

    return {
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      avg: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      count: latencies.length
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  reset(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

// ===== INSTRUMENTED CLIENT =====

export class InstrumentedStatusBoardClient extends StatusBoardClient {
  private async instrumentedRequest<T>(
    method: string,
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    let success = false;
    let status: number | undefined;

    try {
      const result = await operation();
      success = true;
      return result;
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        status = error.status as number;
      }
      throw error;
    } finally {
      const latency = performance.now() - start;

      metricsCollector.recordRequest({
        endpoint,
        method,
        latency,
        success,
        status,
        timestamp: Date.now()
      });
    }
  }

  async fetchBoard(params: BoardRequest, config?: RequestConfig): Promise<BoardResponse> {
    return this.instrumentedRequest('GET', 'board', () => super.fetchBoard(params, config));
  }

  async fetchStats(params: StatsRequest, config?: RequestConfig): Promise<StatsResponse> {
    return this.instrumentedRequest('GET', 'stats', () => super.fetchStats(params, config));
  }

  async moveAppointment(
    appointmentId: string,
    request: MoveRequest,
    config?: RequestConfig
  ): Promise<MoveResponse> {
    return this.instrumentedRequest('PATCH', 'move', () =>
      super.moveAppointment(appointmentId, request, config)
    );
  }
}

export function createInstrumentedClient(config?: Partial<ApiClientConfig>): StatusBoardApiClient {
  return new InstrumentedStatusBoardClient(config);
}
