// Sprint 1A Robustness: CSS Performance Monitoring
import { PERFORMANCE_THRESHOLDS } from '@/types/designSystem';

/**
 * CSS Performance Monitor for Design System
 */
export class CSSPerformanceMonitor {
  private static instance: CSSPerformanceMonitor;
  private observers: Map<string, PerformanceObserver> = new Map();
  private metrics: Map<string, number[]> = new Map();
  private isMonitoring = false;

  static getInstance(): CSSPerformanceMonitor {
    if (!CSSPerformanceMonitor.instance) {
      CSSPerformanceMonitor.instance = new CSSPerformanceMonitor();
    }
    return CSSPerformanceMonitor.instance;
  }

  /**
   * Start Performance Monitoring
   */
  startMonitoring(): void {
    if (typeof window === 'undefined' || this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitorPaintTiming();
    this.monitorLayoutShifts();
    this.monitorStyleRecalculation();
    this.monitorFontLoading();
    this.monitorCSSVariableAccess();

    if (process.env.NODE_ENV === 'development') {
      console.log('[CSS Performance] Monitoring started');
    }
  }

  /**
   * Stop Performance Monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  /**
   * Monitor Paint Timing
   */
  private monitorPaintTiming(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('first-contentful-paint', entry.startTime);
        }
        if (entry.name === 'largest-contentful-paint') {
          this.recordMetric('largest-contentful-paint', entry.startTime);
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
      this.observers.set('paint', observer);
    } catch (error) {
      console.warn('[CSS Performance] Paint timing monitoring failed:', error);
    }
  }

  /**
   * Monitor Layout Shifts
   */
  private monitorLayoutShifts(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (entry.value > 0.1) { // CLS threshold
          this.recordMetric('cumulative-layout-shift', entry.value);

          if (process.env.NODE_ENV === 'development') {
            console.warn('[CSS Performance] High layout shift detected:', entry.value);
          }
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('layout-shift', observer);
    } catch (error) {
      console.warn('[CSS Performance] Layout shift monitoring failed:', error);
    }
  }

  /**
   * Monitor Style Recalculation
   */
  private monitorStyleRecalculation(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (entry.name === 'recalculate-style') {
          this.recordMetric('style-recalculation', entry.duration);

          if (entry.duration > PERFORMANCE_THRESHOLDS.render.maxStyleRecalc) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[CSS Performance] Slow style recalculation:', entry.duration);
            }
          }
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['measure'] });
      this.observers.set('style-recalc', observer);
    } catch (error) {
      console.warn('[CSS Performance] Style recalculation monitoring failed:', error);
    }
  }

  /**
   * Monitor Font Loading
   */
  private monitorFontLoading(): void {
    if (!('fonts' in document)) return;

    document.fonts.addEventListener('loadingstart', (event: any) => {
      this.recordMetric('font-loading-start', performance.now());
    });

    document.fonts.addEventListener('loadingdone', (event: any) => {
      this.recordMetric('font-loading-done', performance.now());
    });

    document.fonts.addEventListener('loadingerror', (event: any) => {
      this.recordMetric('font-loading-error', performance.now());

      if (process.env.NODE_ENV === 'development') {
        console.warn('[CSS Performance] Font loading error:', event);
      }
    });
  }

  /**
   * Monitor CSS Variable Access Performance
   */
  private monitorCSSVariableAccess(): void {
    if (typeof window === 'undefined') return;

    // Wrap getComputedStyle to monitor CSS variable access
    const originalGetComputedStyle = window.getComputedStyle;
    let accessCount = 0;
    let totalTime = 0;

    window.getComputedStyle = function(...args: [elt: Element, pseudoElt?: string | null | undefined]) {
      const start = performance.now();
      const result = originalGetComputedStyle.apply(this, args);
      const end = performance.now();

      accessCount++;
      totalTime += (end - start);

      // Log slow CSS variable access
      if ((end - start) > 1) { // 1ms threshold
        if (process.env.NODE_ENV === 'development') {
          console.warn('[CSS Performance] Slow CSS variable access:', end - start);
        }
      }

      return result;
    };

    // Report aggregated metrics every 5 seconds
    setInterval(() => {
      if (accessCount > 0) {
        this.recordMetric('css-variable-access-count', accessCount);
        this.recordMetric('css-variable-access-time', totalTime);
        accessCount = 0;
        totalTime = 0;
      }
    }, 5000);
  }

  /**
   * Measure Typography Rendering Performance
   */
  measureTypographyRender(element: HTMLElement, label: string): void {
    const start = performance.now();

    // Force style recalculation
    const computedStyle = getComputedStyle(element);
    const fontSize = computedStyle.fontSize;
    const lineHeight = computedStyle.lineHeight;
    const fontWeight = computedStyle.fontWeight;

    const end = performance.now();
    const duration = end - start;

    this.recordMetric(`typography-render-${label}`, duration);

    if (duration > PERFORMANCE_THRESHOLDS.render.maxStyleRecalc) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[CSS Performance] Slow typography render for ${label}:`, duration);
      }
    }
  }

  /**
   * Measure Spacing Calculation Performance
   */
  measureSpacingCalculation(element: HTMLElement, label: string): void {
    const start = performance.now();

    // Force layout calculation
    const rect = element.getBoundingClientRect();
    const computedStyle = getComputedStyle(element);
    const margin = computedStyle.margin;
    const padding = computedStyle.padding;

    const end = performance.now();
    const duration = end - start;

    this.recordMetric(`spacing-calculation-${label}`, duration);

    if (duration > PERFORMANCE_THRESHOLDS.render.maxLayoutTime) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[CSS Performance] Slow spacing calculation for ${label}:`, duration);
      }
    }
  }

  /**
   * Analyze CSS Selector Performance
   */
  analyzeSelectorPerformance(): void {
    if (typeof window === 'undefined') return;

    const selectors = [
      '.text-fs-0', '.text-fs-1', '.text-fs-2', '.text-fs-3', '.text-fs-4', '.text-fs-5', '.text-fs-6',
      '.p-sp-1', '.p-sp-2', '.p-sp-3', '.p-sp-4', '.p-sp-5', '.p-sp-6', '.p-sp-8',
      '.m-sp-1', '.m-sp-2', '.m-sp-3', '.m-sp-4', '.m-sp-5', '.m-sp-6', '.m-sp-8'
    ];

    selectors.forEach(selector => {
      const start = performance.now();
      const elements = document.querySelectorAll(selector);
      const end = performance.now();

      this.recordMetric(`selector-${selector}`, end - start);
      this.recordMetric(`selector-${selector}-count`, elements.length);
    });
  }

  /**
   * Check CSS Bundle Size Impact
   */
  checkCSSBundleSize(): void {
    if (typeof window === 'undefined') return;

    const stylesheets = Array.from(document.styleSheets);
    let totalRules = 0;
    let utilityRules = 0;
    let variableRules = 0;

    stylesheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        totalRules += rules.length;

        rules.forEach(rule => {
          const cssText = rule.cssText;

          // Count utility classes
          if (cssText.match(/\.(text-fs-|[mp][tblrxy]?-sp-)/)) {
            utilityRules++;
          }

          // Count CSS variables
          if (cssText.includes('--')) {
            variableRules++;
          }
        });
      } catch (error) {
        // Ignore CORS errors for external stylesheets
      }
    });

    this.recordMetric('css-total-rules', totalRules);
    this.recordMetric('css-utility-rules', utilityRules);
    this.recordMetric('css-variable-rules', variableRules);

    // Check thresholds
    if (utilityRules > PERFORMANCE_THRESHOLDS.css.maxUtilityClasses) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CSS Performance] High utility class count:', utilityRules);
      }
    }

    if (variableRules > PERFORMANCE_THRESHOLDS.css.maxVariables) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CSS Performance] High CSS variable count:', variableRules);
      }
    }
  }

  /**
   * Record Performance Metric
   */
  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Get Performance Report
   */
  getPerformanceReport(): {
    metrics: Record<string, {
      count: number;
      avg: number;
      min: number;
      max: number;
      latest: number;
    }>;
    thresholds: typeof PERFORMANCE_THRESHOLDS;
    recommendations: string[];
  } {
    const metrics: Record<string, any> = {};
    const recommendations: string[] = [];

    this.metrics.forEach((values, name) => {
      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const latest = values[values.length - 1];

        metrics[name] = {
          count: values.length,
          avg: Math.round(avg * 100) / 100,
          min: Math.round(min * 100) / 100,
          max: Math.round(max * 100) / 100,
          latest: Math.round(latest * 100) / 100
        };

        // Generate recommendations
        if (name.includes('paint') && avg > PERFORMANCE_THRESHOLDS.render.maxPaintTime) {
          recommendations.push(`Consider optimizing paint performance for ${name}`);
        }

        if (name.includes('layout') && avg > PERFORMANCE_THRESHOLDS.render.maxLayoutTime) {
          recommendations.push(`Consider optimizing layout performance for ${name}`);
        }

        if (name.includes('style-recalc') && avg > PERFORMANCE_THRESHOLDS.render.maxStyleRecalc) {
          recommendations.push(`Consider optimizing style recalculation for ${name}`);
        }
      }
    });

    return {
      metrics,
      thresholds: PERFORMANCE_THRESHOLDS,
      recommendations
    };
  }

  /**
   * Clear All Metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Export Metrics for Analysis
   */
  exportMetrics(): string {
    const report = this.getPerformanceReport();
    return JSON.stringify(report, null, 2);
  }
}

/**
 * Utility Functions
 */

/**
 * Measure CSS Performance for a Function
 */
export function measureCSSPerformance<T>(
  label: string,
  fn: () => T
): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;

  const monitor = CSSPerformanceMonitor.getInstance();
  monitor['recordMetric'](`function-${label}`, duration);

  return { result, duration };
}

/**
 * Performance-Optimized CSS Variable Getter
 */
export function getOptimizedCSSVariable(
  variableName: string,
  element?: HTMLElement
): string {
  const cacheKey = `css-var-${variableName}`;

  // Simple cache for frequently accessed variables
  if ((window as any).__cssVariableCache?.[cacheKey]) {
    return (window as any).__cssVariableCache[cacheKey];
  }

  const { result, duration } = measureCSSPerformance('css-variable-access', () => {
    const target = element || document.documentElement;
    return getComputedStyle(target).getPropertyValue(variableName).trim();
  });

  // Cache for 1 second
  if (!(window as any).__cssVariableCache) {
    (window as any).__cssVariableCache = {};
  }
  (window as any).__cssVariableCache[cacheKey] = result;

  setTimeout(() => {
    delete (window as any).__cssVariableCache?.[cacheKey];
  }, 1000);

  return result;
}

/**
 * Initialize CSS Performance Monitoring
 */
export function initializeCSSPerformanceMonitoring(): void {
  const monitor = CSSPerformanceMonitor.getInstance();
  monitor.startMonitoring();

  // Analyze CSS bundle on page load
  if (document.readyState === 'complete') {
    monitor.checkCSSBundleSize();
    monitor.analyzeSelectorPerformance();
  } else {
    window.addEventListener('load', () => {
      monitor.checkCSSBundleSize();
      monitor.analyzeSelectorPerformance();
    });
  }

  if (process.env.NODE_ENV === 'development') {
    // Report performance metrics every 30 seconds in development
    setInterval(() => {
      const report = monitor.getPerformanceReport();
      if (Object.keys(report.metrics).length > 0) {
        console.log('[CSS Performance Report]', report);
      }
    }, 30000);
  }
}

// Export singleton instance
export const cssPerformanceMonitor = CSSPerformanceMonitor.getInstance();
