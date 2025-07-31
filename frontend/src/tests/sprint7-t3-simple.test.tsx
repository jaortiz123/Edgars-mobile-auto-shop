/**
 * Sprint 7 T3 Simple Configuration Test
 * Basic validation that enhanced test environment works
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Test basic path alias resolution
import { getMinutesUntil } from '@/utils/time'

describe('Sprint 7 T3: Vitest Configuration', () => {
  it('resolves path aliases correctly', () => {
    expect(typeof getMinutesUntil).toBe('function')
  })

  it('supports React component testing', () => {
    const TestComponent = () => <div data-testid="test">Sprint 7 works!</div>
    render(<TestComponent />)
    
    expect(screen.getByTestId('test')).toBeInTheDocument()
  })

  it('provides jsdom environment', () => {
    expect(window).toBeDefined()
    expect(document).toBeDefined()
    expect(window.matchMedia).toBeDefined()
  })
})
