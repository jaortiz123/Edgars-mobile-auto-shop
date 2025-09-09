import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock router navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

// Mock api lib minimal endpoints used by drawer bundle
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>
  return {
    ...actual,
    getDrawer: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-9', status: 'COMPLETED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: []
    }),
    getAppointmentServices: vi.fn().mockResolvedValue([]),
    getAppointment: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-9', status: 'COMPLETED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: []
    }),
  }
})

// Mock invoice API
vi.mock('@/services/apiService', () => ({
  generateInvoice: vi.fn(),
}))
// Spyable toast mock (define before importing component)
const toastError = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ success: vi.fn(), error: toastError, push: vi.fn() })
}))

import AppointmentDrawer from '@/components/admin/AppointmentDrawer'
import { AccessibilityProvider } from '@/contexts/AccessibilityProvider'
import { generateInvoice } from '@/services/apiService'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function wrap(ui: React.ReactNode) {
  // Ensure bundle query is enabled
  ;(window as any).__APPT_DRAWER_BUNDLE__ = true
  const qc = new QueryClient()
  return (
    <QueryClientProvider client={qc}>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </QueryClientProvider>
  )
}

describe('AppointmentDrawer invoice generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // default success payload
    vi.mocked(generateInvoice).mockResolvedValue({ invoice: { id: 'inv-1', status: 'DRAFT', total_cents: 0, amount_due_cents: 0, amount_paid_cents: 0, subtotal_cents: 0, tax_cents: 0 } })
  })

  it('shows Generate Invoice button for COMPLETED appointment and calls API on click', async () => {
    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-9" />))

    // Drawer visible
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Button should be visible because status is COMPLETED and no invoice id
    const btn = await screen.findByTestId('generate-invoice-btn')
    expect(btn).toBeEnabled()

    await userEvent.click(btn)

    await waitFor(() => expect(generateInvoice).toHaveBeenCalledWith('apt-9'))
  })

  it('handles failure by re-enabling button (no crash)', async () => {
    vi.mocked(generateInvoice).mockRejectedValueOnce(new Error('Failed to create invoice'))

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-9" />))

    const btn = await screen.findByTestId('generate-invoice-btn')
    await userEvent.click(btn)

  // Button becomes enabled again after failure
  await waitFor(() => expect(btn).toBeEnabled())
  })
})
