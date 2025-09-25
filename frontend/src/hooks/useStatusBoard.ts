/**
 * React Hook for Status Board State Management
 * Implements optimistic UI with rollback, retry logic, and performance monitoring
 * Based on T8 Frontend Integration Contracts
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  StatusBoardState,
  StatusBoardAction,
  UseStatusBoardReturn,
  BoardRequest,
  BoardResponse,
  StatsRequest,
  StatsResponse,
  MoveResponse,
  AppointmentStatus,
  AppointmentCard,
  ApiError,
  ConflictError,
  OptimisticUpdate,
  RequestConfig,
  LoadingStates,
  ErrorStates
} from '../types/api';
import {
  getDefaultClient,
  isConflictError,
  isRetryableError,
  metricsCollector
} from '../services/statusBoardClient';
import {
  collectBoardLoadMetric,
  collectStatsLoadMetric,
  collectMoveOperationMetric
} from '../services/metricsCollector';

// ===== INITIAL STATE =====

const initialLoadingState: LoadingStates = {
  boardLoading: false,
  statsLoading: false,
  refreshing: false,
  movePending: {}
};

const initialErrorState: ErrorStates = {
  moveErrors: {}
};

const initialState: StatusBoardState = {
  loading: initialLoadingState,
  errors: initialErrorState,
  optimisticUpdates: [],
  lastFetch: {}
};

// ===== REDUCER =====

function statusBoardReducer(
  state: StatusBoardState,
  action: StatusBoardAction
): StatusBoardState {
  switch (action.type) {
    case 'FETCH_BOARD_START':
      return {
        ...state,
        loading: {
          ...state.loading,
          boardLoading: true
        },
        errors: {
          ...state.errors,
          boardError: undefined
        }
      };

    case 'FETCH_BOARD_SUCCESS':
      return {
        ...state,
        board: action.payload,
        loading: {
          ...state.loading,
          boardLoading: false,
          refreshing: false
        },
        lastFetch: {
          ...state.lastFetch,
          board: Date.now()
        }
      };

    case 'FETCH_BOARD_ERROR':
      return {
        ...state,
        loading: {
          ...state.loading,
          boardLoading: false,
          refreshing: false
        },
        errors: {
          ...state.errors,
          boardError: action.payload
        }
      };

    case 'FETCH_STATS_START':
      return {
        ...state,
        loading: {
          ...state.loading,
          statsLoading: true
        },
        errors: {
          ...state.errors,
          statsError: undefined
        }
      };

    case 'FETCH_STATS_SUCCESS':
      return {
        ...state,
        stats: action.payload,
        loading: {
          ...state.loading,
          statsLoading: false
        },
        lastFetch: {
          ...state.lastFetch,
          stats: Date.now()
        }
      };

    case 'FETCH_STATS_ERROR':
      return {
        ...state,
        loading: {
          ...state.loading,
          statsLoading: false
        },
        errors: {
          ...state.errors,
          statsError: action.payload
        }
      };

    case 'MOVE_START':
      return {
        ...state,
        loading: {
          ...state.loading,
          movePending: {
            ...state.loading.movePending,
            [action.payload.appointmentId]: true
          }
        },
        errors: {
          ...state.errors,
          moveErrors: {
            ...state.errors.moveErrors,
            [action.payload.appointmentId]: undefined
          }
        }
      };

    case 'MOVE_SUCCESS': {
      const { appointmentId, response } = action.payload;
      return {
        ...state,
        board: state.board ? updateAppointmentInBoard(state.board, appointmentId, {
          version: response.version,
          status: response.status,
          position: response.position
        }) : state.board,
        loading: {
          ...state.loading,
          movePending: {
            ...state.loading.movePending,
            [appointmentId]: false
          }
        },
        optimisticUpdates: state.optimisticUpdates.filter(
          update => update.appointmentId !== appointmentId
        )
      };
    }

    case 'MOVE_ERROR':
      return {
        ...state,
        loading: {
          ...state.loading,
          movePending: {
            ...state.loading.movePending,
            [action.payload.appointmentId]: false
          }
        },
        errors: {
          ...state.errors,
          moveErrors: {
            ...state.errors.moveErrors,
            [action.payload.appointmentId]: action.payload.error
          }
        }
      };

    case 'MOVE_OPTIMISTIC': {
      const update = action.payload;
      return {
        ...state,
        board: state.board ? applyOptimisticUpdate(state.board, update) : state.board,
        optimisticUpdates: [...state.optimisticUpdates, update]
      };
    }

    case 'MOVE_ROLLBACK': {
      const rollbackId = action.payload.appointmentId;
      const rollbackUpdate = state.optimisticUpdates.find(
        update => update.appointmentId === rollbackId
      );

      return {
        ...state,
        board: rollbackUpdate && state.board
          ? rollbackOptimisticUpdate(state.board, rollbackUpdate)
          : state.board,
        optimisticUpdates: state.optimisticUpdates.filter(
          update => update.appointmentId !== rollbackId
        )
      };
    }

    case 'CLEAR_ERROR': {
      const { type, id } = action.payload;
      if (type === 'moveErrors' && id) {
        const newMoveErrors = { ...state.errors.moveErrors };
        delete newMoveErrors[id];
        return {
          ...state,
          errors: {
            ...state.errors,
            moveErrors: newMoveErrors
          }
        };
      } else if (type in state.errors) {
        return {
          ...state,
          errors: {
            ...state.errors,
            [type]: undefined
          }
        };
      }
      return state;
    }

    case 'SET_REFRESHING':
      return {
        ...state,
        loading: {
          ...state.loading,
          refreshing: action.payload
        }
      };

    default:
      return state;
  }
}

// ===== HELPER FUNCTIONS =====

function updateAppointmentInBoard(
  board: BoardResponse,
  appointmentId: string,
  updates: Partial<AppointmentCard>
): BoardResponse {
  return {
    ...board,
    cards: board.cards.map(card =>
      card.id === appointmentId ? { ...card, ...updates } : card
    )
  };
}

function applyOptimisticUpdate(
  board: BoardResponse,
  update: OptimisticUpdate
): BoardResponse {
  return {
    ...board,
    cards: board.cards.map(card =>
      card.id === update.appointmentId
        ? { ...card, ...update.pendingState }
        : card
    )
  };
}

function rollbackOptimisticUpdate(
  board: BoardResponse,
  update: OptimisticUpdate
): BoardResponse {
  return {
    ...board,
    cards: board.cards.map(card =>
      card.id === update.appointmentId
        ? { ...card, ...update.originalState }
        : card
    )
  };
}

// ===== MAIN HOOK =====

export function useStatusBoard(config?: {
  pollingInterval?: number;
  enablePolling?: boolean;
  maxOptimisticUpdates?: number;
  optimisticTimeout?: number;
}): UseStatusBoardReturn {
  const [state, dispatch] = useReducer(statusBoardReducer, initialState);
  const apiClient = getDefaultClient();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const optimisticTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const {
    pollingInterval = 30000,  // 30 seconds
    enablePolling = false,
    maxOptimisticUpdates = 10,
    optimisticTimeout = 5000  // 5 seconds
  } = config || {};

  // ===== API ACTIONS =====

  const fetchBoard = useCallback(async (
    params: BoardRequest,
    requestConfig?: RequestConfig
  ): Promise<BoardResponse> => {
    dispatch({ type: 'FETCH_BOARD_START' });
    const startTime = performance.now();
    let success = true;

    try {
      const response = await apiClient.fetchBoard(params, requestConfig);
      dispatch({ type: 'FETCH_BOARD_SUCCESS', payload: response });
      return response;
    } catch (error) {
      success = false;
      const apiError = error as ApiError;
      dispatch({ type: 'FETCH_BOARD_ERROR', payload: apiError });
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      collectBoardLoadMetric(duration, success);
    }
  }, [apiClient]);

  const fetchStats = useCallback(async (
    params: StatsRequest,
    requestConfig?: RequestConfig
  ): Promise<StatsResponse> => {
    dispatch({ type: 'FETCH_STATS_START' });
    const startTime = performance.now();
    let success = true;

    try {
      const response = await apiClient.fetchStats(params, requestConfig);
      dispatch({ type: 'FETCH_STATS_SUCCESS', payload: response });
      return response;
    } catch (error) {
      success = false;
      const apiError = error as ApiError;
      dispatch({ type: 'FETCH_STATS_ERROR', payload: apiError });
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      collectStatsLoadMetric(duration, success);
    }
  }, [apiClient]);

  const moveAppointment = useCallback(async (
    appointmentId: string,
    status: AppointmentStatus,
    position: number,
    requestConfig?: RequestConfig
  ): Promise<MoveResponse> => {
    const startTime = performance.now();

    // Prevent too many optimistic updates
    if (state.optimisticUpdates.length >= maxOptimisticUpdates) {
      const duration = performance.now() - startTime;
      collectMoveOperationMetric(duration, false);
      throw new Error('Too many pending operations. Please wait.');
    }

    // Find current appointment state
    const currentCard = state.board?.cards.find(card => card.id === appointmentId);
    if (!currentCard) {
      const duration = performance.now() - startTime;
      collectMoveOperationMetric(duration, false);
      throw new Error('Appointment not found');
    }

    // Create optimistic update
    const optimisticUpdate: OptimisticUpdate = {
      appointmentId,
      originalState: {
        status: currentCard.status,
        position: currentCard.position
      },
      pendingState: { status, position },
      timestamp: Date.now(),
      retryCount: 0
    };

    // Apply optimistic update immediately
    dispatch({ type: 'MOVE_OPTIMISTIC', payload: optimisticUpdate });
    dispatch({ type: 'MOVE_START', payload: { appointmentId } });

    // Set up timeout for optimistic rollback
    const timeoutId = setTimeout(() => {
      dispatch({ type: 'MOVE_ROLLBACK', payload: { appointmentId } });
      dispatch({
        type: 'MOVE_ERROR',
        payload: {
          appointmentId,
          error: {
            error: 'timeout_error',
            message: 'Move operation timed out'
          }
        }
      });

      // Collect timeout metric
      const duration = performance.now() - startTime;
      collectMoveOperationMetric(duration, false);
    }, optimisticTimeout);

    optimisticTimeoutRefs.current.set(appointmentId, timeoutId);

    try {
      const response = await apiClient.moveAppointment(
        appointmentId,
        {
          status,
          position,
          version: currentCard.version
        },
        requestConfig
      );

      // Clear timeout and confirm move
      clearTimeout(timeoutId);
      optimisticTimeoutRefs.current.delete(appointmentId);

      dispatch({
        type: 'MOVE_SUCCESS',
        payload: { appointmentId, response }
      });

      // Collect success metric
      const duration = performance.now() - startTime;
      collectMoveOperationMetric(duration, true);

      return response;

    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);
      optimisticTimeoutRefs.current.delete(appointmentId);

      const apiError = error as ApiError;

      // Handle version conflicts
      if (isConflictError(apiError)) {
        // Rollback and refresh appointment
        dispatch({ type: 'MOVE_ROLLBACK', payload: { appointmentId } });

        // Optionally refetch the current state
        try {
          const freshCard = await apiClient.getAppointment(appointmentId);
          dispatch({
            type: 'FETCH_BOARD_SUCCESS',
            payload: state.board ? {
              ...state.board,
              cards: state.board.cards.map(card =>
                card.id === appointmentId ? freshCard : card
              )
            } : state.board!
          });
        } catch (refreshError) {
          // Ignore refresh errors
        }
      } else {
        // For retryable errors, keep the optimistic update briefly
        if (isRetryableError(apiError)) {
          setTimeout(() => {
            dispatch({ type: 'MOVE_ROLLBACK', payload: { appointmentId } });
          }, 2000);
        } else {
          // For non-retryable errors, rollback immediately
          dispatch({ type: 'MOVE_ROLLBACK', payload: { appointmentId } });
        }
      }

      dispatch({
        type: 'MOVE_ERROR',
        payload: { appointmentId, error: apiError }
      });

      // Collect error metric
      const duration = performance.now() - startTime;
      collectMoveOperationMetric(duration, false);

      throw error;
    }
  }, [apiClient, state.board, state.optimisticUpdates.length, maxOptimisticUpdates, optimisticTimeout]);

  // ===== UTILITY ACTIONS =====

  const refreshBoard = useCallback(async (preserveOptimistic = true) => {
    if (!state.board) return;

    dispatch({ type: 'SET_REFRESHING', payload: true });

    try {
      // Use the same params from the last board fetch
      const lastBoardFetch = state.lastFetch.board;
      if (!lastBoardFetch) return;

      // For now, use a default date range - in a real app, store the last params
      const today = new Date().toISOString().split('T')[0];
      const response = await apiClient.fetchBoard({ from: today, to: today });

      if (!preserveOptimistic || state.optimisticUpdates.length === 0) {
        dispatch({ type: 'FETCH_BOARD_SUCCESS', payload: response });
      } else {
        // Merge with optimistic updates
        let mergedBoard = response;
        for (const update of state.optimisticUpdates) {
          mergedBoard = applyOptimisticUpdate(mergedBoard, update);
        }
        dispatch({ type: 'FETCH_BOARD_SUCCESS', payload: mergedBoard });
      }
    } catch (error) {
      dispatch({ type: 'FETCH_BOARD_ERROR', payload: error as ApiError });
    } finally {
      dispatch({ type: 'SET_REFRESHING', payload: false });
    }
  }, [apiClient, state.board, state.lastFetch.board, state.optimisticUpdates]);

  const refreshStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    await fetchStats({ from: today, to: today });
  }, [fetchStats]);

  const clearError = useCallback((type: keyof ErrorStates, id?: string) => {
    dispatch({ type: 'CLEAR_ERROR', payload: { type, id } });
  }, []);

  const retryFailedMove = useCallback(async (appointmentId: string): Promise<void> => {
    const error = state.errors.moveErrors[appointmentId];
    if (!error || !isRetryableError(error)) return;

    const currentCard = state.board?.cards.find(card => card.id === appointmentId);
    if (!currentCard) return;

    // Get the intended state from optimistic updates or use current
    const optimisticUpdate = state.optimisticUpdates.find(
      update => update.appointmentId === appointmentId
    );

    if (optimisticUpdate?.pendingState.status && optimisticUpdate.pendingState.position !== undefined) {
      await moveAppointment(
        appointmentId,
        optimisticUpdate.pendingState.status,
        optimisticUpdate.pendingState.position
      );
    }
  }, [state.errors.moveErrors, state.board, state.optimisticUpdates, moveAppointment]);

  // ===== POLLING SETUP =====

  useEffect(() => {
    if (enablePolling && pollingInterval > 0) {
      pollingRef.current = setInterval(() => {
        refreshBoard(true);
        refreshStats();
      }, pollingInterval);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [enablePolling, pollingInterval, refreshBoard, refreshStats]);

  // ===== CLEANUP =====

  useEffect(() => {
    return () => {
      // Clear all optimistic timeouts
      optimisticTimeoutRefs.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      optimisticTimeoutRefs.current.clear();

      // Clear polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    // Data
    board: state.board,
    stats: state.stats,

    // State
    loading: state.loading,
    errors: state.errors,

    // Actions
    fetchBoard,
    fetchStats,
    moveAppointment,

    // Utilities
    refreshBoard,
    refreshStats,
    clearError,
    retryFailedMove
  };
}

// ===== PERFORMANCE HOOK =====

export function useStatusBoardMetrics() {
  const getMetrics = useCallback(() => {
    return metricsCollector.getMetrics();
  }, []);

  const getLatencyStats = useCallback((endpoint?: string) => {
    return metricsCollector.getLatencyStats(endpoint);
  }, []);

  const resetMetrics = useCallback(() => {
    metricsCollector.reset();
  }, []);

  return {
    getMetrics,
    getLatencyStats,
    resetMetrics
  };
}

// ===== ERROR BOUNDARY HOOK =====

export function useStatusBoardErrorBoundary() {
  const [error, setError] = useState<ApiError | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: ApiError) => {
    setError(error);

    // Log to monitoring service
    console.error('StatusBoard Error:', error);
  }, []);

  return {
    error,
    resetError,
    handleError
  };
}

export default useStatusBoard;
