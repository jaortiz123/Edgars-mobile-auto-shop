import { statusBoardClient } from './statusBoardClient';

// SLO targets from Sprint 3 plan
const SLO_TARGETS = {
  BOARD_LOAD_TIME: 800, // ms
  STATS_LOAD_TIME: 400, // ms
  MOVE_OPERATION: 2000, // ms
} as const;

// Metric types
export interface ClientMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  sloTarget?: number;
  isSuccess?: boolean;
}

// In-memory storage for metrics (could be replaced with real metrics system)
class MetricsCollector {
  private metrics: ClientMetric[] = [];
  private readonly MAX_METRICS = 1000; // Prevent memory leaks

  // Collect a metric
  collect(metric: Omit<ClientMetric, 'timestamp'>): void {
    const fullMetric: ClientMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    // Add to collection
    this.metrics.push(fullMetric);

    // Trim if needed
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log performance issues
    if (fullMetric.sloTarget && fullMetric.value > fullMetric.sloTarget) {
      console.warn(`SLO violation: ${fullMetric.name} took ${fullMetric.value}ms (target: ${fullMetric.sloTarget}ms)`);
    }

    // Log the metric (in real system, would send to metrics backend)
    console.log(`Metric: ${fullMetric.name} = ${fullMetric.value}ms`, fullMetric.tags);
  }

  // Get recent metrics for a given name
  getMetrics(name: string, limit = 10): ClientMetric[] {
    return this.metrics
      .filter(m => m.name === name)
      .slice(-limit);
  }

  // Get performance summary
  getSummary(): Record<string, { avg: number; p95: number; sloViolations: number }> {
    const summary: Record<string, { values: number[]; sloTarget?: number }> = {};

    this.metrics.forEach(metric => {
      if (!summary[metric.name]) {
        summary[metric.name] = { values: [], sloTarget: metric.sloTarget };
      }
      summary[metric.name].values.push(metric.value);
    });

    const result: Record<string, { avg: number; p95: number; sloViolations: number }> = {};

    Object.entries(summary).forEach(([name, data]) => {
      const values = data.values.sort((a, b) => a - b);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const p95Index = Math.floor(values.length * 0.95);
      const p95 = values[p95Index] || 0;
      const sloViolations = data.sloTarget
        ? values.filter(v => v > data.sloTarget!).length
        : 0;

      result[name] = { avg, p95, sloViolations };
    });

    return result;
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Helper functions for specific operations
export const collectBoardLoadMetric = (duration: number, success: boolean = true) => {
  metricsCollector.collect({
    name: 'board_load_time',
    value: duration,
    sloTarget: SLO_TARGETS.BOARD_LOAD_TIME,
    isSuccess: success,
    tags: { operation: 'board_fetch' }
  });
};

export const collectStatsLoadMetric = (duration: number, success: boolean = true) => {
  metricsCollector.collect({
    name: 'stats_load_time',
    value: duration,
    sloTarget: SLO_TARGETS.STATS_LOAD_TIME,
    isSuccess: success,
    tags: { operation: 'stats_fetch' }
  });
};

export const collectMoveOperationMetric = (duration: number, success: boolean = true) => {
  metricsCollector.collect({
    name: 'move_operation_time',
    value: duration,
    sloTarget: SLO_TARGETS.MOVE_OPERATION,
    isSuccess: success,
    tags: { operation: 'appointment_move' }
  });
};

// Performance timing wrapper
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  metricName: string,
  sloTarget?: number
): T {
  return (async (...args: any[]) => {
    const startTime = performance.now();
    let success = true;

    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      metricsCollector.collect({
        name: metricName,
        value: duration,
        sloTarget,
        isSuccess: success,
        tags: { function: fn.name }
      });
    }
  }) as T;
}

// Export SLO targets for use in components
export { SLO_TARGETS };
