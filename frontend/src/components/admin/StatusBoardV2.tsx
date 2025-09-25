/**
 * StatusBoard V2 - Sprint 6 Implementation with Performance Monitoring
 * Uses Sprint 2 API contracts with useStatusBoard hook and statusBoardClient
 * T7: Performance monitoring with SLO compliance <800ms board load, <200ms drawer open
 */

import React, { useState, useCallback, useEffect, Suspense, memo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { format } from 'date-fns';
import { useStatusBoard } from '../../hooks/useStatusBoard';
import { StatusBoardClient } from '../../services/statusBoardClient';
import { AppointmentCard, AppointmentStatus, ApiError } from '../../types/api';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RefreshCw, Calendar, Clock, Phone, User, AlertTriangle } from 'lucide-react';
import StatusBoardDrawer from './StatusBoardDrawer';
import { useSLOToast } from '../../hooks/useSLOToast';
import { usePerformanceMonitoring } from '../../utils/performanceMonitor';

interface StatusBoardV2Props {
  onCardClick?: (appointment: AppointmentCard) => void;
  minimalHero?: boolean;
}

const COLUMN_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  ready: 'Ready',
  completed: 'Completed',
  no_show: 'No Show'
} as const;

const COLUMN_COLORS = {
  scheduled: 'bg-blue-50 border-blue-200',
  in_progress: 'bg-yellow-50 border-yellow-200',
  ready: 'bg-green-50 border-green-200',
  completed: 'bg-gray-50 border-gray-200',
  no_show: 'bg-red-50 border-red-200'
} as const;

interface DraggableCardProps {
  card: AppointmentCard;
  onCardClick?: (card: AppointmentCard) => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ card, onCardClick }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'APPOINTMENT_CARD',
    item: { id: card.id, version: card.version, currentStatus: card.status },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag as any}
      className={`cursor-move mb-3 ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onCardClick?.(card)}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-medium text-sm">{card.customer_name}</h4>
            <Badge variant="outline" className="text-xs">
              {format(new Date(card.appt_start), 'HH:mm')}
            </Badge>
          </div>

          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{card.customer_phone}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{format(new Date(card.appt_start), 'MMM dd, HH:mm')} - {format(new Date(card.appt_end), 'HH:mm')}</span>
            </div>
            {card.services && card.services.length > 0 && (
              <div className="text-xs font-medium text-blue-600">
                {card.services[0].name}
                {card.services.length > 1 && ` +${card.services.length - 1} more`}
              </div>
            )}
          </div>

          {card.vehicle_info && (
            <div className="mt-2 text-xs text-gray-500 truncate">
              Vehicle: {card.vehicle_info}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface DroppableColumnProps {
  status: AppointmentStatus;
  title: string;
  cards: AppointmentCard[];
  onDrop: (appointmentId: string, newStatus: AppointmentStatus, expectedVersion: number) => void;
  onCardClick?: (card: AppointmentCard) => void;
  className?: string;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  status,
  title,
  cards,
  onDrop,
  onCardClick,
  className
}) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'APPOINTMENT_CARD',
    drop: (item: { id: string; version: number; currentStatus: AppointmentStatus }) => {
      if (item.currentStatus !== status) {
        onDrop(item.id, status, item.version);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop as any}
      className={`${className} ${isOver ? 'ring-2 ring-blue-400' : ''} rounded-lg p-4 min-h-[400px]`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <Badge variant="secondary" className="bg-white">
          {cards.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {cards.map(card => (
          <DraggableCard
            key={card.id}
            card={card}
            onCardClick={onCardClick}
          />
        ))}

        {cards.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-sm">No appointments</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const StatusBoardV2: React.FC<StatusBoardV2Props> = memo(({ onCardClick, minimalHero = false }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showConflictToast, setShowConflictToast] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentCard | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // T7: Performance monitoring hooks
  const { startTiming, endTiming, isHealthy } = usePerformanceMonitoring();

  // Initialize the StatusBoard client
  const client = new StatusBoardClient({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  });

  // Use the Sprint 2 hook
  const {
    board,
    loading,
    errors,
    fetchBoard,
    moveAppointment,
    refreshBoard
  } = useStatusBoard({
    enablePolling: true,
    pollingInterval: 30000 // 30 seconds
  });

  // Use SLO-aware toast notifications
  const toast = useSLOToast();

  const handleMoveAppointment = useCallback(async (
    appointmentId: string,
    newStatus: AppointmentStatus,
    expectedVersion: number
  ) => {
    try {
      // T7: Performance monitoring for drag operations
      startTiming('dragOperation');

      await moveAppointment(appointmentId, newStatus, 0);

      const dragDuration = endTiming('dragOperation');
      // Show success notification
      toast.operationSuccess('appointment_move');
    } catch (err) {
      endTiming('dragOperation'); // End timing even on error
      const apiError = err as ApiError;

      // Use centralized error mapping and show user-friendly toast
      toast.apiError(apiError, () => {
        // Retry function
        handleMoveAppointment(appointmentId, newStatus, expectedVersion);
      });

      // Auto-refresh on conflicts
      if (apiError.error === 'version_conflict' || apiError.error === 'appointment_conflict') {
        setTimeout(async () => {
          await refreshBoard();
        }, 1000);
      }
    }
  }, [moveAppointment, refreshBoard]);

  const handleRefresh = useCallback(async () => {
    try {
      await refreshBoard();
      toast.operationSuccess('board_load');
    } catch (err) {
      const apiError = err as ApiError;
      toast.apiError(apiError, handleRefresh);
    }
  }, [refreshBoard]);

  const handleDateChange = useCallback((newDate: string) => {
    setSelectedDate(newDate);
  }, []);

  // Initial board fetch and date change handling with performance monitoring
  useEffect(() => {
    // T7: Performance monitoring for board load <800ms SLO
    startTiming('boardLoad');

    fetchBoard({
      from: selectedDate,
      to: selectedDate
    }).then(() => {
      const loadDuration = endTiming('boardLoad');
      toast.operationSuccess('board_load');
    }).catch(err => {
      endTiming('boardLoad'); // End timing even on error
      const apiError = err as ApiError;
      toast.apiError(apiError, () => {
        // Retry function for board fetch
        fetchBoard({
          from: selectedDate,
          to: selectedDate
        });
      });
    });
  }, [selectedDate, fetchBoard, startTiming, endTiming, toast]);

  // Group cards by status
  const cardsByStatus = React.useMemo(() => {
    const initial: Record<AppointmentStatus, AppointmentCard[]> = {
      scheduled: [],
      in_progress: [],
      ready: [],
      completed: [],
      no_show: []
    };

    if (!board?.cards) return initial;

    return board.cards.reduce((acc, card) => {
      acc[card.status].push(card);
      return acc;
    }, initial);
  }, [board?.cards]);

  // Handle card click to open drawer with performance monitoring
  const handleCardClick = useCallback((card: AppointmentCard) => {
    // T7: Performance monitoring for drawer open <200ms SLO
    startTiming('drawerOpen');

    setSelectedAppointment(card);
    setDrawerOpen(true);
    onCardClick?.(card);

    // Measure drawer open performance after DOM update
    requestAnimationFrame(() => {
      const drawerDuration = endTiming('drawerOpen');
    });
  }, [onCardClick, startTiming, endTiming]);

  // Handle drawer status change
  const handleDrawerStatusChange = useCallback(async (appointmentId: string, newStatus: AppointmentStatus) => {
    await moveAppointment(appointmentId, newStatus, 0);
    // Keep drawer open to show updated status
  }, [moveAppointment]);

  const hasError = errors.boardError || errors.statsError;
  if (hasError) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error Loading Board</h3>
          <p className="text-red-600 mb-4">{hasError.message}</p>
          <Button onClick={handleRefresh} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-6">
        {/* Header */}
        {!minimalHero && (
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Status Board</h1>
              <p className="text-gray-600">Drag and drop appointments to update their status</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="border rounded px-3 py-1"
                  title="Select date"
                  aria-label="Select date for status board"
                />
              </div>

              <Button
                onClick={handleRefresh}
                disabled={loading.boardLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading.boardLoading ? 'animate-spin' : ''}`} />
                {loading.boardLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
        )}

        {/* Conflict Toast */}
        {showConflictToast && (
          <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded shadow-lg z-50">
            {conflictMessage}
          </div>
        )}

        {/* Loading State */}
        {loading.boardLoading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading board...</span>
            </div>
          </div>
        )}

        {/* Board Columns */}
        {!loading.boardLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {(['scheduled', 'in_progress', 'ready', 'completed', 'no_show'] as AppointmentStatus[]).map(status => (
              <DroppableColumn
                key={status}
                status={status}
                title={COLUMN_LABELS[status]}
                cards={cardsByStatus[status] || []}
                onDrop={handleMoveAppointment}
                onCardClick={handleCardClick}
                className={COLUMN_COLORS[status]}
              />
            ))}
          </div>
        )}

        {/* Moving indicator */}
        {Object.keys(loading.movePending).length > 0 && (
          <div className="fixed bottom-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-2 rounded shadow-lg">
            Moving appointment...
          </div>
        )}

        {/* Appointment Drawer */}
        <StatusBoardDrawer
          appointment={selectedAppointment}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onStatusChange={handleDrawerStatusChange}
        />
      </div>
    </DndProvider>
  );
};

// Performance-aware Suspense wrapper for StatusBoardV2
// T7: Suspense boundaries for optimized loading
const StatusBoardV2WithSuspense: React.FC<StatusBoardV2Props> = (props) => {
  const LoadingFallback = () => (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading Status Board...</span>
      </div>
    </div>
  );

  return (
    <Suspense fallback={<LoadingFallback />}>
      <StatusBoardV2 {...props} />
    </Suspense>
  );
};

export default StatusBoardV2WithSuspense;
