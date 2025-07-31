import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import ServiceList from '../ServiceList'
import type { Service } from '../../types/models'

test('renders a list of services', () => {
  const services: Service[] = [
    { id: 1, name: 'Oil Change', description: 'Regular oil change service' },
    { id: 2, name: 'Brake Repair', description: 'Brake system repair' },
  ];
  render(<ServiceList services={services} />);
  expect(screen.getByText('Oil Change')).toBeInTheDocument();
  expect(screen.getByText('Brake Repair')).toBeInTheDocument();
});