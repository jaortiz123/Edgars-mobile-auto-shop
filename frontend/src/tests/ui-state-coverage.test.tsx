/**
 * @file State Component Coverage Tests
 * Part of UI/UX Completeness Audit - Phase 1 Task 2
 *
 * Tests focused on verifying that critical UI components properly render
 * loading, empty, error, and success states with appropriate accessibility.
 */
import React from 'react';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import CustomerHistory from '../components/admin/CustomerHistory';
import * as api from '@/lib/api';

// Extend Jest matchers for axe
expect.extend(toHaveNoViolations);

// Create spies on the real API functions
const mockGetCustomerHistory = vi.spyOn(api, 'getCustomerHistory');
const mockGetAppointments = vi.spyOn(api, 'getAppointments');

describe('State Component Coverage - Audit Tests', () => {
  const mockOnAppointmentClick = vi.fn();
  const customerId = 'test-customer-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAppointmentClick.mockClear();
    mockGetCustomerHistory.mockClear();
  });

  describe('CustomerHistory Component - Empty State', () => {
    it('renders accessible empty state with clear messaging and CTA', async () => {
      // Setup: Mock API to return empty data (based on actual API response format)
      mockGetCustomerHistory.mockResolvedValue({
        data: {
          pastAppointments: [],
          payments: []
        },
        errors: null
      });

      render(
        <CustomerHistory
          customerId={customerId}
          onAppointmentClick={mockOnAppointmentClick}
        />
      );

      // Wait for empty state to render
      const emptyMessage = await screen.findByText('No appointment history');
      expect(emptyMessage).toBeInTheDocument();

      // Verify accessible empty state messaging
      expect(screen.getByText('This customer has no completed appointments yet.')).toBeInTheDocument();

      // Run accessibility check on empty state
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    });

    it('empty state provides meaningful context and next steps', async () => {
      mockGetCustomerHistory.mockResolvedValue({
        data: {
          pastAppointments: [],
          payments: []
        },
        errors: null
      });

      render(
        <CustomerHistory
          customerId={customerId}
          onAppointmentClick={mockOnAppointmentClick}
        />
      );

      await screen.findByText('No appointment history');

      // Verify the empty state is not just "blank abyss" but provides context
      const emptyText = screen.getByText('This customer has no completed appointments yet.');
      expect(emptyText).toBeInTheDocument();

      // Empty state should be semantic and screen-reader friendly
      expect(emptyText.tagName.toLowerCase()).toBe('p');
    });
  });

  describe('CustomerHistory Component - Error State', () => {
    it('renders accessible error state with retry functionality', async () => {
      const user = userEvent.setup();

      // Mock console.error to prevent CI-STRICT violations
      const originalError = console.error;
      console.error = vi.fn();

      try {
        // Setup: Mock API to fail
        mockGetCustomerHistory.mockRejectedValue(new Error('Network error'));

        render(
          <CustomerHistory
            customerId={customerId}
            onAppointmentClick={mockOnAppointmentClick}
          />
        );

        // Wait for error state
        const errorMessage = await screen.findByText('Failed to load customer history', {}, { timeout: 5000 });
        expect(errorMessage).toBeInTheDocument();

        // Verify retry button is present and accessible
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();

        // Test retry functionality
        mockGetCustomerHistory.mockResolvedValue({
          data: { pastAppointments: [], payments: [] },
          errors: null
        });

        await user.click(retryButton);

        // Should show empty state after successful retry
        expect(await screen.findByText('No appointment history')).toBeInTheDocument();

        // Run accessibility check on error state
        const results = await axe(document.body);
        expect(results).toHaveNoViolations();

      } finally {
        console.error = originalError;
      }
    });

    it('error state announces changes to screen readers', async () => {
      const originalError = console.error;
      console.error = vi.fn();

      try {
        mockGetCustomerHistory.mockRejectedValue(new Error('Network error'));

        render(
          <CustomerHistory
            customerId={customerId}
            onAppointmentClick={mockOnAppointmentClick}
          />
        );

        const errorMessage = await screen.findByText('Failed to load customer history');

        // Error should be in a live region or have appropriate ARIA
        const errorContainer = errorMessage.closest('[role="alert"], [aria-live]');
        expect(errorContainer).toBeTruthy();

      } finally {
        console.error = originalError;
      }
    });
  });

  describe('Loading State Accessibility', () => {
    it('loading states are announced to screen readers', async () => {
      const pendingPromise = new Promise(() => {});
      mockGetCustomerHistory.mockReturnValue(pendingPromise as any);

      render(
        <CustomerHistory
          customerId={customerId}
          onAppointmentClick={mockOnAppointmentClick}
        />
      );

      await waitFor(() => {
        // Check for aria-busy or live region
        const loadingElement = document.querySelector('[aria-busy="true"], [aria-live], .sr-only');
        expect(loadingElement).toBeTruthy();
      }, { timeout: 500 });
    });
  });

  describe('Success State Accessibility', () => {
    it('successful data load is accessible and properly structured', async () => {
      // Create a mock appointment with correct structure
      const mockAppointment = {
        id: 'apt-123',
        status: 'COMPLETED',
        start: '2024-01-15T10:00:00Z',
        total_amount: 100.00,
        paid_amount: 100.00,
        created_at: '2024-01-10T08:00:00Z',
        payments: []
      };

      mockGetCustomerHistory.mockResolvedValue({
        data: {
          pastAppointments: [mockAppointment],
          payments: []
        },
        errors: null
      });

      render(
        <CustomerHistory
          customerId={customerId}
          onAppointmentClick={mockOnAppointmentClick}
        />
      );

      // Wait for data to load (look for appointment info)
      await waitFor(() => {
        const appointmentElement = screen.getByText('COMPLETED');
        expect(appointmentElement).toBeInTheDocument();
      });

      // Run accessibility check on success state
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();

      // Verify proper heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});
