import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the board data hook to avoid real network/query behavior
const refetchSpy = vi.fn()
vi.mock('@/hooks/useBoardData', () => ({
  useBoard: () => ({ boardQuery: { refetch: refetchSpy } }),
}))

// Provide a lightweight Zustand store mock: selector(state) -> returns from our mock state
vi.mock('@/state/useBoardStore', () => {
  const state = {
    columns: [
      { key: 'SCHEDULED', title: 'Scheduled' },
      { key: 'IN_PROGRESS', title: 'In Progress' },
      { key: 'READY', title: 'Ready' },
      { key: 'COMPLETED', title: 'Completed' },
    ],
    loading: false,
    error: null as string | null,
    cardIds: ['apt-1', 'apt-2'],
    cardsById: {
      'apt-1': {
        id: 'apt-1',
        status: 'SCHEDULED',
        position: 1,
        servicesSummary: 'Oil Change',
        customerName: 'Alice',
      },
      'apt-2': {
        id: 'apt-2',
        status: 'IN_PROGRESS',
        position: 1,
        servicesSummary: 'Brake Inspection',
        customerName: 'Bob',
      },
    } as any,
    setError: vi.fn(),
    moveAppointment: vi.fn(),
  }
  return {
    useBoardStore: (selector: (s: any) => any) => selector(state),
  }
})

// Mock toast hook so calling toast.* is harmless
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

// Import under test after mocks
import StatusBoard from '@/components/admin/StatusBoard'

describe('StatusBoard (simplified rendering)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    refetchSpy.mockReset()
    // Force URL flags to simplify board (no DnD, modal, filters) and show hero controls
    Object.defineProperty(window, 'location', {
      value: { search: '?sb_simplecols=1&sb_nomodal=1&sb_nofilter=1&sb_nodnd=1&sb_notost=1' },
      writable: true,
    })
  })

  it('renders columns and cards in simplified mode and shows Filters/Customize controls', async () => {
    render(<StatusBoard onOpen={() => { /* noop */ }} minimalHero />)

    // Region wrapper exists
    const region = await screen.findByRole('region', { name: /status board/i })
    expect(region).toBeInTheDocument()

    // Simplified columns present with counts and card elements with data attributes
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    // Cards are rendered with data-testid attributes
    expect(screen.getByTestId('apt-card-apt-1')).toHaveTextContent('Oil Change')
    expect(screen.getByTestId('apt-card-apt-2')).toHaveTextContent('Brake Inspection')

  // Hero controls present: Filters and Customize (no Refresh button in simplified hero)
  const filters = screen.getByRole('button', { name: /filters/i })
  expect(filters).toBeInTheDocument()
  const customize = screen.getByRole('button', { name: /customize/i })
  expect(customize).toBeInTheDocument()
  })
})
