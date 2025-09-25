// Performance Dashboard for StatusBoardV2 monitoring
// Sprint 6 T7 - Real-time performance metrics display

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { performanceMonitor } from '../../utils/performanceMonitor';
import { Activity, Clock, Gauge, TrendingUp } from 'lucide-react';

interface PerformanceDashboardProps {
  className?: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ className = '' }) => {
  const [metrics, setMetrics] = useState(performanceMonitor.getPerformanceSummary());
  const [isHealthy, setIsHealthy] = useState(performanceMonitor.isPerformanceHealthy());

  // Update metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getPerformanceSummary());
      setIsHealthy(performanceMonitor.isPerformanceHealthy());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (value: number, target: number) => {
    if (value === 0) return 'text-gray-400';
    if (value <= target * 0.8) return 'text-green-600';
    if (value <= target) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (value: number, target: number) => {
    if (value === 0) return <Badge variant="outline">No Data</Badge>;
    if (value <= target * 0.8) return <Badge variant="default" className="bg-green-100 text-green-800">Excellent</Badge>;
    if (value <= target) return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge variant="destructive">SLO Violation</Badge>;
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* Board Load Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Board Load</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className={getStatusColor(metrics.boardLoad, 800)}>
              {metrics.boardLoad > 0 ? `${metrics.boardLoad.toFixed(0)}ms` : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">Target: 800ms</p>
            {getStatusBadge(metrics.boardLoad, 800)}
          </div>
        </CardContent>
      </Card>

      {/* Drawer Open Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Drawer Open</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className={getStatusColor(metrics.drawerOpen, 200)}>
              {metrics.drawerOpen > 0 ? `${metrics.drawerOpen.toFixed(0)}ms` : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">Target: 200ms</p>
            {getStatusBadge(metrics.drawerOpen, 200)}
          </div>
        </CardContent>
      </Card>

      {/* Drag Operation Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Drag Operation</CardTitle>
          <Gauge className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className={getStatusColor(metrics.dragOperation, 100)}>
              {metrics.dragOperation > 0 ? `${metrics.dragOperation.toFixed(0)}ms` : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">Target: 100ms</p>
            {getStatusBadge(metrics.dragOperation, 100)}
          </div>
        </CardContent>
      </Card>

      {/* API Response Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">API Response</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className={getStatusColor(metrics.apiResponse, 500)}>
              {metrics.apiResponse > 0 ? `${metrics.apiResponse.toFixed(0)}ms` : '--'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">Target: 500ms</p>
            {getStatusBadge(metrics.apiResponse, 500)}
          </div>
        </CardContent>
      </Card>

      {/* Overall Health Status */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Overall Performance Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-lg font-medium">
              {isHealthy ? 'All SLOs Met' : 'Performance Issues Detected'}
            </span>
            {!isHealthy && (
              <Badge variant="destructive" className="ml-auto">
                Action Required
              </Badge>
            )}
          </div>

          {!isHealthy && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">
                One or more performance metrics exceed target thresholds.
                Consider optimizing components or reviewing network conditions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;
