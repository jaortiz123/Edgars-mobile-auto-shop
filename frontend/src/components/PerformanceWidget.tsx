import React from 'react';
import performanceService, { PerformanceReport } from '@/services/performanceMonitoring';

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring(componentName: string) {
  React.useEffect(() => {
    const startTime = performance.now();
    performanceService.trackComponent(componentName, 'mount');

    return () => {
      const duration = performance.now() - startTime;
      performanceService.trackComponent(componentName, 'render', duration);
    };
  }, [componentName]);

  const trackUpdate = React.useCallback(() => {
    performanceService.trackComponent(componentName, 'update');
  }, [componentName]);

  const trackError = React.useCallback(() => {
    performanceService.trackComponent(componentName, 'error');
  }, [componentName]);

  const measure = React.useCallback((name: string) => {
    return performanceService.startMeasurement(`${componentName}-${name}`);
  }, [componentName]);

  return { trackUpdate, trackError, measure };
}

/**
 * Performance Widget Component
 * Real-time performance monitoring display widget
 */
export function PerformanceWidget() {
  const [report, setReport] = React.useState<PerformanceReport | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setReport(performanceService.generateReport());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (!report) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`px-3 py-2 rounded-lg text-sm font-medium ${
          report.overall.grade === 'A' ? 'bg-green-100 text-green-800' :
          report.overall.grade === 'B' ? 'bg-blue-100 text-blue-800' :
          report.overall.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}
      >
        Performance: {report.overall.grade} ({report.overall.score})
      </button>
      
      {showDetails && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border rounded-lg shadow-lg p-4">
          <h3 className="font-semibold mb-2">Sprint 3C Performance</h3>
          
          <div className="space-y-2 text-sm">
            <div>Memory: {report.memory.pressure} pressure</div>
            <div>Network: {report.network.online ? 'Online' : 'Offline'} ({report.network.rtt}ms)</div>
            <div>Notifications: {report.notifications.sent} sent, {report.notifications.failed} failed</div>
            
            {report.overall.recommendations.length > 0 && (
              <div>
                <div className="font-medium mt-3 mb-1">Recommendations:</div>
                <ul className="list-disc list-inside space-y-1">
                  {report.overall.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceWidget;
