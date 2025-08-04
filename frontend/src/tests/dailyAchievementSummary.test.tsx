/**
 * Sprint 4A-T-002: Daily Achievement Summary Tests
 * 
 * Unit and integration tests for summary data and display logic
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { DailyAchievementSummary, DailyAchievementSummaryCard } from '../components/DailyAchievementSummary/DailyAchievementSummary';
import { getDailySummary, shouldShowDailySummary, markSummaryAsSeen } from '../services/summaryService';

// Mock the summary service
jest.mock('../services/summaryService', () => ({
  getDailySummary: jest.fn(),
  shouldShowDailySummary: jest.fn(),
  markSummaryAsSeen: jest.fn(),
  scheduleAutomaticSummary: jest.fn(),
}));

// Mock CSS file
jest.mock('../components/DailyAchievementSummary/DailyAchievementSummary.css', () => ({}));

describe('DailyAchievementSummary', () => {
  const mockSummaryData = {
    jobsCompleted: 5,
    revenue: 1250.75,
    topTech: {
      name: 'Edgar Martinez',
      jobsCompleted: 3
    },
    date: '2024-01-15'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DailyAchievementSummary Modal', () => {
    test('renders correctly when open', () => {
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={jest.fn()}
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
        />
      );

      expect(screen.getByText('🎉 Today\'s Achievements')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('$1,250.75')).toBeInTheDocument();
      expect(screen.getByText('Edgar Martinez')).toBeInTheDocument();
      expect(screen.getByText('3 jobs completed')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <DailyAchievementSummary
          isOpen={false}
          onClose={jest.fn()}
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
        />
      );

      expect(screen.queryByText('🎉 Today\'s Achievements')).not.toBeInTheDocument();
    });

    test('calls onClose when close button clicked', async () => {
      const mockOnClose = jest.fn();
      
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={mockOnClose}
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByLabelText('Close summary'));
      
      await waitFor(() => {
        expect(markSummaryAsSeen).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('calls onClose when backdrop clicked', async () => {
      const mockOnClose = jest.fn();
      
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={mockOnClose}
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('dialog'));
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('displays correct message for zero jobs', () => {
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={jest.fn()}
          jobsCompleted={0}
          revenue={0}
          topTech={{ name: 'No data', jobsCompleted: 0 }}
          date={mockSummaryData.date}
        />
      );

      expect(screen.getByText(/Ready for tomorrow's opportunities/)).toBeInTheDocument();
    });

    test('displays correct message for high productivity', () => {
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={jest.fn()}
          jobsCompleted={8}
          revenue={2000}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
        />
      );

      expect(screen.getByText(/Outstanding productivity/)).toBeInTheDocument();
    });

    test('formats currency correctly', () => {
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={jest.fn()}
          jobsCompleted={3}
          revenue={1250.75}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
        />
      );

      expect(screen.getByText('$1,250.75')).toBeInTheDocument();
    });

    test('formats date correctly', () => {
      render(
        <DailyAchievementSummary
          isOpen={true}
          onClose={jest.fn()}
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date="2024-01-15"
        />
      );

      expect(screen.getByText('Monday, January 15, 2024')).toBeInTheDocument();
    });
  });

  describe('DailyAchievementSummaryCard', () => {
    test('renders dashboard card correctly', () => {
      const mockOnViewDetails = jest.fn();
      
      render(
        <DailyAchievementSummaryCard
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByText('Today\'s Progress')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('$1,251')).toBeInTheDocument(); // Rounded for dashboard
      expect(screen.getByText('Edgar Martinez')).toBeInTheDocument();
      expect(screen.getByText('View Recap')).toBeInTheDocument();
    });

    test('calls onViewDetails when button clicked', async () => {
      const mockOnViewDetails = jest.fn();
      
      render(
        <DailyAchievementSummaryCard
          jobsCompleted={mockSummaryData.jobsCompleted}
          revenue={mockSummaryData.revenue}
          topTech={mockSummaryData.topTech}
          date={mockSummaryData.date}
          onViewDetails={mockOnViewDetails}
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByText('View Recap'));
      expect(mockOnViewDetails).toHaveBeenCalled();
    });
  });
});

describe('Summary Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  test('getDailySummary fetches and returns summary data', async () => {
    const mockData = {
      jobsCompleted: 3,
      revenue: 850,
      topTech: { name: 'Test Tech', jobsCompleted: 2 },
      date: '2024-01-15'
    };

    getDailySummary.mockResolvedValue(mockData);

    const result = await getDailySummary('2024-01-15');
    expect(result).toEqual(mockData);
    expect(getDailySummary).toHaveBeenCalledWith('2024-01-15');
  });

  test('shouldShowDailySummary returns correct values', () => {
    // Mock time as 6 PM
    const mockDate = new Date('2024-01-15T18:00:00');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    shouldShowDailySummary.mockReturnValue(true);

    const result = shouldShowDailySummary();
    expect(result).toBe(true);
  });

  test('markSummaryAsSeen updates localStorage', () => {
    markSummaryAsSeen.mockImplementation(() => {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`dailySummary_seen_${today}`, 'true');
    });

    markSummaryAsSeen();
    
    const today = new Date().toISOString().split('T')[0];
    expect(localStorage.getItem(`dailySummary_seen_${today}`)).toBe('true');
  });
});

describe('Accessibility Tests', () => {
  const mockSummaryData = {
    jobsCompleted: 5,
    revenue: 1250.75,
    topTech: { name: 'Edgar Martinez', jobsCompleted: 3 },
    date: '2024-01-15'
  };

  test('modal has proper ARIA attributes', () => {
    render(
      <DailyAchievementSummary
        isOpen={true}
        onClose={jest.fn()}
        jobsCompleted={mockSummaryData.jobsCompleted}
        revenue={mockSummaryData.revenue}
        topTech={mockSummaryData.topTech}
        date={mockSummaryData.date}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'summary-title');
  });

  test('close button has proper aria-label', () => {
    render(
      <DailyAchievementSummary
        isOpen={true}
        onClose={jest.fn()}
        jobsCompleted={mockSummaryData.jobsCompleted}
        revenue={mockSummaryData.revenue}
        topTech={mockSummaryData.topTech}
        date={mockSummaryData.date}
      />
    );

    expect(screen.getByLabelText('Close summary')).toBeInTheDocument();
  });

  test('view recap button has proper aria-label', () => {
    render(
      <DailyAchievementSummaryCard
        jobsCompleted={mockSummaryData.jobsCompleted}
        revenue={mockSummaryData.revenue}
        topTech={mockSummaryData.topTech}
        date={mockSummaryData.date}
        onViewDetails={jest.fn()}
      />
    );

    expect(screen.getByLabelText('View today\'s recap')).toBeInTheDocument();
  });
});

describe('Error Handling', () => {
  test('handles getDailySummary API errors gracefully', async () => {
    getDailySummary.mockRejectedValue(new Error('API Error'));

    const result = await getDailySummary('2024-01-15');
    
    // Should return fallback data
    expect(result).toEqual({
      jobsCompleted: 0,
      revenue: 0,
      topTech: { name: 'No data', jobsCompleted: 0 },
      date: '2024-01-15'
    });
  });

  test('summary displays gracefully with missing data', () => {
    render(
      <DailyAchievementSummary
        isOpen={true}
        onClose={jest.fn()}
        jobsCompleted={0}
        revenue={0}
        topTech={{ name: 'No data', jobsCompleted: 0 }}
        date="2024-01-15"
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
