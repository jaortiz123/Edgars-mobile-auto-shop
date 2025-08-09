import React, { useMemo, useState } from 'react';
import { useAppointmentContext } from '@/contexts/useAppointmentContext';
import { LearningEngine } from '@/utils/learningEngine';
import IntelligentWorkflowPanel from './IntelligentWorkflowPanel';

const SmartDashboard = () => {
  useAppointmentContext();
  const [intelligenceMode, setIntelligenceMode] = useState<'auto' | 'manual'>('auto');
  const [learningEnabled, setLearningEnabled] = useState(true);

  const preferences = useMemo(() => {
    return LearningEngine.getPreferences?.() || {};
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">🧠 Smart Assistant</h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={learningEnabled}
                onChange={(e) => setLearningEnabled(e.target.checked)}
                className="mr-2"
              />
              Learning Mode
            </label>
            <select
              aria-label="Intelligence Mode"
              value={intelligenceMode}
              onChange={(e) => setIntelligenceMode(e.target.value as 'auto' | 'manual')}
              className="text-sm border border-neutral-300 rounded px-2 py-1"
            >
              <option value="auto">Auto Suggestions</option>
              <option value="manual">Manual Control</option>
            </select>
          </div>
        </div>
        {intelligenceMode === 'auto' && (
          <IntelligentWorkflowPanel />
        )}
      </div>

      {learningEnabled && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <h3 className="text-lg font-bold text-neutral-900 mb-2">Learning Insights</h3>
          <pre className="text-xs text-neutral-600 overflow-auto max-h-48">
            {JSON.stringify(preferences, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default SmartDashboard;
