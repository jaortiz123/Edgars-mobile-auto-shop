/**
 * Performance Monitoring and Analytics Service for Sprint 3C
 * Comprehensive monitoring with real-time metrics and optimization suggestions
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface ComponentMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
  errorCount: number;
  lastUpdate: string;
}

interface NotificationMetrics {
  sent: number;
  delivered: number;
  failed: number;
  retried: number;
  avgDeliveryTime: number;
  rateLimit: number;
}

interface TimeUtilsMetrics {
  calculations: number;
  cacheHits: number;
  cacheMisses: number;
  avgCalculationTime: number;
  errors: number;
}

export interface PerformanceReport {
  overall: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendations: string[];
  };
  components: Record<string, ComponentMetrics>;
  notifications: NotificationMetrics;
  timeUtils: TimeUtilsMetrics;
  memory: {
    used: number;
    total: number;
    pressure: 'low' | 'medium' | 'high';
  };
  network: {
    online: boolean;
    effectiveType: string;
    rtt: number;
  };
}

class PerformanceMonitoringService {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private observers: Set<PerformanceObserver> = new Set();
  private measurementQueue: PerformanceMetric[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Setup performance observers
    this.setupPerformanceObservers();
    
    // Setup memory monitoring
    this.setupMemoryMonitoring();
    
    // Setup network monitoring
    this.setupNetworkMonitoring();
    
    // Setup periodic reporting
    this.setupPeriodicReporting();
    
    console.log('📊 Sprint 3C Performance Monitoring initialized');
  }

  private setupPerformanceObservers() {
    // Measure paint timings
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('paint', entry.duration, {
              type: entry.name,
              startTime: entry.startTime
            });
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.add(paintObserver);

        // Measure navigation timing
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('navigation', navEntry.loadEventEnd - navEntry.loadEventStart, {
              type: 'page-load',
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.loadEventStart,
              firstByte: navEntry.responseStart - navEntry.loadEventStart
            });
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.add(navigationObserver);

        // Measure long tasks
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long-task', entry.duration, {
              startTime: entry.startTime,
              warning: entry.duration > 50 ? 'blocking' : 'slow'
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.add(longTaskObserver);
      } catch (error) {
        console.warn('Failed to setup performance observers:', error);
      }
    }
  }

  private setupMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as unknown as { memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        } }).memory;
        if (memory) {
          this.recordMetric('memory', memory.usedJSHeapSize, {
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            pressure: this.calculateMemoryPressure(memory)
          });
        }
      }, 30000); // Every 30 seconds
    }
  }

  private setupNetworkMonitoring() {
    if ('connection' in navigator) {
      const connection = (navigator as unknown as { connection?: {
        rtt?: number;
        effectiveType?: string;
        downlink?: number;
        addEventListener: (event: string, callback: () => void) => void;
      } }).connection;
      
      const recordNetworkInfo = () => {
        if (connection) {
          this.recordMetric('network', connection.rtt || 0, {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            online: navigator.onLine
          });
        }
      };

      recordNetworkInfo();
      if (connection) {
        connection.addEventListener('change', recordNetworkInfo);
      }
      window.addEventListener('online', recordNetworkInfo);
      window.addEventListener('offline', recordNetworkInfo);
    }
  }

  private setupPeriodicReporting() {
    // Generate performance report every 5 minutes
    setInterval(() => {
      const report = this.generateReport();
      this.analyzeAndOptimize(report);
    }, 300000);

    // Flush metrics every 30 seconds
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, 30000);
  }

  private calculateMemoryPressure(memory: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  }): 'low' | 'medium' | 'high' {
    const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    if (usage > 0.9) return 'high';
    if (usage > 0.7) return 'medium';
    return 'low';
  }

  private recordMetric(name: string, value: number, context?: Record<string, unknown>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date().toISOString(),
      context
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only last 100 metrics per type
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }

    // Add to flush queue
    this.measurementQueue.push(metric);
  }

  private flushMetrics() {
    if (this.measurementQueue.length === 0) return;

    try {
      // Store metrics in localStorage for persistence
      const stored = JSON.parse(localStorage.getItem('sprint3c_metrics') || '[]');
      stored.push(...this.measurementQueue);
      
      // Keep only last 1000 metrics
      if (stored.length > 1000) {
        stored.splice(0, stored.length - 1000);
      }
      
      localStorage.setItem('sprint3c_metrics', JSON.stringify(stored));
      this.measurementQueue = [];
    } catch (error) {
      console.warn('Failed to flush metrics:', error);
    }
  }

  // Public API for component tracking
  public trackComponent(name: string, operation: 'mount' | 'render' | 'update' | 'error', duration?: number) {
    if (!this.componentMetrics.has(name)) {
      this.componentMetrics.set(name, {
        renderTime: 0,
        mountTime: 0,
        updateCount: 0,
        errorCount: 0,
        lastUpdate: new Date().toISOString()
      });
    }

    const metrics = this.componentMetrics.get(name)!;
    
    switch (operation) {
      case 'mount':
        metrics.mountTime = duration || 0;
        break;
      case 'render':
        metrics.renderTime = duration || 0;
        break;
      case 'update':
        metrics.updateCount++;
        break;
      case 'error':
        metrics.errorCount++;
        break;
    }
    
    metrics.lastUpdate = new Date().toISOString();
    this.recordMetric(`component-${operation}`, duration || 1, { component: name });
  }

  public trackNotification(event: 'sent' | 'delivered' | 'failed' | 'retry', duration?: number) {
    this.recordMetric(`notification-${event}`, duration || 1, { event });
  }

  public trackTimeUtilsOperation(operation: 'calculation' | 'cache-hit' | 'cache-miss' | 'error', duration?: number) {
    this.recordMetric(`time-utils-${operation}`, duration || 1, { operation });
  }

  public startMeasurement(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      
      // Warn about slow operations
      if (duration > 16) { // One frame at 60fps
        console.warn(`🐌 Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  public generateReport(): PerformanceReport {
    const report: PerformanceReport = {
      overall: {
        score: 0,
        grade: 'F',
        recommendations: []
      },
      components: Object.fromEntries(this.componentMetrics),
      notifications: this.getNotificationMetrics(),
      timeUtils: this.getTimeUtilsMetrics(),
      memory: this.getMemoryMetrics(),
      network: this.getNetworkMetrics()
    };

    // Calculate overall performance score
    report.overall = this.calculateOverallScore(report);

    return report;
  }

  private getNotificationMetrics(): NotificationMetrics {
    const sent = this.getMetricCount('notification-sent');
    const delivered = this.getMetricCount('notification-delivered');
    const failed = this.getMetricCount('notification-failed');
    const retried = this.getMetricCount('notification-retry');
    
    return {
      sent,
      delivered,
      failed,
      retried,
      avgDeliveryTime: this.getMetricAverage('notification-delivered'),
      rateLimit: this.getMetricCount('notification-rate-limit')
    };
  }

  private getTimeUtilsMetrics(): TimeUtilsMetrics {
    const calculations = this.getMetricCount('time-utils-calculation');
    const cacheHits = this.getMetricCount('time-utils-cache-hit');
    const cacheMisses = this.getMetricCount('time-utils-cache-miss');
    
    return {
      calculations,
      cacheHits,
      cacheMisses,
      avgCalculationTime: this.getMetricAverage('time-utils-calculation'),
      errors: this.getMetricCount('time-utils-error')
    };
  }

  private getMemoryMetrics() {
    const latestMemory = this.getLatestMetric('memory');
    return {
      used: latestMemory?.value || 0,
      total: latestMemory?.context?.total as number || 0,
      pressure: latestMemory?.context?.pressure as 'low' | 'medium' | 'high' || 'low'
    };
  }

  private getNetworkMetrics() {
    const latestNetwork = this.getLatestMetric('network');
    return {
      online: navigator.onLine,
      effectiveType: latestNetwork?.context?.effectiveType as string || 'unknown',
      rtt: latestNetwork?.value || 0
    };
  }

  private getMetricCount(name: string): number {
    return this.metrics.get(name)?.length || 0;
  }

  private getMetricAverage(name: string): number {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  private getLatestMetric(name: string): PerformanceMetric | null {
    const metrics = this.metrics.get(name) || [];
    return metrics[metrics.length - 1] || null;
  }

  private calculateOverallScore(report: PerformanceReport): PerformanceReport['overall'] {
    let score = 100;
    const recommendations: string[] = [];

    // Memory pressure penalty
    if (report.memory.pressure === 'high') {
      score -= 30;
      recommendations.push('High memory usage detected. Consider optimizing component state and cleanup.');
    } else if (report.memory.pressure === 'medium') {
      score -= 15;
      recommendations.push('Medium memory usage. Monitor for memory leaks.');
    }

    // Component error penalty
    Object.entries(report.components).forEach(([name, metrics]) => {
      if (metrics.errorCount > 0) {
        score -= metrics.errorCount * 5;
        recommendations.push(`Component ${name} has ${metrics.errorCount} errors. Review error handling.`);
      }
      
      if (metrics.renderTime > 16) {
        score -= 10;
        recommendations.push(`Component ${name} render time (${metrics.renderTime.toFixed(2)}ms) exceeds 16ms frame budget.`);
      }
    });

    // Notification failure penalty
    if (report.notifications.failed > 0) {
      const failureRate = report.notifications.failed / Math.max(1, report.notifications.sent);
      if (failureRate > 0.1) {
        score -= 20;
        recommendations.push(`High notification failure rate (${(failureRate * 100).toFixed(1)}%). Check notification service.`);
      }
    }

    // Time utils cache efficiency
    const cacheTotal = report.timeUtils.cacheHits + report.timeUtils.cacheMisses;
    if (cacheTotal > 0) {
      const cacheHitRate = report.timeUtils.cacheHits / cacheTotal;
      if (cacheHitRate < 0.8) {
        score -= 10;
        recommendations.push(`Low cache hit rate (${(cacheHitRate * 100).toFixed(1)}%). Consider optimizing cache strategy.`);
      }
    }

    // Network penalty
    if (!report.network.online) {
      score -= 20;
      recommendations.push('Currently offline. Some features may be limited.');
    } else if (report.network.rtt > 200) {
      score -= 10;
      recommendations.push('Slow network detected. Consider optimizing for poor connections.');
    }

    // Grade calculation
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return { score: Math.max(0, score), grade, recommendations };
  }

  private analyzeAndOptimize(report: PerformanceReport) {
    // Auto-optimization based on performance metrics
    if (report.overall.score < 70) {
      console.warn('🚨 Sprint 3C Performance Warning:', report.overall);
      
      // Log recommendations
      report.overall.recommendations.forEach(rec => {
        console.warn('💡 Recommendation:', rec);
      });
    }

    // Automatic memory cleanup if pressure is high
    if (report.memory.pressure === 'high') {
      this.triggerMemoryCleanup();
    }
  }

  private triggerMemoryCleanup() {
    console.log('🧹 Triggering memory cleanup for Sprint 3C...');
    
    // Clear old metrics
    this.metrics.forEach((metrics) => {
      if (metrics.length > 50) {
        metrics.splice(0, metrics.length - 50);
      }
    });

    // Clear old localStorage data
    try {
      const stored = JSON.parse(localStorage.getItem('sprint3c_metrics') || '[]');
      if (stored.length > 500) {
        stored.splice(0, stored.length - 500);
        localStorage.setItem('sprint3c_metrics', JSON.stringify(stored));
      }
    } catch (error) {
      console.warn('Failed to cleanup stored metrics:', error);
    }

    // Force garbage collection if available
    if ('gc' in window) {
      (window as unknown as { gc?: () => void }).gc?.();
    }
  }

  public cleanup() {
    // Clear observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();

    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining metrics
    this.flushMetrics();
  }
}

// Singleton instance
const performanceService = new PerformanceMonitoringService();

// Hook function for performance monitoring (UI layer will enhance with React hooks)
export function usePerformanceMonitoring(componentName: string) {
  // Basic hook interface - UI components will enhance this with React hooks
  return {
    trackUpdate: () => performanceService.trackComponent(componentName, 'update'),
    trackError: () => performanceService.trackComponent(componentName, 'error'),
    measure: (name: string) => performanceService.startMeasurement(`${componentName}-${name}`)
  };
}

export { performanceService };
export default performanceService;
