/**
 * CI-STRICT-001 Robustness Edge Case Tests
 * Tests the enhanced error handling and edge case robustness
 */
import { describe, it, expect } from 'vitest'

describe('CI-STRICT-001 Robustness Edge Cases', () => {
  
  it('should handle circular object references safely', () => {
    const circular: Record<string, unknown> = { name: 'test' }
    circular.self = circular
    
    expect(() => {
      console.error('Circular object:', circular)
    }).toThrow(/console\.error:.*Circular Reference/)
  })

  it('should handle objects with throwing toString methods', () => {
    const problematic = {
      toString() {
        throw new Error('toString failed')
      }
    }
    
    expect(() => {
      console.error('Problematic object:', problematic)
    }).toThrow(/console\.error:/)
  })

  it('should handle null and undefined arguments', () => {
    expect(() => {
      console.error(null, undefined, '')
    }).toThrow('console.error: null undefined ')
  })

  it('should handle complex nested objects', () => {
    const complex = {
      level1: {
        level2: {
          level3: {
            data: [1, 2, 3],
            func: () => 'test'
          }
        }
      }
    }
    
    expect(() => {
      console.error('Complex object:', complex)
    }).toThrow(/console\.error:.*Complex object:/)
  })

  it('should handle no arguments gracefully', () => {
    expect(() => {
      console.error()
    }).toThrow('console.error: ')
  })

  it('should handle very large objects safely', () => {
    const largeObject = {
      data: new Array(1000).fill('x'.repeat(100)).map((val, idx) => ({ id: idx, value: val }))
    }
    
    expect(() => {
      console.error(largeObject)
    }).toThrow(/console\.error:/)
  })

  it('should preserve error context and stack traces', () => {
    try {
      console.error('Test error for stack trace')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('console.error: Test error for stack trace')
      expect(error.stack).toContain('console.error')
    }
  })

  it('should handle mixed argument types', () => {
    const mixed = [
      'string',
      123,
      true,
      null,
      undefined,
      { obj: 'value' },
      [1, 2, 3],
      () => 'function'
    ]
    
    expect(() => {
      console.error('Mixed types:', ...mixed)
    }).toThrow(/console\.error:.*Mixed types:/)
  })

  it('should handle special characters and unicode', () => {
    const special = '🚀 Special chars: "quotes" \'apostrophes\' \\backslashes\\ \n\t\r'
    
    expect(() => {
      console.error(special)
    }).toThrow(`console.error: ${special}`)
  })

  it('should handle async context (preserves functionality)', async () => {
    const asyncTest = async () => {
      await new Promise(resolve => setTimeout(resolve, 1))
      console.error('Async error')
    }
    
    await expect(asyncTest()).rejects.toThrow('console.error: Async error')
  })
})
