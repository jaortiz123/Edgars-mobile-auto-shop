import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@test-utils'
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

// Mock service catalog search to provide deterministic results
vi.mock('@/hooks/useServiceCatalogSearch', () => ({
  useServiceCatalogSearch: () => ({
    // Return one hit when any non-empty term is provided
    search: (term: string) => term ? [
      { id: 'op-1', name: 'Brake Pads', system: 'Safety', defaultHours: 2, defaultLaborHours: undefined }
    ] : [],
    all: [
      { id: 'op-1', name: 'Brake Pads', system: 'Safety', defaultHours: 2 }
    ] as any,
  }),
}))

// Note: we do NOT mock useAppointmentBundle. We enable the feature flag and let
// the hook call our mocked api.getDrawer/getAppointmentServices via TanStack Query.

// Mock core API functions used by save/reschedule flows
vi.mock('@/lib/api', async () => {
  const actual = (await vi.importActual('@/lib/api')) as Record<string, unknown>
  const apiMocks = {
    ...actual,
    handleApiError: (e: unknown, fallback?: string) => (e instanceof Error ? e.message : (fallback || 'Error')),
    getDrawer: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-201', status: 'SCHEDULED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: [],
    }),
    getAppointment: vi.fn().mockResolvedValue({
      appointment: { id: 'apt-201', status: 'SCHEDULED' },
      customer: { id: 'c1', name: 'Jane' },
      vehicle: { id: 'v1', year: 2020, make: 'Honda', model: 'Civic', vin: '' },
      services: [],
    }),
    getAppointmentServices: vi.fn().mockResolvedValue([]),
    createAppointmentService: vi.fn().mockResolvedValue({ service: { id: 'svc-new', estimated_price: 240 }, appointment_total: 240 }),
    updateAppointmentService: vi.fn().mockResolvedValue({ ok: true }),
    deleteAppointmentService: vi.fn().mockResolvedValue({ ok: true }),
    rescheduleAppointment: vi.fn().mockResolvedValue({ ok: true }),
    patchAppointment: vi.fn().mockResolvedValue({ ok: true }),
  }
  return apiMocks
})

import AppointmentDrawer from '@/components/admin/AppointmentDrawer'
import { AccessibilityProvider } from '@/contexts/AccessibilityProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as api from '@/lib/api'
// We purposely avoid importing/mocking the bundle hook

function wrap(ui: React.ReactNode) {
  // Enable bundle code paths
  ;(window as any).__APPT_DRAWER_BUNDLE__ = true
  const qc = new QueryClient()
  return (
    <QueryClientProvider client={qc}>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </QueryClientProvider>
  )
}

describe('AppointmentDrawer - Services and Reschedule flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stages a catalog service and saves it (create path)', async () => {
    // For create flow, first bundle fetch returns no services, after save/refetch it returns one
    vi.mocked(api.getAppointmentServices)
      .mockResolvedValueOnce([]) // initial bundle
      .mockResolvedValueOnce([ { id: 'svc-created-1', name: 'Brake Pads', estimated_price: 240, estimated_hours: 2 } ] as any) // after save

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-201" />))

    // Switch to Services tab
    const servicesTab = await screen.findByRole('tab', { name: /services/i })
    await userEvent.click(servicesTab)

    // Empty state with catalog search should appear
    const search = await screen.findByTestId('svc-catalog-search')
    await userEvent.type(search, 'brake')

    const results = await screen.findByTestId('svc-catalog-results')
    const item = within(results).getByTestId('catalog-result-op-1')
    await userEvent.click(item)

    // One staged service should now exist in the hidden metadata on list
    const list = await screen.findByTestId('services-list')
    expect(list.getAttribute('data-added-temp-count')).toBe('1')

  // Save should call createAppointmentService and show success toast
    const saveBtn = await screen.findByTestId('drawer-save')
    expect(saveBtn).toBeEnabled()
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.createAppointmentService).toHaveBeenCalledTimes(1)
      expect(toastSuccess).toHaveBeenCalled()
    })

    // Button becomes disabled after refetch (no pending changes)
    await waitFor(() => expect(saveBtn).toBeDisabled())
  })

  it('edits an existing service and saves (update path)', async () => {
    // Initial bundle has one persisted service, and refetch returns it again
    vi.mocked(api.getAppointmentServices)
      .mockResolvedValueOnce([ { id: 'svc-9', name: 'Oil Change', estimated_price: 100, estimated_hours: 1 } ] as any)
      .mockResolvedValueOnce([ { id: 'svc-9', name: 'Oil Change', estimated_price: 150, estimated_hours: 1 } ] as any)

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-201" />))

    const servicesTab = await screen.findByRole('tab', { name: /services/i })
    await userEvent.click(servicesTab)

    // Toggle edit and change price to 150
    const editBtn = await screen.findByTestId('edit-service-svc-9')
    await userEvent.click(editBtn)

    const priceCell = await screen.findByTestId('service-price-svc-9')
    const priceInput = within(priceCell).getByLabelText('Price') as HTMLInputElement
    await userEvent.clear(priceInput)
    await userEvent.type(priceInput, '150')

    // Save -> should call updateAppointmentService
    const saveBtn = await screen.findByTestId('drawer-save')
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.updateAppointmentService).toHaveBeenCalledWith('apt-201', 'svc-9', expect.objectContaining({ estimated_price: 150 }))
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('marks a service for deletion and saves (delete path)', async () => {
    vi.mocked(api.getAppointmentServices)
      .mockResolvedValueOnce([ { id: 'svc-8', name: 'Rotate Tires', estimated_price: 60, estimated_hours: 0.5 } ] as any)
      .mockResolvedValueOnce([] as any)

    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-201" />))

    const servicesTab = await screen.findByRole('tab', { name: /services/i })
    await userEvent.click(servicesTab)

    const delBtn = await screen.findByTestId('delete-service-svc-8')
    await userEvent.click(delBtn)

    const saveBtn = await screen.findByTestId('drawer-save')
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.deleteAppointmentService).toHaveBeenCalledWith('apt-201', 'svc-8')
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('reschedules an appointment via modal', async () => {
    render(wrap(<AppointmentDrawer open onClose={() => {}} id="apt-201" />))

    const reschedBtn = await screen.findByRole('button', { name: /reschedule/i })
    await userEvent.click(reschedBtn)

    const input = await screen.findByLabelText(/new date and time/i)
    await userEvent.clear(input)
    await userEvent.type(input, '2025-09-08T10:00')

    const save = await screen.findByRole('button', { name: /^save$/i })
    await userEvent.click(save)

    await waitFor(() => expect(api.rescheduleAppointment).toHaveBeenCalledTimes(1))
  })
})
