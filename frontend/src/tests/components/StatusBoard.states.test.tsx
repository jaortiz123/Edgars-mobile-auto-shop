import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Spy for refetch behavior
const refetchSpy = vi.fn()

// Mock board data hook to provide refetch
vi.mock('@/hooks/useBoardData', () => ({
  useBoard: () => ({ boardQuery: { refetch: refetchSpy } }),
}))

// Mock toast hook
const toastError = vi.fn()
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: toastError }) }))

// Zustand board store mock with mutable state per test
type AnyState = Record<string, any>
const baseState: AnyState = {
  columns: [
    { key: 'SCHEDULED', title: 'Scheduled' },
    { key: 'IN_PROGRESS', title: 'In Progress' },
  ],
  loading: false,
  error: null as string | null,
  cardIds: [] as string[],
  cardsById: {} as Record<string, any>,
  setError: vi.fn(),
  moveAppointment: vi.fn(),
}

let mockState: AnyState = { ...baseState }
export const setMockBoardState = (partial: Partial<AnyState>) => {
  mockState = { ...baseState, ...partial }
}

vi.mock('@/state/useBoardStore', () => ({
  useBoardStore: (selector: (s: AnyState) => any) => selector(mockState),
}))

// Import unit under test after mocks
import StatusBoard from '@/components/admin/StatusBoard'

describe('StatusBoard - core states', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    refetchSpy.mockReset()
    toastError.mockReset()
    ;(baseState.setError as any).mockReset?.()
    // Default URL: disable modal to avoid CardPreferencesProvider dependency
    Object.defineProperty(window, 'location', {
      value: { search: '?sb_nomodal=1' },
      writable: true,
    })
  })

  it('renders error banner when store error present and Retry triggers refetch', async () => {
    setMockBoardState({
      error: 'Boom',
      loading: false,
      columns: baseState.columns,
      cardIds: [],
      cardsById: {},
      setError: baseState.setError,
    })

    render(<StatusBoard onOpen={() => { /* noop */ }} />)

    // Banner content
    const banner = await screen.findByText(/Failed to load board/i)
    expect(banner).toBeInTheDocument()
    expect(screen.getByText('Boom')).toBeInTheDocument()

    // Clicking Retry calls refetch
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetchSpy).toHaveBeenCalledTimes(1)

    // Toast surfaced and error cleared by effect
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
      expect(baseState.setError).toHaveBeenCalledWith(null)
    })
  })

  it('MINIMAL flag short-circuits to stub grid', async () => {
    // Enable minimal mode via query flag
    Object.defineProperty(window, 'location', {
      value: { search: '?sb_min=1' },
      writable: true,
    })

    setMockBoardState({ error: null, loading: false, columns: [], cardIds: [], cardsById: {} })

  render(<StatusBoard onOpen={() => { /* noop */ }} />)

  // In minimal mode, the returned structure is a stub grid without lazy children
  // Assert by presence of data-minimal-board and recognizable content
  const grid = document.querySelector('[data-minimal-board]') as HTMLElement | null
  expect(grid).toBeTruthy()
    expect(screen.getByText(/Minimal/i)).toBeInTheDocument()
  // The wrapper board grid exists in DOM
  expect(grid).toBeInTheDocument()
  })

  it('shows skeleton when loading and no cards, and marks data-ready when cards exist', async () => {
    // Force simplified rendering to avoid heavy card component/provider deps
    Object.defineProperty(window, 'location', {
      value: { search: '?sb_nodnd=1&sb_simplecols=1&sb_simplecards=1&sb_nomodal=1' },
      writable: true,
    })
    // Skeleton state: loading + no cards
    setMockBoardState({ error: null, loading: true, columns: baseState.columns, cardIds: [], cardsById: {} })
  const { container, rerender } = render(<StatusBoard onOpen={() => { /* noop */ }} />)

    const region = await screen.findByRole('region', { name: /status board/i })
    // No data-ready attribute when skeleton
    expect(region).not.toHaveAttribute('data-board-ready')
    // Skeleton placeholders present (5 columns worth)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)

  // Data-ready state: not loading + has cards (simplified rendering path)
    setMockBoardState({
      error: null,
      loading: false,
      columns: baseState.columns,
      cardIds: ['apt-1'],
      cardsById: {
        'apt-1': {
          id: 'apt-1',
          status: 'SCHEDULED',
          position: 1,
          servicesSummary: 'Oil',
          customerName: 'Alice',
        },
      },
    })
  rerender(<StatusBoard onOpen={() => { /* noop */ }} />)

    // Wrapper should now be marked ready and expose first card id
    const readyRegion = await screen.findByRole('region', { name: /status board/i })
    expect(readyRegion).toHaveAttribute('data-board-ready', '1')
    expect(readyRegion).toHaveAttribute('data-first-apt-id', 'apt-1')
  })
})
