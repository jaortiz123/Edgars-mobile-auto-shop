import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@test-utils'
import userEvent from '@testing-library/user-event'

// Mock router navigate to avoid real navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

// Spyable toast mock
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ success: toastSuccess, error: toastError, push: vi.fn() })
}))

// Mock service catalog search to ensure predictable search results
vi.mock('@/hooks/useServiceCatalogSearch', () => ({
  useServiceCatalogSearch: () => ({
    search: (term: string) => (term ? [ { id: 'op-1', name: 'Brake Pads', system: 'Safety', defaultHours: 2 } ] : []),
    all: [ { id: 'op-1', name: 'Brake Pads', system: 'Safety', defaultHours: 2 } ] as any,
  }),
}))

// We'll mock the bundle hook per-test for state coverage
const mockUseAppointmentBundle = vi.fn()
vi.mock('@/hooks/useAppointmentBundle', () => ({
  useAppointmentBundle: (...args: any[]) => mockUseAppointmentBundle(...args),
}))

// Mock core API minimal endpoints used by effects; override per test where needed
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>
  return {
    ...actual,
    handleApiError: (e: unknown, fallback?: string) => (e instanceof Error ? e.message : (fallback || 'Error')),
    getDrawer: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-300', status: 'SCHEDULED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: [],
    }),
    getAppointment: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-300', status: 'SCHEDULED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: [],
    }),
    getAppointmentServices: vi.fn().mockResolvedValue([]),
    createAppointmentService: vi.fn().mockResolvedValue({ ok: true }),
  }
})

import AppointmentDrawer from '@/components/admin/AppointmentDrawer'
import { AccessibilityProvider } from '@/contexts/AccessibilityProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as api from '@/lib/api'

function wrap(ui: React.ReactNode) {
  // Enable bundle paths by default
  ;(window as any).__APPT_DRAWER_BUNDLE__ = true
  const qc = new QueryClient()
  return (
    <QueryClientProvider client={qc}>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </QueryClientProvider>
  )
}

describe('AppointmentDrawer - state coverage (loading, error, success)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading overlay while bundle is loading', async () => {
    mockUseAppointmentBundle.mockReturnValue({ isLoading: true, data: undefined, refetch: vi.fn() })

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-300" />))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/loading appointment/i)
  })

  it('shows error banner when legacy drawer fetch fails', async () => {
    // Not loading
    mockUseAppointmentBundle.mockReturnValue({ isLoading: false, data: undefined, refetch: vi.fn() })
    // Force legacy drawer to fail, rich succeeds or not — banner should render
    vi.mocked(api.getDrawer).mockRejectedValueOnce(new Error('DB down'))

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-300" />))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/failed to load appointment/i)
  })

  it('renders success state with tabs and allows staging+removing a service (state toggles)', async () => {
    // Success bundle returns empty services; not loading
    mockUseAppointmentBundle.mockReturnValue({
      isLoading: false,
      data: {
        appointment: { id: 'apt-300', status: 'SCHEDULED' },
        services: [],
        customer: { id: 'c1', name: 'Jane' },
        vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      },
      refetch: vi.fn(),
    })

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-300" />))

    // Drawer visible with tabs
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const servicesTab = await screen.findByRole('tab', { name: /services/i })
    await userEvent.click(servicesTab)

    // Empty state search: stage one service from catalog
    const search = await screen.findByTestId('svc-catalog-search')
    await userEvent.type(search, 'brake')
    const results = await screen.findByTestId('svc-catalog-results')
    const first = within(results).getByTestId('catalog-result-op-1')
    await userEvent.click(first)

  // Wait for at least one service item to appear in the rendered list
  const firstItem = await screen.findByTestId(/service-item-/i)
  expect(firstItem).toBeInTheDocument()
  const list = await screen.findByTestId('services-list')
  expect(list.getAttribute('data-added-temp-count')).toBe('1')

    // Save button becomes enabled due to dirty working state
    const saveBtn = await screen.findByTestId('drawer-save')
    expect(saveBtn).toBeEnabled()

    // Remove staged service using the visible Remove button within staged item
    const stagedItem = within(await screen.findByTestId('services-list')).getAllByTestId(/service-item-/i)[0]
  const removeBtn = within(stagedItem).getByRole('button', { name: /(remove|delete)/i })
    await userEvent.click(removeBtn)

    // Save disabled again (no pending changes) and metadata back to zero
    await waitFor(async () => {
      const freshList = await screen.findByTestId('services-list')
      expect(freshList.getAttribute('data-added-temp-count')).toBe('0')
      expect(saveBtn).toBeDisabled()
    })
  })
})
