/**
 * Sprint 4A-T-003: Running Revenue Component Stories
 *
 * Storybook stories demonstrating the RunningRevenue component in various states
 * and configurations for UI development and testing.
 */

import type { Meta, StoryObj } from '@storybook/react';
import RunningRevenue, { RunningRevenueCompact, RunningRevenueCard } from '../RunningRevenue/RunningRevenue';

// Mock the revenue service for Storybook
const mockRevenueService = {
  subscribeToRevenueUpdates: (callback: (data: any) => void) => {
    // Simulate real-time updates
    let revenue = 2500;

    // Initial callback
    setTimeout(() => {
      callback({
        totalRevenue: revenue,
        paidAmount: revenue * 0.7,
        unpaidAmount: revenue * 0.3,
        lastUpdated: new Date().toISOString()
      });
    }, 1000);

    // Simulate revenue increases every 5 seconds
    const interval = setInterval(() => {
      revenue += Math.floor(Math.random() * 500) + 100;
      callback({
        totalRevenue: revenue,
        paidAmount: revenue * 0.7,
        unpaidAmount: revenue * 0.3,
        lastUpdated: new Date().toISOString()
      });
    }, 5000);

    // Return unsubscribe function
    return () => clearInterval(interval);
  },

  formatCurrency: (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
};

// Mock the service module
jest.mock('../../services/revenueService', () => mockRevenueService);

const meta: Meta<typeof RunningRevenue> = {
  title: 'Sprint 4A/Running Revenue',
  component: RunningRevenue,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Running Revenue Component

A real-time revenue tracking component that displays today's revenue total with live updates.

## Features
- 🔄 Real-time updates via subscription
- 💰 Currency formatting with thousands separators
- 📊 Breakdown of paid vs unpaid amounts
- ⚡ Smooth animations on revenue changes
- 📱 Responsive design with mobile variants
- 🎨 Professional styling with hover effects

## Usage
- **Header Version**: Main component for dashboard header
- **Compact Version**: Smaller version for toolbar/sidebar
- **Card Version**: Widget version for dashboard cards

## API Integration
Connects to \`/api/admin/dashboard/stats\` and \`/api/admin/appointments\` endpoints with 30-second polling for real-time updates.
        `
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    },
    showBreakdown: {
      control: 'boolean',
      description: 'Show paid/unpaid breakdown'
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default story showing the main revenue component
 */
export const Default: Story = {
  args: {
    className: '',
    showBreakdown: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Default revenue display with real-time updates'
      }
    }
  }
};

/**
 * Revenue component with breakdown showing paid vs unpaid amounts
 */
export const WithBreakdown: Story = {
  args: {
    className: '',
    showBreakdown: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows detailed breakdown of paid and unpaid revenue'
      }
    }
  }
};

/**
 * Compact version for smaller spaces
 */
export const Compact: Story = {
  render: () => <RunningRevenueCompact />,
  parameters: {
    docs: {
      description: {
        story: 'Minimal version suitable for toolbars and navigation'
      }
    }
  }
};

/**
 * Card version for dashboard widgets
 */
export const Card: Story = {
  render: () => <RunningRevenueCard />,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Card format with trend indicators and detailed breakdown'
      }
    }
  }
};

/**
 * Loading state demonstration
 */
export const Loading: Story = {
  render: () => {
    // Mock service that never resolves to show loading state
    const LoadingRevenue = () => {
      return (
        <div className="running-revenue loading">
          <div className="revenue-skeleton">
            <div className="skeleton-line short"></div>
            <div className="skeleton-line"></div>
          </div>
        </div>
      );
    };

    return <LoadingRevenue />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the skeleton loading state while fetching revenue data'
      }
    }
  }
};

/**
 * Error state demonstration
 */
export const ErrorState: Story = {
  render: () => {
    const ErrorRevenue = () => {
      return (
        <div className="running-revenue error">
          <div className="revenue-label">Revenue Today:</div>
          <div className="revenue-amount error">
            Error loading
          </div>
        </div>
      );
    };

    return <ErrorRevenue />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Error state when revenue data fails to load'
      }
    }
  }
};

/**
 * High revenue demonstration
 */
export const HighRevenue: Story = {
  render: () => {
    // Mock high revenue for demo
    const HighRevenueComponent = () => {
      return (
        <div className="running-revenue">
          <div className="revenue-content">
            <div className="revenue-label">💰 Revenue Today:</div>
            <div className="revenue-amount">$45,750</div>
            <div className="revenue-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Paid:</span>
                <span className="breakdown-value paid">$32,025</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Pending:</span>
                <span className="breakdown-value pending">$13,725</span>
              </div>
            </div>
            <div className="revenue-updated">
              <span className="update-indicator">●</span>
              <span className="update-time">2:30 PM</span>
            </div>
          </div>
        </div>
      );
    };

    return <HighRevenueComponent />;
  },
  args: {
    showBreakdown: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Example with high revenue amounts showing number formatting'
      }
    }
  }
};

/**
 * Multiple variants side by side
 */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Header Version</h3>
        <RunningRevenue showBreakdown={true} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Compact Version</h3>
        <RunningRevenueCompact />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Card Version</h3>
        <RunningRevenueCard />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Comparison of all three component variants'
      }
    }
  }
};

/**
 * Responsive behavior demonstration
 */
export const Responsive: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="w-full max-w-sm">
        <h4 className="text-sm font-medium mb-2">Mobile (320px)</h4>
        <div className="border border-gray-200 p-2">
          <RunningRevenue className="text-sm" />
        </div>
      </div>

      <div className="w-full max-w-md">
        <h4 className="text-sm font-medium mb-2">Tablet (768px)</h4>
        <div className="border border-gray-200 p-3">
          <RunningRevenue showBreakdown={true} />
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <h4 className="text-sm font-medium mb-2">Desktop (1024px+)</h4>
        <div className="border border-gray-200 p-4">
          <RunningRevenue showBreakdown={true} className="text-lg" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'Shows how the component adapts to different screen sizes'
      }
    }
  }
};

/**
 * Animation demonstration
 */
export const WithAnimation: Story = {
  render: () => {
    const AnimatedRevenue = () => {
      const [isAnimating, setIsAnimating] = React.useState(false);

      const triggerAnimation = () => {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
      };

      return (
        <div className="space-y-4">
          <button
            onClick={triggerAnimation}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Trigger Update Animation
          </button>

          <div className={`running-revenue ${isAnimating ? 'updating' : ''}`}>
            <div className="revenue-content">
              <div className="revenue-label">💰 Revenue Today:</div>
              <div className="revenue-amount">$3,425</div>
            </div>
          </div>
        </div>
      );
    };

    return <AnimatedRevenue />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the update animation that plays when revenue changes'
      }
    }
  }
};
