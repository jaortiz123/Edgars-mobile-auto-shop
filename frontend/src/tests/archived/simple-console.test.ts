import { describe, test, expect } from 'vitest'

describe('Simple console test', () => {
  test('should pass normally', () => {
    expect(1 + 1).toBe(2)
  })

  test('console test', () => {
    // Let's test if console.log works (it should)
    console.log('This should work fine')
    expect(true).toBe(true)
  })
})
