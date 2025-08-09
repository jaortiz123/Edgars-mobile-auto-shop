import React, { useEffect, useState } from 'react';
import { useAppointmentContext } from '@/contexts/useAppointmentContext';
import type { BoardCard } from '@/types/models';
import { WorkflowIntelligence, SmartSuggestion } from '@/utils/workflowIntelligence';

const IntelligentWorkflowPanel = () => {
  const { cards } = useAppointmentContext();
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [workflowMode, setWorkflowMode] = useState<'overview' | 'focused'>('overview');

  useEffect(() => {
    const smartSuggestions = WorkflowIntelligence.getSmartSuggestions(cards as BoardCard[], new Date());
    setSuggestions(smartSuggestions);
  }, [cards]);

  const handleSuggestionAction = (suggestion: SmartSuggestion) => {
    switch (suggestion.action) {
      case 'prioritize_overdue':
        // TODO: Highlight overdue cards
        break;
      case 'prep_workspace':
        // TODO: Show workspace preparation checklist
        break;
      case 'check_parts':
        // TODO: Open parts availability panel
        break;
      case 'start_quick_job':
        // TODO: Suggest optimal quick job to start
        break;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-neutral-900">Workflow Assistant</h3>
        <button
          onClick={() => setWorkflowMode(mode => mode === 'overview' ? 'focused' : 'overview')}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          {workflowMode === 'overview' ? '🎯 Focus Mode' : '📋 Overview'}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-success-600 text-xl">✅</span>
          </div>
          <p className="text-neutral-600 font-medium">Everything's on track!</p>
          <p className="text-sm text-neutral-500">No immediate actions needed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.slice(0, workflowMode === 'focused' ? 1 : 3).map((suggestion, index) => (
            <div
              key={index}
              className={`
                p-3 rounded-lg border transition-all duration-200 hover:shadow-sm
                ${suggestion.type === 'urgent' ? 'bg-danger-50 border-danger-200' :
                  suggestion.type === 'warning' ? 'bg-warning-50 border-warning-200' :
                  suggestion.type === 'suggestion' ? 'bg-primary-50 border-primary-200' :
                  'bg-neutral-50 border-neutral-200'}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">
                      {suggestion.type === 'urgent' ? '🚨' :
                       suggestion.type === 'warning' ? '⚠️' :
                       suggestion.type === 'suggestion' ? '💡' : 'ℹ️'}
                    </span>
                    <h4 className="font-semibold text-neutral-900">
                      {suggestion.title}
                    </h4>
                  </div>
                  <p className="text-sm text-neutral-600 mb-2">
                    {suggestion.description}
                  </p>

                  {suggestion.cards.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {suggestion.cards.slice(0, 2).map(card => (
                        <span
                          key={card.id}
                          className="inline-block px-2 py-1 bg-white rounded text-xs font-medium text-neutral-700 border"
                        >
                          {card.servicesSummary || card.customerName}
                        </span>
                      ))}
                      {suggestion.cards.length > 2 && (
                        <span className="inline-block px-2 py-1 bg-white rounded text-xs text-neutral-500 border">
                          +{suggestion.cards.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSuggestionAction(suggestion)}
                  className={`
                    ml-3 px-3 py-1 rounded text-xs font-medium transition-colors
                    ${suggestion.type === 'urgent' ? 'bg-danger-600 text-white hover:bg-danger-700' :
                      suggestion.type === 'warning' ? 'bg-warning-600 text-white hover:bg-warning-700' :
                      'bg-primary-600 text-white hover:bg-primary-700'}
                  `}
                >
                  Take Action
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {workflowMode === 'focused' && suggestions.length > 0 && (
        <div className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
          <h4 className="font-semibold text-primary-900 mb-2">🎯 Focus Mode Active</h4>
          <p className="text-sm text-primary-700">
            Showing only your highest priority action. Complete this first for optimal workflow.
          </p>
        </div>
      )}
    </div>
  );
};

export default IntelligentWorkflowPanel;
