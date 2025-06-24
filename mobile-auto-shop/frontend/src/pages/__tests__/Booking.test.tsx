import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, test, expect } from 'vitest'
import Booking from '../Booking'
import { serviceAPI, customerAPI, appointmentAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  serviceAPI: { getAll: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Oil' }] }) },
  customerAPI: { create: vi.fn().mockResolvedValue({ data: { id: 1 } }) },
  appointmentAPI: { create: vi.fn().mockResolvedValue({ data: { id: 1 } }) },
}))

test('renders booking form', async () => {
  const client = new QueryClient()
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Booking />
      </QueryClientProvider>
    </MemoryRouter>
  )
  expect(await screen.findByText('Oil')).toBeInTheDocument()
})

test('allows selecting a service and showing form', async () => {
  const client = new QueryClient()
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Booking />
      </QueryClientProvider>
    </MemoryRouter>
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Oil' }))
  expect(screen.getByLabelText('Name')).toBeInTheDocument()
})
