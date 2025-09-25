// Performance monitoring utilities for StatusBoardV2
// Sprint 6 T7 - Performance monitoring with SLO compliance

export interface PerformanceMetrics {
  boardLoad: number;
  drawerOpen: number;
  dragOperation: number;
  apiResponse: number;
}

export interface PerformanceSLO {
  boardLoadTarget: 800; // ms
  drawerOpenTarget: 200; // ms
  dragOperationTarget: 100; // ms
  apiResponseTarget: 500; // ms
}

class StatusBoardPerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private slo: PerformanceSLO = {
    boardLoadTarget: 800,
    drawerOpenTarget: 200,
    dragOperationTarget: 100,
    apiResponseTarget: 500
  };

  // Start timing measurement
  startTiming(operation: string): void {
    this.metrics.set(`${operation}_start`, performance.now());
  }

  // End timing measurement and report
  endTiming(operation: string): number {
    const startTime = this.metrics.get(`${operation}_start`);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.set(operation, duration);

    // Check SLO compliance
    this.checkSLOCompliance(operation, duration);

    return duration;
  }

  // Check if operation meets SLO targets
  private checkSLOCompliance(operation: string, duration: number): void {
    let target: number;

    switch (operation) {
      case 'boardLoad':
        target = this.slo.boardLoadTarget;
        break;
      case 'drawerOpen':
        target = this.slo.drawerOpenTarget;
        break;
      case 'dragOperation':
        target = this.slo.dragOperationTarget;
        break;
      case 'apiResponse':
        target = this.slo.apiResponseTarget;
        break;
      default:
        return;
    }

    if (duration > target) {
      console.warn(`⚠️ SLO violation: ${operation} took ${duration.toFixed(2)}ms (target: ${target}ms)`);

      // Report to monitoring service in production
      if (import.meta.env.PROD) {
        this.reportSLOViolation(operation, duration, target);
      }
    } else {
      console.log(`✅ SLO compliance: ${operation} took ${duration.toFixed(2)}ms (target: ${target}ms)`);
    }
  }

  // Report SLO violation to monitoring service
  private reportSLOViolation(operation: string, actual: number, target: number): void {
    // In a real implementation, this would send to monitoring service
    // For now, just log structured data
    const violationData = {
      timestamp: new Date().toISOString(),
      operation,
      actual_ms: actual,
      target_ms: target,
      violation_percentage: ((actual - target) / target) * 100,
      component: 'StatusBoardV2'
    };

    console.error('SLO_VIOLATION', violationData);

    // Could integrate with services like:
    // - DataDog
    // - New Relic
    // - Custom metrics endpoint
  }

  // Get performance summary
  getPerformanceSummary(): PerformanceMetrics {
    return {
      boardLoad: this.metrics.get('boardLoad') || 0,
      drawerOpen: this.metrics.get('drawerOpen') || 0,
      dragOperation: this.metrics.get('dragOperation') || 0,
      apiResponse: this.metrics.get('apiResponse') || 0
    };
  }

  // Reset metrics
  reset(): void {
    this.metrics.clear();
  }

  // Check if all SLOs are meeting targets
  isPerformanceHealthy(): boolean {
    const summary = this.getPerformanceSummary();

    return (
      summary.boardLoad <= this.slo.boardLoadTarget &&
      summary.drawerOpen <= this.slo.drawerOpenTarget &&
      summary.dragOperation <= this.slo.dragOperationTarget &&
      summary.apiResponse <= this.slo.apiResponseTarget
    );
  }
}

// Singleton instance
export const performanceMonitor = new StatusBoardPerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const startTiming = (operation: string) => {
    performanceMonitor.startTiming(operation);
  };

  const endTiming = (operation: string) => {
    return performanceMonitor.endTiming(operation);
  };

  const getMetrics = () => {
    return performanceMonitor.getPerformanceSummary();
  };

  const isHealthy = () => {
    return performanceMonitor.isPerformanceHealthy();
  };

  return {
    startTiming,
    endTiming,
    getMetrics,
    isHealthy
  };
};
