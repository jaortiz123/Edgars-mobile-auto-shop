// Sprint 1A Robustness: Initialization and Integration
import { initializeDesignSystemValidation } from '@/utils/designSystemValidator';
import { initializeCSSPerformanceMonitoring } from '@/utils/cssPerformanceMonitor';

/**
 * Initialize Sprint 1A Design System Robustness
 * This should be called early in the application lifecycle
 */
export function initializeSprint1ARobustness(): void {
  try {
    // Initialize design system validation
    initializeDesignSystemValidation();
    
    // Initialize CSS performance monitoring
    initializeCSSPerformanceMonitoring();
    
    // Add global error handlers for CSS-related issues
    addCSSErrorHandlers();
    
    // Setup development mode enhancements
    if (process.env.NODE_ENV === 'development') {
      setupDevelopmentMode();
    }
    
    // Log successful initialization
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Sprint 1A Design System Robustness initialized');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Sprint 1A robustness:', error);
  }
}

/**
 * Add Global CSS Error Handlers
 */
function addCSSErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Handle CSS loading errors
  window.addEventListener('error', (event) => {
    if (event.target && (event.target as any).tagName === 'LINK') {
      const link = event.target as HTMLLinkElement;
      if (link.rel === 'stylesheet') {
        console.warn('[Design System] CSS loading failed:', link.href);
        
        // Attempt to load fallback styles
        loadFallbackStyles();
      }
    }
  });

  // Handle unhandled rejections that might be related to CSS
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason === 'string' && event.reason.includes('CSS')) {
      console.warn('[Design System] CSS-related promise rejection:', event.reason);
    }
  });
}

/**
 * Load Fallback Styles when Primary CSS Fails
 */
function loadFallbackStyles(): void {
  if (typeof document === 'undefined') return;

  // Check if fallback styles are already loaded
  if (document.querySelector('#design-system-fallback')) return;

  // Create fallback stylesheet
  const style = document.createElement('style');
  style.id = 'design-system-fallback';
  style.textContent = `
    /* Emergency fallback styles */
    .typography-fallback,
    .text-fs-0, .text-fs-1, .text-fs-2, .text-fs-3, .text-fs-4, .text-fs-5, .text-fs-6 {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.5;
    }
    
    .text-fs-0 { font-size: 0.75rem; }
    .text-fs-1 { font-size: 0.875rem; }
    .text-fs-2 { font-size: 1rem; }
    .text-fs-3 { font-size: 1.25rem; }
    .text-fs-4 { font-size: 1.5rem; }
    .text-fs-5 { font-size: 2rem; }
    .text-fs-6 { font-size: 2.5rem; }
    
    .p-sp-1, .p-1 { padding: 0.5rem; }
    .p-sp-2, .p-2 { padding: 1rem; }
    .p-sp-3, .p-3 { padding: 1.5rem; }
    .p-sp-4, .p-4 { padding: 2rem; }
    
    .m-sp-1, .m-1 { margin: 0.5rem; }
    .m-sp-2, .m-2 { margin: 1rem; }
    .m-sp-3, .m-3 { margin: 1.5rem; }
    .m-sp-4, .m-4 { margin: 2rem; }
    
    .mt-sp-1, .mt-1 { margin-top: 0.5rem; }
    .mt-sp-2, .mt-2 { margin-top: 1rem; }
    .mt-sp-3, .mt-3 { margin-top: 1.5rem; }
    .mt-sp-4, .mt-4 { margin-top: 2rem; }
    
    *:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
  `;
  
  document.head.appendChild(style);
  
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Design System] Fallback styles loaded');
  }
}

/**
 * Setup Development Mode Enhancements
 */
function setupDevelopmentMode(): void {
  if (typeof window === 'undefined') return;

  // Add visual indicators for design system usage
  addDesignSystemIndicators();
  
  // Setup keyboard shortcuts for debugging
  setupKeyboardShortcuts();
  
  // Add performance monitoring UI
  addPerformanceMonitoringUI();
}

/**
 * Add Visual Indicators for Design System Classes
 */
function addDesignSystemIndicators(): void {
  const style = document.createElement('style');
  style.id = 'design-system-dev-indicators';
  style.textContent = `
    /* Development mode visual indicators */
    [class*="text-fs-"]:not(.ds-validated)::before {
      content: "FS";
      position: absolute;
      top: -8px;
      left: -8px;
      background: #10b981;
      color: white;
      font-size: 8px;
      padding: 2px 4px;
      border-radius: 2px;
      z-index: 9999;
      pointer-events: none;
    }
    
    [class*="-sp-"]:not(.ds-validated)::after {
      content: "SP";
      position: absolute;
      top: -8px;
      right: -8px;
      background: #3b82f6;
      color: white;
      font-size: 8px;
      padding: 2px 4px;
      border-radius: 2px;
      z-index: 9999;
      pointer-events: none;
    }
    
    .ds-error::before {
      content: "❌";
      background: #ef4444;
    }
    
    .ds-warning::before {
      content: "⚠️";
      background: #f59e0b;
    }
  `;
  
  document.head.appendChild(style);
  
  // Add indicators to existing elements
  setTimeout(() => {
    addIndicatorsToElements();
  }, 1000);
}

/**
 * Add Indicators to Existing Elements
 */
function addIndicatorsToElements(): void {
  const elements = document.querySelectorAll('[class*="text-fs-"], [class*="-sp-"]');
  elements.forEach(element => {
    if (!element.classList.contains('ds-validated')) {
      (element as HTMLElement).style.position = 'relative';
    }
  });
}

/**
 * Setup Keyboard Shortcuts for Debugging
 */
function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + Shift + D = Toggle design system debug mode
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      toggleDebugMode();
    }
    
    // Ctrl/Cmd + Shift + P = Show performance report
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      showPerformanceReport();
    }
  });
}

/**
 * Toggle Debug Mode
 */
function toggleDebugMode(): void {
  const indicators = document.getElementById('design-system-dev-indicators');
  if (indicators) {
    indicators.style.display = indicators.style.display === 'none' ? '' : 'none';
    console.log('[Design System] Debug mode toggled');
  }
}

/**
 * Show Performance Report
 */
function showPerformanceReport(): void {
  import('@/utils/cssPerformanceMonitor').then(({ cssPerformanceMonitor }) => {
    const report = cssPerformanceMonitor.getPerformanceReport();
    console.table(report.metrics);
    console.log('[Performance Report]', report);
  });
}

/**
 * Add Performance Monitoring UI
 */
function addPerformanceMonitoringUI(): void {
  // Create floating performance indicator
  const indicator = document.createElement('div');
  indicator.id = 'performance-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
    pointer-events: none;
    opacity: 0.7;
  `;
  
  document.body.appendChild(indicator);
  
  // Update performance metrics every 5 seconds
  setInterval(() => {
    updatePerformanceIndicator(indicator);
  }, 5000);
}

/**
 * Update Performance Indicator
 */
function updatePerformanceIndicator(element: HTMLElement): void {
  import('@/utils/cssPerformanceMonitor').then(({ cssPerformanceMonitor }) => {
    const report = cssPerformanceMonitor.getPerformanceReport();
    const metrics = report.metrics;
    
    let content = 'CSS Performance:\n';
    
    if (metrics['first-contentful-paint']) {
      content += `FCP: ${metrics['first-contentful-paint'].latest}ms\n`;
    }
    
    if (metrics['cumulative-layout-shift']) {
      content += `CLS: ${metrics['cumulative-layout-shift'].latest}\n`;
    }
    
    if (Object.keys(metrics).length === 0) {
      content += 'No metrics available';
    }
    
    element.textContent = content;
  });
}

/**
 * Validate Design System Implementation
 */
export function validateDesignSystemImplementation(): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  report: object;
}> {
  return new Promise((resolve) => {
    import('@/utils/designSystemValidator').then(({ designSystemValidator }) => {
      import('@/utils/cssPerformanceMonitor').then(({ cssPerformanceMonitor }) => {
        // Run comprehensive validation
        const validationState = designSystemValidator.getValidationState();
        const performanceReport = cssPerformanceMonitor.getPerformanceReport();
        
        resolve({
          isValid: validationState.isValid && performanceReport.recommendations.length === 0,
          errors: validationState.errors,
          warnings: [...validationState.warnings, ...performanceReport.recommendations],
          report: {
            validation: validationState,
            performance: performanceReport
          }
        });
      });
    });
  });
}

/**
 * Clean up Robustness Features
 */
export function cleanupSprint1ARobustness(): void {
  // Remove development mode enhancements
  const indicators = document.getElementById('design-system-dev-indicators');
  if (indicators) {
    indicators.remove();
  }
  
  const performanceIndicator = document.getElementById('performance-indicator');
  if (performanceIndicator) {
    performanceIndicator.remove();
  }
  
  // Stop performance monitoring
  import('@/utils/cssPerformanceMonitor').then(({ cssPerformanceMonitor }) => {
    cssPerformanceMonitor.stopMonitoring();
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[Design System] Robustness features cleaned up');
  }
}

// Export default initialization function
export default initializeSprint1ARobustness;
