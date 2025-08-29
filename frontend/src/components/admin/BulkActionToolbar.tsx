import React, { useState } from 'react';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useBoardStore } from '@/state/useBoardStore';
import { Button } from '@/components/ui/Button';
import { X, Trash2, ArrowRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import type { BoardCard } from '@/types/models';

interface BulkActionToolbarProps {
  allCards: BoardCard[];
  onDeleteSelected: (cardIds: string[]) => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  allCards,
  onDeleteSelected
}) => {
  const [isMoving, setIsMoving] = useState(false);
  // Retry + backoff tuning for rate-limited backend
  const BASE_DELAY_MS = 400; // initial backoff delay
  const MAX_RETRIES = 5;     // total attempts per card
  const {
    selectedCount,
    clearSelection,
    getSelectedCards,
    exitSelectionMode,
    isSelectionMode,
    selectAllInColumn,
    getSelectedColumnStatus,
    hasMultipleColumnsSelected
  } = useMultiSelect();
  const moveAppointment = useBoardStore((s) => s.moveAppointment);
  const columns = useBoardStore((s) => s.columns);

  if (!isSelectionMode || selectedCount === 0) {
    return null;
  }

  const selectedCards = getSelectedCards(allCards);
  const selectedColumnStatus = getSelectedColumnStatus(allCards);
  const hasMultipleColumns = hasMultipleColumnsSelected(allCards);

  // Helpers ---------------------------------------------------------------
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  type MaybeAxiosError = {
    message?: string;
    status?: number;
    response?: {
      status?: number;
      data?: unknown;
      headers?: Record<string, string>;
    };
    data?: unknown;
  };

  const parseApiError = (err: unknown): {
    status?: number;
    code?: string;
    detail?: string;
    message: string;
    retryAfterMs?: number;
  } => {
    const e = (err ?? {}) as MaybeAxiosError;
    const status: number | undefined = e.response?.status ?? e.status;
  const dataUnknown: unknown = (e.response?.data as unknown) ?? (e.data as unknown) ?? {};
    const headerRetry = e.response?.headers?.['retry-after'] ?? e.response?.headers?.['Retry-After'];
    const retryAfterMs = headerRetry ? Number(headerRetry) * 1000 : undefined;
    const data = ((): Record<string, unknown> => (typeof dataUnknown === 'object' && dataUnknown !== null ? (dataUnknown as Record<string, unknown>) : {}))();
    const maybeErrors = (data as Record<string, unknown>)['errors'];
    const errorsArr = Array.isArray(maybeErrors) ? (maybeErrors as unknown[]) : [];
    const envelopeErr = errorsArr.length > 0 && typeof errorsArr[0] === 'object' && errorsArr[0] !== null
      ? (errorsArr[0] as Record<string, unknown>)
      : undefined;
  const code: string | undefined = (envelopeErr?.code as string | undefined) ?? (data?.code as string | undefined);
  const detail: string | undefined = (envelopeErr?.detail as string | undefined) ?? (data?.message as string | undefined) ?? e.message;
    const message =
      (detail && String(detail)) ||
      (typeof e?.message === 'string' ? e.message : 'Unknown error');
    return { status, code, detail, message, retryAfterMs };
  };

  const moveWithRetry = async (cardId: string, targetStatus: string) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await moveAppointment(cardId, { status: targetStatus, position: 1 });
        return; // success
      } catch (err) {
        const info = parseApiError(err);
        // 429: exponential backoff, optionally using Retry-After header
        if (info.status === 429 || /rate[ _-]?limit/i.test(info.message)) {
          const backoff = info.retryAfterMs ?? BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `Rate limited moving ${cardId}. Retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(backoff)}ms`
          );
          await sleep(backoff);
          continue; // try again
        }
        // Invalid transition: surface concise error, do not retry
        if (info.status === 400 && /invalid[_\s-]?transition/i.test(info.code || info.message)) {
          throw new Error(`Invalid transition: ${info.detail || info.message}`);
        }
        // Other errors: do not retry
        throw new Error(info.detail || info.message);
      }
    }
    throw new Error('Rate limit persists after multiple retries. Please try again shortly.');
  };

  const handleBulkMove = async (targetStatus: string) => {
    setIsMoving(true);
    try {
      const selectedCardIds = selectedCards.map(card => card.id);

      console.log(`Moving ${selectedCardIds.length} cards to ${targetStatus}:`, selectedCardIds);

      const errors: string[] = [];

      // Filter out cards that are already in the target status
      const cardsToMove = selectedCards.filter(card => (card.status || 'UNKNOWN') !== targetStatus);
      const alreadyInStatus = selectedCards.length - cardsToMove.length;

      if (alreadyInStatus > 0) {
        console.log(`Skipping ${alreadyInStatus} appointments already in ${targetStatus} status`);
      }

      if (cardsToMove.length === 0) {
        console.log('All selected appointments are already in the target status');
        clearSelection();
        return;
      }

      const cardIdsToMove = cardsToMove.map(card => card.id);

      // Sequentially process moves with retry/backoff
      for (let i = 0; i < cardIdsToMove.length; i++) {
        const cardId = cardIdsToMove[i];
        try {
          await moveWithRetry(cardId, targetStatus);
          console.log(`Successfully moved card ${cardId} to ${targetStatus} (${i + 1}/${cardIdsToMove.length})`);
          // throttle between items to smooth out spikes
          if (i < cardIdsToMove.length - 1) {
            await sleep(200);
          }
        } catch (err) {
          const info = parseApiError(err);
          const prefix = `#${i + 1} (${cardId})`;
          errors.push(`${prefix} → ${info.message}`);
          console.error(`Failed to move card ${cardId}:`, err);
        }
      }

      if (errors.length) {
        const totalProcessed = cardIdsToMove.length;
        const successful = totalProcessed - errors.length;
        const summary = alreadyInStatus > 0
          ? `Moved ${successful}/${totalProcessed}. ${alreadyInStatus} were already in ${targetStatus} status.`
          : `Moved ${successful}/${totalProcessed}.`;
        // Show first few errors to avoid giant alerts
        const details = errors.slice(0, 5).join('\n');
        throw new Error(`${summary}\nErrors:\n${details}${errors.length > 5 ? '\n…' : ''}`);
      } else {
        const summary = alreadyInStatus > 0
          ? `Successfully moved ${cardIdsToMove.length} appointments. ${alreadyInStatus} were already in ${targetStatus} status.`
          : 'All bulk moves completed successfully';
        console.log(summary);
        clearSelection();
      }
    } catch (error) {
      console.error('Bulk move failed:', error);
      // Don't clear selection on error so user can retry
      throw error;
    } finally {
      setIsMoving(false);
    }
  };

  const handleDelete = () => {
    const selectedCardIds = selectedCards.map(card => card.id);
    onDeleteSelected(selectedCardIds);
    clearSelection();
  };

  const handleSelectAllInColumn = () => {
    selectAllInColumn(allCards);
  };

  const getColumnTitle = (status: string) => {
    const column = columns.find(col => col.key === status);
    return column ? column.title : status;
  };

  const cardsInSelectedColumn = selectedColumnStatus
    ? allCards.filter(card => (card.status || 'UNKNOWN') === selectedColumnStatus).length
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - selection info and controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {isMoving ? 'Moving...' : `${selectedCount} selected`}
              </span>
              {selectedColumnStatus && !hasMultipleColumns ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMoving}
                  onClick={handleSelectAllInColumn}
                  className="text-blue-600 hover:text-blue-700"
                  title={`Select all ${cardsInSelectedColumn} appointments in ${getColumnTitle(selectedColumnStatus)}`}
                >
                  Select all in {getColumnTitle(selectedColumnStatus)} ({cardsInSelectedColumn})
                </Button>
              ) : hasMultipleColumns ? (
                <span className="text-xs text-amber-600 font-medium">
                  Multiple columns selected
                </span>
              ) : null}
            </div>

            <div className="h-4 w-px bg-gray-300" />

            {/* Quick status move buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Move to:</span>
              {columns.map((column) => (
                <Button
                  key={column.key}
                  variant="outline"
                  size="sm"
                  disabled={isMoving}
                  onClick={async () => {
                    try {
                      await handleBulkMove(column.key);
                    } catch (error) {
                      console.error('Bulk move error:', error);
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      alert(`Failed to move appointments: ${errorMessage}`);
                    }
                  }}
                  className="flex items-center gap-1 text-xs"
                  title={`Move ${selectedCount} appointment${selectedCount > 1 ? 's' : ''} to ${column.title}`}
                >
                  {column.key === 'SCHEDULED' && <Clock className="h-3 w-3" />}
                  {column.key === 'IN_PROGRESS' && <ArrowRight className="h-3 w-3" />}
                  {column.key === 'READY' && <CheckCircle className="h-3 w-3" />}
                  {column.key === 'COMPLETED' && <CheckCircle className="h-3 w-3" />}
                  {!['SCHEDULED', 'IN_PROGRESS', 'READY', 'COMPLETED'].includes(column.key) &&
                    <AlertTriangle className="h-3 w-3" />}
                  {column.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Right side - actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:border-red-200"
            >
              <Trash2 className="h-3 w-3" />
              Delete ({selectedCount})
            </Button>

            <div className="h-4 w-px bg-gray-300" />

            <Button
              variant="ghost"
              size="sm"
              onClick={exitSelectionMode}
              className="flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
