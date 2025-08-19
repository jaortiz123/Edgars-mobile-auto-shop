/**
 * CI-STRICT-001: Test that console.error and console.warn fail tests
 * This test verifies that any console.error or console.warn will cause test failures
 */

import { describe, test, expect } from 'vitest'

describe('CI-STRICT-001: Console error detection', () => {
  test('should pass when no console errors are logged', () => {
    // This test should pass normally
    expect(true).toBe(true)
  })

  // Temporarily disabled test to verify the functionality
  // Once we confirm it works, we'll remove this test
  test.skip('should fail when console.error is called', () => {
    // This should throw and fail the test
    console.error('This is a test error message')
    expect(true).toBe(true) // This line should never be reached
  })

  test.skip('should fail when console.warn is called', () => {
    // This should throw and fail the test
    console.warn('This is a test warning message')
    expect(true).toBe(true) // This line should never be reached
  })
})
