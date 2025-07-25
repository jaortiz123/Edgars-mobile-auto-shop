import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import Button from '../Button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  const btn = screen.getByRole('button', { name: 'Click me' });
  expect(btn).toBeDefined();
});
