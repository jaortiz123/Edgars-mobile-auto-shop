import React, { useState } from 'react';
import type { BoardCard } from '@/types/models';
import { WorkflowIntelligence } from '@/utils/workflowIntelligence';
import { updateAppointmentStatus, moveAppointment, deleteAppointment, patchAppointment } from '@/lib/api';

interface QuickAction {
  label: string;
  icon: string;
  action: string;
  variant: 'primary' | 'secondary' | 'success' | 'warning' | 'urgent';
  description: string;
}

export const ContextualQuickActions = ({ card }: { card: BoardCard }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const refreshBoard = () => { /* board data refresh handled externally; no-op */ };

  const getSmartActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];
    const now = new Date();

    switch (card.status) {
      case 'SCHEDULED': {
        if (!card.checkInAt) {
          actions.push({ label: 'Check In', icon: '🚗', action: 'check_in', variant: 'primary', description: 'Mark vehicle arrived' });
        }
        if (typeof card.timeUntilStart === 'number' && card.timeUntilStart <= 15) {
          actions.push({ label: 'Start Now', icon: '▶️', action: 'start_appointment', variant: 'primary', description: 'Begin this appointment' });
        }
        if ((card.partsRequired || []).some(p => !p.inStock)) {
          actions.push({ label: 'Check Parts', icon: '📦', action: 'verify_parts', variant: 'warning', description: 'Verify parts availability' });
        }
        if (card.workspacePreference) {
          actions.push({ label: `Prep ${String(card.workspacePreference).toUpperCase()}`, icon: '🔧', action: 'prep_workspace', variant: 'secondary', description: 'Prepare workspace' });
        }
        break;
      }
      case 'IN_PROGRESS': {
        if (card.isOverdue) {
          actions.push({ label: 'Update Status', icon: '📞', action: 'contact_customer', variant: 'urgent', description: 'Notify customer of delay' });
        }
        actions.push({ label: 'Add Note', icon: '📝', action: 'add_note', variant: 'secondary', description: 'Log progress notes' });
        if ((card.partsRequired || []).length) {
          actions.push({ label: 'Request Parts', icon: '🛒', action: 'order_parts', variant: 'secondary', description: 'Order additional parts' });
        }
        const predictedEnd = WorkflowIntelligence.predictCompletionTime(card);
        if (predictedEnd && predictedEnd < now) {
          actions.push({ label: 'Mark Complete', icon: '✅', action: 'complete_job', variant: 'success', description: 'Finish this job' });
        }
        break;
      }
      case 'READY': {
        actions.push({ label: 'Customer Here', icon: '🚗', action: 'customer_arrived', variant: 'primary', description: 'Customer has arrived' });
        if (card.customerNotes) {
          actions.push({ label: 'Review Notes', icon: '📋', action: 'show_notes', variant: 'secondary', description: 'View customer notes' });
        }
        break;
      }
    }

    actions.push({ label: 'Reschedule', icon: '📅', action: 'reschedule', variant: 'secondary', description: 'Change appointment time' });
    if (card.isRepeatCustomer) {
      actions.push({ label: 'Service History', icon: '📚', action: 'show_history', variant: 'secondary', description: 'View past services' });
    }
    // Destructive at end
    actions.push({ label: 'Delete Appointment', icon: '🗑️', action: 'delete_appointment', variant: 'urgent', description: 'Permanently remove this appointment' });

    return actions;
  };

  const handleAction = async (action: QuickAction) => {
    setIsProcessing(action.action);
    try {
      switch (action.action) {
        case 'check_in':
          await patchAppointment(card.id, { check_in_at: new Date().toISOString() });
          break;
        case 'start_appointment':
          await updateAppointmentStatus(card.id, 'IN_PROGRESS');
          break;
        case 'complete_job':
          await updateAppointmentStatus(card.id, 'COMPLETED');
          break;
        case 'reschedule':
          await moveAppointment(card.id, { status: 'SCHEDULED', position: (card.position ?? 0) + 1 });
          break;
        case 'delete_appointment': {
          const ok = window.confirm('Delete this appointment? This cannot be undone.');
          if (!ok) break;
          await deleteAppointment(card.id);
          break;
        }
        default:
          // TODO: wire other actions
          await new Promise((r) => setTimeout(r, 300));
      }
      await refreshBoard();
    } catch (error) {
      console.error('Action failed', error);
    } finally {
      setIsProcessing(null);
    }
  };

  const primaryActions = getSmartActions().filter(a => a.variant === 'primary' || a.variant === 'urgent');
  const secondaryActions = getSmartActions().filter(a => a.variant !== 'primary' && a.variant !== 'urgent');

  return (
    <div className="mt-3 pt-3 border-t border-neutral-200">
      {primaryActions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {primaryActions.map(action => (
            <button
              key={action.action}
              onClick={() => handleAction(action)}
              disabled={isProcessing === action.action}
              className={`
                inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                ${action.variant === 'urgent' ? 'bg-danger-600 text-white hover:bg-danger-700' : 'bg-primary-600 text-white hover:bg-primary-700'}
                ${isProcessing === action.action ? 'opacity-50' : 'hover:shadow-sm'}
              `}
            >
              {isProcessing === action.action ? (
                <span className="animate-spin mr-1">⏳</span>
              ) : (
                <span className="mr-1">{action.icon}</span>
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {secondaryActions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowContextMenu(!showContextMenu)}
            className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            ⋯ More actions
          </button>

          {showContextMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 z-10">
              <div className="py-1">
                {secondaryActions.map(action => (
                  <button
                    key={action.action}
                    onClick={() => { handleAction(action); setShowContextMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center ${action.action === 'delete_appointment' ? 'text-red-600 hover:text-red-700' : 'text-neutral-700'}`}
                  >
                    <span className="mr-2">{action.icon}</span>
                    <div>
                      <div className="font-medium">{action.label}</div>
                      <div className={`text-xs ${action.action === 'delete_appointment' ? 'text-red-500' : 'text-neutral-500'}`}>{action.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextualQuickActions;
