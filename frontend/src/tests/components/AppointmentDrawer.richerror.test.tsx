import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@test-utils'

// Mock router navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

// Minimal toast mock
vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ success: vi.fn(), error: vi.fn(), push: vi.fn() })
}))

// Do not mock the bundle hook; let drawer fetch run
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>
  return {
    ...actual,
    handleApiError: (e: unknown, fallback?: string) => (e instanceof Error ? e.message : (fallback || 'Error')),
    getDrawer: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-re-1', status: 'SCHEDULED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: [],
    }),
    getAppointment: vi.fn().mockRejectedValue(new Error('rich fetch failed')),
    getAppointmentServices: vi.fn().mockResolvedValue([]),
  }
})

import AppointmentDrawer from '@/components/admin/AppointmentDrawer'
import { AccessibilityProvider } from '@/contexts/AccessibilityProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function wrap(ui: React.ReactNode) {
  ;(window as any).__APPT_DRAWER_BUNDLE__ = true
  const qc = new QueryClient()
  return (
    <QueryClientProvider client={qc}>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </QueryClientProvider>
  )
}

describe('AppointmentDrawer - rich fetch error banner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders error banner when rich fetch fails but legacy drawer succeeds', async () => {
    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-re-1" />))

    // Drawer is open
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    // Error banner shows the rich error message (generic text)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/failed to load appointment/i)
  })
})
