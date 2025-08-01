/**
 * CI-STRICT-001 Basic Robustness Test
 */
import { describe, it, expect } from 'vitest'

describe('CI-STRICT-001 Basic Robustness', () => {
  it('should work with basic console.error', () => {
    expect(() => {
      console.error('test')
    }).toThrow('console.error: test')
  })
})
