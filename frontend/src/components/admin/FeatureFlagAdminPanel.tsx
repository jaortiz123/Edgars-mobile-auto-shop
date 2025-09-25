// StatusBoardV2 Feature Flag Admin Panel
// Sprint 6 T8 - Feature flag control and launch validation

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Switch } from '../ui/Switch';
import { useFeatureFlags } from '../../utils/featureFlags';
import {
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Rocket,
  Shield
} from 'lucide-react';

export const FeatureFlagAdminPanel: React.FC = () => {
  const {
    flags,
    toggleFlag,
    validateLaunch,
    generateChecklist,
    testRollback
  } = useFeatureFlags();

  const [launchValidation, setLaunchValidation] = useState<any>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [rollbackTest, setRollbackTest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setChecklist(generateChecklist());
  }, [generateChecklist]);

  const handleValidateLaunch = async () => {
    setLoading(true);
    try {
      const result = await validateLaunch();
      setLaunchValidation(result);
    } catch (error) {
      console.error('Launch validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestRollback = async () => {
    setLoading(true);
    try {
      const result = await testRollback();
      setRollbackTest(result);
    } catch (error) {
      console.error('Rollback test failed:', error);
      setRollbackTest({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            StatusBoardV2 Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(flags).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                  <p className="text-sm text-gray-500">
                    {getFlagDescription(key)}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleFlag(key as keyof typeof flags)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Launch Readiness Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Launch Readiness Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={handleValidateLaunch}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Validating...' : 'Validate Launch Criteria'}
            </Button>

            {launchValidation && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {launchValidation.ready ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {launchValidation.ready ? 'Ready for Launch' : 'Not Ready for Launch'}
                  </span>
                  <Badge variant={launchValidation.ready ? 'default' : 'destructive'}>
                    {launchValidation.ready ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>

                {/* Criteria Breakdown */}
                <div className="space-y-2">
                  {Object.entries(launchValidation.criteria).map(([criterion, status]) => (
                    <div key={criterion} className="flex items-center gap-2">
                      {status ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {criterion.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Issues */}
                {launchValidation.issues.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-red-700">Issues Found</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {launchValidation.issues.map((issue: string, index: number) => (
                        <li key={index} className="text-sm text-red-600">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Launch Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Launch Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rollback Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Rollback Testing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={handleTestRollback}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {loading ? 'Testing...' : 'Test Rollback Mechanism'}
            </Button>

            {rollbackTest && (
              <div className={`p-3 rounded border ${
                rollbackTest.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {rollbackTest.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`font-medium ${
                    rollbackTest.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Rollback Test {rollbackTest.success ? 'Passed' : 'Failed'}
                  </span>
                </div>
                <p className={`text-sm ${
                  rollbackTest.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {rollbackTest.message}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function getFlagDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'statusBoardV2Enabled': 'Enable StatusBoardV2 component instead of legacy board',
    'statusBoardV2DragDrop': 'Enable drag and drop functionality with conflict resolution',
    'statusBoardV2PerformanceMonitoring': 'Enable performance monitoring and SLO tracking',
    'statusBoardV2DrawerIntegration': 'Enable appointment details drawer integration',
    'statusBoardV2RollbackEnabled': 'Enable rollback capability to legacy board'
  };

  return descriptions[key] || 'Feature flag configuration';
}

export default FeatureFlagAdminPanel;
