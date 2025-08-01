/**
 * CI-STRICT-001 Console Strict Mode Test
 * Tests that console.error and console.warn throw errors in test environment
 */
import { describe, it, expect } from 'vitest'

describe('CI-STRICT-001: Console Strict Mode', () => {
  it('should throw when console.error is called', () => {
    expect(() => {
      console.error('This should throw an error')
    }).toThrow('console.error: This should throw an error')
  })

  it('should throw when console.warn is called', () => {
    expect(() => {
      console.warn('This should throw an error')
    }).toThrow('console.warn: This should throw an error')
  })

  it('should allow console.log to work normally', () => {
    expect(() => {
      console.log('This should not throw')
    }).not.toThrow()
  })

  it('should handle multiple arguments in console.error', () => {
    expect(() => {
      console.error('Multiple', 'arguments', 'test')
    }).toThrow('console.error: Multiple arguments test')
  })

  it('should handle multiple arguments in console.warn', () => {
    expect(() => {
      console.warn('Warning', 'with', 'multiple', 'args')
    }).toThrow('console.warn: Warning with multiple args')
  })
})

// Temporary test to demonstrate failure (remove after verification)
describe('CI-STRICT-001: Demonstration Test (REMOVE AFTER VERIFICATION)', () => {
  it('should fail CI when console.warn is called (TEMPORARY)', () => {
    // This test will fail CI to demonstrate the functionality
    // Remove this test after verifying CI-STRICT-001 works
    console.warn('test') // This should fail the test and CI
  })
})
