import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import ServiceCard from '../ServiceCard'
import type { Service } from '../../types/models'

test('shows service name and description', () => {
  const service: Service = {
    id: 1,
    name: 'Oil Change',
    description: 'Synthetic',
  }
  const mockOnSelect = () => {}
  render(<ServiceCard service={service} onSelect={mockOnSelect} />)
  expect(screen.getByText('Oil Change')).toBeInTheDocument()
  expect(screen.getByText('Synthetic')).toBeInTheDocument()
})
