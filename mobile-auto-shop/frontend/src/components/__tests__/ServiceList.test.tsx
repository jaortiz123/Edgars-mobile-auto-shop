import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import ServiceList from '../ServiceList'
import type { Service } from '../../services/api'

test('renders a list of services', () => {
  const services: Service[] = [
    { id: 1, name: 'Oil Change' },
    { id: 2, name: 'Brake Repair' },
  ]
  render(<ServiceList services={services} />)
  expect(screen.getByText('Oil Change')).toBeInTheDocument()
  expect(screen.getByText('Brake Repair')).toBeInTheDocument()
})
