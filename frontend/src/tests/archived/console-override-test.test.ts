import { describe, test, expect } from 'vitest'

describe('Console Override Test', () => {
  test('should pass with normal console.log', () => {
    // console.log should work fine (not overridden)
    console.log('This is a normal log message')
    expect(true).toBe(true)
  })

  test('should throw error when console.error is called', () => {
    // This should throw because our setup overrides console.error
    expect(() => {
      console.error('This should cause test failure')
    }).toThrow('console.error: This should cause test failure')
  })

  test('should throw error when console.warn is called', () => {
    // This should throw because our setup overrides console.warn
    expect(() => {
      console.warn('This should cause test failure')
    }).toThrow('console.warn: This should cause test failure')
  })
})
