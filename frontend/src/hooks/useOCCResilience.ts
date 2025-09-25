/**
 * Sprint 4 P3: Enhanced OCC Resilience Hook
 *
 * Provides enhanced optimistic concurrency control with:
 * - Double-move prevention
 * - Enhanced conflict resolution
 * - User-friendly conflict feedback
 * - Optimistic UI state management
 *
 * Builds on existing useStatusBoard hook with additional resilience layers.
 */

import { useCallback, useRef, useState } from 'react';
import type { AppointmentStatus, ApiError } from '@/types/models';
import { isConflictError } from '@/services/statusBoardClient';

// Enhanced conflict resolution state
export interface ConflictResolution {
  appointmentId: string;
  conflictType: 'version_conflict' | 'double_move' | 'concurrent_edit';
  currentVersion: number;
  providedVersion: number;
  suggestedAction: 'retry_with_current' | 'manual_resolve' | 'force_override';
  conflictDetails?: {
    currentStatus?: AppointmentStatus;
    requestedStatus?: AppointmentStatus;
    lastUpdatedBy?: string;
    lastUpdatedAt?: string;
  };
}

// Move operation tracking for double-move prevention
interface PendingMove {
  appointmentId: string;
  startTime: number;
  status: AppointmentStatus;
  position: number;
  attempt: number;
}

export interface UseOCCResilienceOptions {
  // Double-move prevention window (ms)
  doubleMovePreventionWindow?: number;
  // Max concurrent moves per appointment
  maxConcurrentMoves?: number;
  // Enhanced conflict resolution timeout
  conflictResolutionTimeout?: number;
  // Auto-retry failed moves
  autoRetryEnabled?: boolean;
  // Max auto-retry attempts
  maxAutoRetries?: number;
}

export interface UseOCCResilienceReturn {
  // Enhanced move function with double-move protection
  protectedMove: (
    appointmentId: string,
    status: AppointmentStatus,
    position: number,
    expectedVersion?: number
  ) => Promise<void>;

  // Conflict resolution functions
  resolveConflict: (resolution: ConflictResolution) => Promise<void>;
  dismissConflict: (appointmentId: string) => void;

  // State getters
  getPendingMoves: () => PendingMove[];
  getActiveConflicts: () => ConflictResolution[];
  hasDoubleMoveConflict: (appointmentId: string) => boolean;

  // Manual retry
  retryFailedMove: (appointmentId: string) => Promise<void>;

  // State
  pendingMoves: PendingMove[];
  activeConflicts: ConflictResolution[];
  isProcessing: Record<string, boolean>;
}

export function useOCCResilience(
  // Base move function from useStatusBoard
  baseMoveFunction: (
    appointmentId: string,
    status: AppointmentStatus,
    position: number,
    config?: any
  ) => Promise<any>,
  options: UseOCCResilienceOptions = {}
): UseOCCResilienceReturn {

  const {
    doubleMovePreventionWindow = 2000, // 2 seconds
    maxConcurrentMoves = 1,
    conflictResolutionTimeout = 10000, // 10 seconds
    autoRetryEnabled = true,
    maxAutoRetries = 2
  } = options;

  // State for tracking moves and conflicts
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [activeConflicts, setActiveConflicts] = useState<ConflictResolution[]>([]);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  // Refs for cleanup
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryCountRefs = useRef<Map<string, number>>(new Map());

  // Double-move prevention check
  const hasDoubleMoveConflict = useCallback((appointmentId: string): boolean => {
    const now = Date.now();
    const recentMoves = pendingMoves.filter(
      move => move.appointmentId === appointmentId &&
              (now - move.startTime) < doubleMovePreventionWindow
    );
    return recentMoves.length >= maxConcurrentMoves;
  }, [pendingMoves, doubleMovePreventionWindow, maxConcurrentMoves]);

  // Enhanced move function with protection
  const protectedMove = useCallback(async (
    appointmentId: string,
    status: AppointmentStatus,
    position: number,
    expectedVersion?: number
  ): Promise<void> => {

    // Double-move prevention
    if (hasDoubleMoveConflict(appointmentId)) {
      throw new Error('DOUBLE_MOVE_PREVENTED: Please wait for the current move to complete');
    }

    // Check if already processing
    if (isProcessing[appointmentId]) {
      throw new Error('MOVE_IN_PROGRESS: Move already in progress for this appointment');
    }

    // Track this move
    const moveId = `${appointmentId}-${Date.now()}`;
    const pendingMove: PendingMove = {
      appointmentId,
      startTime: Date.now(),
      status,
      position,
      attempt: (retryCountRefs.current.get(appointmentId) || 0) + 1
    };

    try {
      // Update state
      setPendingMoves(prev => [...prev, pendingMove]);
      setIsProcessing(prev => ({ ...prev, [appointmentId]: true }));

      // Clear any existing conflicts for this appointment
      setActiveConflicts(prev => prev.filter(c => c.appointmentId !== appointmentId));

      // Call the base move function
      await baseMoveFunction(appointmentId, status, position, { expectedVersion });

      // Success - clear retry count
      retryCountRefs.current.delete(appointmentId);

    } catch (error) {
      const apiError = error as ApiError;

      // Handle different types of conflicts
      if (isConflictError(apiError)) {
        const conflict: ConflictResolution = {
          appointmentId,
          conflictType: 'version_conflict',
          currentVersion: apiError.current_version || 0,
          providedVersion: expectedVersion || 0,
          suggestedAction: 'retry_with_current',
          conflictDetails: {
            currentStatus: apiError.current_state?.status,
            requestedStatus: status,
            lastUpdatedBy: apiError.current_state?.last_updated_by,
            lastUpdatedAt: apiError.current_state?.updated_at
          }
        };

        setActiveConflicts(prev => [...prev.filter(c => c.appointmentId !== appointmentId), conflict]);

        // Auto-retry if enabled and under retry limit
        if (autoRetryEnabled && pendingMove.attempt <= maxAutoRetries) {
          const retryCount = pendingMove.attempt;
          retryCountRefs.current.set(appointmentId, retryCount);

          // Schedule retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          const timeoutId = setTimeout(async () => {
            try {
              await protectedMove(appointmentId, status, position, conflict.currentVersion);
            } catch (retryError) {
              // If auto-retry fails, leave conflict for manual resolution
              console.warn('Auto-retry failed for appointment', appointmentId, retryError);
            }
          }, retryDelay);

          timeoutRefs.current.set(moveId, timeoutId);
        }
      }

      // Re-throw for the caller to handle
      throw error;

    } finally {
      // Cleanup
      setPendingMoves(prev => prev.filter(m => m !== pendingMove));
      setIsProcessing(prev => ({ ...prev, [appointmentId]: false }));

      // Clear timeout if it exists
      const timeoutId = timeoutRefs.current.get(moveId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutRefs.current.delete(moveId);
      }
    }
  }, [
    baseMoveFunction,
    hasDoubleMoveConflict,
    isProcessing,
    autoRetryEnabled,
    maxAutoRetries
  ]);

  // Manual conflict resolution
  const resolveConflict = useCallback(async (resolution: ConflictResolution): Promise<void> => {
    const { appointmentId, suggestedAction, currentVersion, conflictDetails } = resolution;

    try {
      switch (suggestedAction) {
        case 'retry_with_current':
          // Retry with the current version from the server
          if (conflictDetails?.currentStatus && conflictDetails?.requestedStatus) {
            await protectedMove(
              appointmentId,
              conflictDetails.requestedStatus,
              0, // Position will be recalculated
              currentVersion
            );
          }
          break;

        case 'force_override':
          // Force the move (dangerous - should require confirmation)
          if (conflictDetails?.requestedStatus) {
            await baseMoveFunction(appointmentId, conflictDetails.requestedStatus, 0, {
              expectedVersion: currentVersion,
              force: true
            });
          }
          break;

        case 'manual_resolve':
          // Manual resolution - just dismiss the conflict
          break;
      }

      // Remove resolved conflict
      setActiveConflicts(prev => prev.filter(c => c.appointmentId !== appointmentId));

    } catch (error) {
      // If resolution fails, update the conflict with error info
      setActiveConflicts(prev => prev.map(c =>
        c.appointmentId === appointmentId
          ? { ...c, suggestedAction: 'manual_resolve' }
          : c
      ));
      throw error;
    }
  }, [protectedMove, baseMoveFunction]);

  // Dismiss a conflict without resolving
  const dismissConflict = useCallback((appointmentId: string): void => {
    setActiveConflicts(prev => prev.filter(c => c.appointmentId !== appointmentId));
    retryCountRefs.current.delete(appointmentId);
  }, []);

  // Manual retry of failed move
  const retryFailedMove = useCallback(async (appointmentId: string): Promise<void> => {
    const conflict = activeConflicts.find(c => c.appointmentId === appointmentId);
    if (!conflict) {
      throw new Error('No active conflict found for appointment');
    }

    await resolveConflict({
      ...conflict,
      suggestedAction: 'retry_with_current'
    });
  }, [activeConflicts, resolveConflict]);

  // Getters for state
  const getPendingMoves = useCallback(() => [...pendingMoves], [pendingMoves]);
  const getActiveConflicts = useCallback(() => [...activeConflicts], [activeConflicts]);

  return {
    protectedMove,
    resolveConflict,
    dismissConflict,
    getPendingMoves,
    getActiveConflicts,
    hasDoubleMoveConflict,
    retryFailedMove,
    pendingMoves,
    activeConflicts,
    isProcessing
  };
}
