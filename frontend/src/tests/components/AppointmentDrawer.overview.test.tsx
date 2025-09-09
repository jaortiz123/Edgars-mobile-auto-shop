import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock router navigate
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

// Mock technicians hook so we can assign one
vi.mock('@/hooks/useTechnicians', () => ({
  useTechnicians: () => ({ data: [{ id: 't1', initials: 'AB', name: 'Alice Brown' }], isLoading: false })
}))

// Mock api lib used by drawer
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>
  return {
    ...actual,
    handleApiError: (e: unknown, fallback?: string) => (e instanceof Error ? e.message : (fallback || 'Error')),
    getDrawer: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-ov-1', status: 'SCHEDULED', start: '2025-01-01T10:00:00.000Z', end: '2025-01-01T11:00:00.000Z', tech_id: null },
      customer: { id: 'c-ov-1', name: 'Jane' },
      vehicle: { id: 'v-ov-1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: [],
    }),
  // Force Overview fallback (rich edit form disabled in these tests)
  getAppointment: vi.fn().mockRejectedValue(new Error('rich disabled for overview tests')),
    getAppointmentServices: vi.fn().mockResolvedValue([]),
    patchAppointment: vi.fn().mockResolvedValue({ ok: true }),
    rescheduleAppointment: vi.fn().mockResolvedValue({ ok: true }),
  }
})

import AppointmentDrawer from '@/components/admin/AppointmentDrawer'
import { AccessibilityProvider } from '@/contexts/AccessibilityProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as api from '@/lib/api'

function wrap(ui: React.ReactNode) {
  ;(window as any).__APPT_DRAWER_BUNDLE__ = true
  const qc = new QueryClient()
  return (
    <QueryClientProvider client={qc}>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </QueryClientProvider>
  )
}

describe('AppointmentDrawer - Overview interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves vehicle details with uppercased plate', async () => {
    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-ov-1" />))

    // Plate input -> uppercase should be applied on change
    const plate = await screen.findByLabelText('Plate')
    await userEvent.clear(plate)
    await userEvent.type(plate, 'abc123')

    // Model select is within the vehicle block; find the nearest container and the Save button inside it
    const modelSelect = await screen.findByLabelText('Model')
    const vehicleBlock = modelSelect.closest('div')!.parentElement as HTMLElement // div.col-span-1 flex gap-2 -> parent is grid area
    const saveBtn = within(vehicleBlock).getByRole('button', { name: /^save$/i })
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.patchAppointment).toHaveBeenCalledWith('apt-ov-1', expect.objectContaining({ license_plate: 'ABC123' }))
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('saves meta details (address and notes)', async () => {
    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-ov-1" />))

    const addr = await screen.findByLabelText(/service address/i)
    await userEvent.clear(addr)
    await userEvent.type(addr, '123 Elm St')

    const notes = await screen.findByLabelText(/notes/i)
    await userEvent.clear(notes)
    await userEvent.type(notes, 'Please handle with care')

    // Click the first "Save" next to address field
    const metaRow = addr.closest('div')!.parentElement as HTMLElement
    const saveBtn = within(metaRow).getByRole('button', { name: /^save$/i })
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.patchAppointment).toHaveBeenCalledWith('apt-ov-1', expect.objectContaining({ location_address: '123 Elm St', notes: 'Please handle with care' }))
      expect(toastSuccess).toHaveBeenCalledWith('Details saved')
    })
  })

  it('assigns a technician and shows toast', async () => {
    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-ov-1" />))

    const techSelect = await screen.findByLabelText('Technician')
    await userEvent.selectOptions(techSelect, 't1')

    await waitFor(() => {
      expect(api.patchAppointment).toHaveBeenCalledWith('apt-ov-1', { tech_id: 't1' })
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('shows error toast when reschedule fails and re-enables Save', async () => {
    vi.mocked(api.rescheduleAppointment).mockRejectedValueOnce(new Error('Nope'))

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-ov-1" />))

    const reschedBtn = await screen.findByRole('button', { name: /reschedule/i })
    await userEvent.click(reschedBtn)

    const input = await screen.findByLabelText(/new date and time/i)
    await userEvent.clear(input)
    await userEvent.type(input, '2025-09-08T10:00')

  // Scope to the reschedule modal to avoid matching the Overview "Save" buttons
  const modalHeading = await screen.findByRole('heading', { name: /reschedule appointment/i })
  const modalContainer = modalHeading.closest('div') as HTMLElement
  const save = within(modalContainer).getByRole('button', { name: /^save$/i })
    await userEvent.click(save)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
      expect(save).toBeEnabled()
    })
  })
})
