import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, test, expect } from 'vitest'
import Booking from '../Booking'
import { serviceAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  serviceAPI: { getAll: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Oil' }] }) }
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
