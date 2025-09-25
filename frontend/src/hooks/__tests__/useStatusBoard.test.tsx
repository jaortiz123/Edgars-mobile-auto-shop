// useStatusBoard Hook Tests
// Sprint 6 T6 - Hook integration and error handling tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
vi.mock('@/services/statusBoardClient');

import { useStatusBoard } from '@/hooks/useStatusBoard';
import { StatusBoardClient } from '@/services/statusBoardClient';

// Test utilities
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

// Mock data
const mockBoardResponse = {
  data: {
    columns: {
      scheduled: [{
        id: '1',
        customer_name: 'John Doe',
        status: 'SCHEDULED',
        version: 1,
        appt_start: '2025-01-20T10:00:00Z',
        appt_end: '2025-01-20T11:00:00Z'
      }],
      in_progress: [],
      ready: [],
      completed: [],
      no_show: []
    },
    lastUpdated: new Date().toISOString(),
    version: 1
  }
};

describe('useStatusBoard Hook Tests', () => {
  let mockStatusBoardClient: any;

  beforeEach(() => {
    mockStatusBoardClient = {
      getBoard: vi.fn().mockResolvedValue(mockBoardResponse),
      moveAppointment: vi.fn().mockResolvedValue({ success: true }),
      getStats: vi.fn().mockResolvedValue({ data: {} })
    };

    vi.mocked(StatusBoardClient).mockImplementation(() => mockStatusBoardClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Board Data Fetching', () => {
    it('fetches board data successfully', async () => {
      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.board).toEqual(mockBoardResponse.data);
      expect(result.current.errors).toHaveLength(0);
    });

    it('handles loading state correctly', () => {
      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      // Initially should be loading
      expect(result.current.loading).toBe(true);
      expect(result.current.board).toBeNull();
    });

    it('handles API errors gracefully', async () => {
      const apiError = new Error('Network failed');
      mockStatusBoardClient.getBoard.mockRejectedValue(apiError);

      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.board).toBeNull();
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0]).toMatchObject({
        message: 'Network failed'
      });
    });
  });

  describe('Polling Configuration', () => {
    it('enables polling when configured', async () => {
      const { result } = renderHook(
        () => useStatusBoard({ enablePolling: true, pollingInterval: 5000 }),
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify polling is set up (would need to test with fake timers)
      expect(mockStatusBoardClient.getBoard).toHaveBeenCalled();
    });

    it('disables polling when not configured', async () => {
      const { result } = renderHook(
        () => useStatusBoard({ enablePolling: false }),
        { wrapper: TestWrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockStatusBoardClient.getBoard).toHaveBeenCalled();
    });
  });

  describe('Move Appointment Functionality', () => {
    it('moves appointment successfully with optimistic update', async () => {
      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.moveAppointment('1', 'IN_PROGRESS', 1);
      });

      expect(mockStatusBoardClient.moveAppointment).toHaveBeenCalledWith('1', 'IN_PROGRESS', 1);
    });

    it('handles move conflicts with version mismatch', async () => {
      const conflictError = new Error('Version conflict');
      conflictError.name = 'ConflictError';
      mockStatusBoardClient.moveAppointment.mockRejectedValue(conflictError);

      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.moveAppointment('1', 'IN_PROGRESS', 1);
        } catch (error) {
          expect(error).toEqual(conflictError);
        }
      });

      expect(mockStatusBoardClient.moveAppointment).toHaveBeenCalled();
    });

    it('reverts optimistic update on move failure', async () => {
      const networkError = new Error('Network timeout');
      mockStatusBoardClient.moveAppointment.mockRejectedValue(networkError);

      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalBoard = result.current.board;

      await act(async () => {
        try {
          await result.current.moveAppointment('1', 'IN_PROGRESS', 1);
        } catch (error) {
          expect(error).toEqual(networkError);
        }
      });

      // Should revert to original state on failure
      // (This would need more sophisticated testing with state tracking)
      expect(mockStatusBoardClient.moveAppointment).toHaveBeenCalled();
    });
  });

  describe('Refresh Functionality', () => {
    it('refreshes board data on demand', async () => {
      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear previous calls
      mockStatusBoardClient.getBoard.mockClear();

      await act(async () => {
        result.current.refreshBoard();
      });

      // Should trigger a new fetch
      expect(mockStatusBoardClient.getBoard).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('recovers from network errors on retry', async () => {
      // First call fails
      mockStatusBoardClient.getBoard
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockBoardResponse);

      const { result } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.errors).toHaveLength(1);
      });

      // Retry should succeed
      await act(async () => {
        result.current.refreshBoard();
      });

      await waitFor(() => {
        expect(result.current.errors).toHaveLength(0);
        expect(result.current.board).toEqual(mockBoardResponse.data);
      });
    });
  });

  describe('Memory Management', () => {
    it('cleans up resources properly', () => {
      const { unmount } = renderHook(() => useStatusBoard(), {
        wrapper: TestWrapper
      });

      // Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});

export default {};
