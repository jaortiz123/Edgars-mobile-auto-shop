import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import ServiceCard from '../ServiceCard'
import type { Service } from '../../services/api'

test('shows service name and description', () => {
  const service: Service = {
    id: 1,
    name: 'Oil Change',
    description: 'Synthetic',
  }
  render(<ServiceCard service={service} />)
  expect(screen.getByText('Oil Change')).toBeInTheDocument()
  expect(screen.getByText('Synthetic')).toBeInTheDocument()
})
