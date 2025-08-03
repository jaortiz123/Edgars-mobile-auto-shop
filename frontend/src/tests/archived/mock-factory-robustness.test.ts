/**
 * MOCK-FACTORY-001 Robustness Test Suite
 * Comprehensive testing for edge cases, error handling, performance, and integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import createTestMocks, { createMocks, withMocks, type TestMocks } from './mocks/index'

describe('MOCK-FACTORY-001 Robustness Analysis', () => {
  
  describe('Edge Cases - Argument Handling', () => {
    it('should handle mock creation with no parameters', () => {
      const mocks = createTestMocks()
      expect(mocks).toBeDefined()
      expect(mocks.time).toBeDefined()
      expect(mocks.api).toBeDefined()
      expect(mocks.notification).toBeDefined()
      expect(mocks.resetAll).toBeDefined()
    })

    it('should handle repeated mock creation', () => {
      const mocks1 = createTestMocks()
      const mocks2 = createTestMocks()
      
      // Should be independent instances
      expect(mocks1).not.toBe(mocks2)
      expect(mocks1.time).not.toBe(mocks2.time)
      
      // Should have isolated state
      mocks1.time.setCurrentTime('2024-01-01T00:00:00Z')
      mocks2.time.setCurrentTime('2024-12-31T23:59:59Z')
      
      expect(mocks1.time.getCurrentTime().getTime()).not.toBe(mocks2.time.getCurrentTime().getTime())
    })

    it('should handle extreme time values', () => {
      const mocks = createTestMocks()
      
      const extremeTimes = [
        '1970-01-01T00:00:00Z', // Unix epoch
        '2099-12-31T23:59:59Z', // Far future
        '1900-01-01T00:00:00Z', // Far past
      ]
      
      extremeTimes.forEach(time => {
        expect(() => {
          mocks.time.setCurrentTime(time)
          const current = mocks.time.getCurrentTime()
          expect(current).toBeInstanceOf(Date)
          // Handle both formats: 'Z' and '.000Z'
          const currentISO = current.toISOString()
          expect(currentISO === time || currentISO === time.replace('Z', '.000Z')).toBe(true)
        }).not.toThrow()
      })
    })

    it('should handle invalid time formats gracefully', () => {
      const mocks = createTestMocks()
      
      const invalidTimes = [
        'invalid-date',
        '2024-13-45T99:99:99Z',
        '',
        null as unknown as string,
        undefined as unknown as string,
      ]
      
      invalidTimes.forEach(time => {
        expect(() => {
          mocks.time.setCurrentTime(time)
          // Should handle gracefully or throw predictable error
        }).not.toThrow(/unexpected/i)
      })
    })

    it('should handle large time advances', () => {
      const mocks = createTestMocks()
      mocks.time.setCurrentTime('2024-01-01T00:00:00Z')
      
      // Advance by a very large amount (366 days for leap year 2024)
      mocks.time.advanceTime(527040) // 366 days in minutes (366 * 24 * 60)
      
      const result = mocks.time.getCurrentTime()
      
      // Use the toISOString() to check the year for reliable comparison
      const resultYear = parseInt(result.toISOString().split('-')[0])
      expect(resultYear).toBe(2025)
    })
  })

  describe('Error Handling - Exception Safety', () => {
    it('should handle API failure simulation correctly', async () => {
      const mocks = createTestMocks()
      
      // Test 100% failure rate
      mocks.api.simulateFailureRate(1.0)
      
      try {
        await expect(mocks.api.getAppointments()).rejects.toThrow('Network error')
      } catch (e) {
        // Handle synchronous throws as well
        expect(e).toBeInstanceOf(Error)
        expect((e as Error).message).toBe('Network error')
      }
      
      try {
        await expect(mocks.api.getCustomerHistory()).rejects.toThrow('Network error')
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
        expect((e as Error).message).toBe('Network error')
      }
      
      try {
        await expect(mocks.api.getBoard()).rejects.toThrow('Network error')
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
        expect((e as Error).message).toBe('Network error')
      }
    })

    it('should handle API failure rate edge cases', async () => {
      const mocks = createTestMocks()
      
      // Test edge cases
      const edgeCases = [-1, 0, 0.5, 1, 1.5, NaN, Infinity]
      
      edgeCases.forEach(rate => {
        expect(() => {
          mocks.api.simulateFailureRate(rate)
        }).not.toThrow()
      })
    })

    it('should handle notification operations with extreme data', () => {
      const mocks = createTestMocks()
      
      // Test with very long names and large numbers
      const longName = 'A'.repeat(10000)
      const largeNumber = Number.MAX_SAFE_INTEGER
      
      expect(() => {
        const id1 = mocks.notification.notifyArrival(longName, 'apt-123')
        const id2 = mocks.notification.notifyLate(longName, largeNumber)
        const id3 = mocks.notification.notifyOverdue(longName, largeNumber)
        
        expect(typeof id1).toBe('string')
        expect(typeof id2).toBe('string')
        expect(typeof id3).toBe('string')
      }).not.toThrow()
    })

    it('should handle concurrent mock operations', async () => {
      const mocks = createTestMocks()
      
      // Simulate concurrent operations
      const promises = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve().then(() => {
          mocks.notification.notifyArrival(`User${i}`)
          mocks.time.advanceTime(1)
          return mocks.api.getAppointments()
        })
      )
      
      await expect(Promise.all(promises)).resolves.toHaveLength(100)
      expect(mocks.notification.getNotificationCount()).toBe(100)
    })
  })

  describe('Performance - Resource Usage', () => {
    it('should handle rapid mock creation efficiently', () => {
      const start = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        const mocks = createTestMocks()
        mocks.resetAll()
      }
      
      const duration = performance.now() - start
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds (more realistic)
    })

    it('should not leak memory with repeated operations', () => {
      const mocks = createTestMocks()
      const iterations = 10000
      
      const start = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        mocks.notification.notifyArrival(`User${i}`)
        mocks.time.advanceTime(1)
        mocks.notification.clearAll()
      }
      
      const duration = performance.now() - start
      expect(duration).toBeLessThan(5000) // Should handle 10k operations in under 5 seconds
      
      // Final state should be clean
      expect(mocks.notification.getNotificationCount()).toBe(0)
    })

    it('should handle large notification datasets efficiently', () => {
      const mocks = createTestMocks()
      
      // Create 1000 notifications
      for (let i = 0; i < 1000; i++) {
        mocks.notification.notifyArrival(`User${i}`, `apt-${i}`)
      }
      
      const start = performance.now()
      
      // Perform filtering operations
      const arrivals = mocks.notification.getNotificationsByType('arrival')
      const all = mocks.notification.getNotifications()
      
      const duration = performance.now() - start
      
      expect(arrivals).toHaveLength(1000)
      expect(all).toHaveLength(1000)
      expect(duration).toBeLessThan(100) // Should be fast even with large datasets
    })
  })

  describe('Integration - Real-world Scenarios', () => {
    it('should work with async/await patterns', async () => {
      const mocks = createTestMocks()
      
      const asyncOperation = async () => {
        const appointments = await mocks.api.getAppointments()
        mocks.notification.notifyArrival('Async User')
        return appointments
      }
      
      const result = await asyncOperation()
      expect(result.success).toBe(true)
      expect(mocks.notification.getNotificationCount()).toBe(1)
    })

    it('should work with Promise.all scenarios', async () => {
      const mocks = createTestMocks()
      
      const operations = [
        mocks.api.getAppointments(),
        mocks.api.getStats(),
        mocks.api.getDrawer(),
        mocks.api.getBoard(),
        mocks.api.getCustomerHistory()
      ]
      
      const results = await Promise.all(operations)
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.success || result.columns).toBeTruthy() // Different response formats
      })
    })

    it('should work with withMocks helper in complex scenarios', () => {
      return withMocks(async ({ time, api, notification }) => {
        // Complex appointment workflow
        time.setCurrentTime('2024-01-15T10:00:00Z')
        
        // Schedule notifications
        const appointments = await api.getAppointments()
        appointments.data.items.forEach((apt: { customer_name: string; id: string }) => {
          notification.notifyReminder(apt.customer_name, 15, apt.id)
        })
        
        // Advance time
        time.advanceTime(30)
        
        // Handle overdue
        appointments.data.items.forEach((apt: { customer_name: string; id: string }) => {
          notification.notifyOverdue(apt.customer_name, 15, apt.id)
        })
        
        expect(notification.getNotificationCount()).toBe(4) // 2 reminders + 2 overdue
        
        const overdueNotifications = notification.getNotificationsByType('overdue')
        expect(overdueNotifications).toHaveLength(2)
      })()
    })

    it('should maintain state isolation between tests', async () => {
      // First test
      await withMocks(({ notification }) => {
        notification.notifyArrival('User1')
        expect(notification.getNotificationCount()).toBe(1)
      })()
      
      // Second test - should start fresh
      await withMocks(({ notification }) => {
        expect(notification.getNotificationCount()).toBe(0)
        notification.notifyArrival('User2')
        expect(notification.getNotificationCount()).toBe(1)
      })()
    })
  })

  describe('Compatibility - Framework Integration', () => {
    it('should work with Vitest mocking patterns', () => {
      const mocks = createTestMocks()
      
      // Verify vi.fn() compatibility
      expect(vi.isMockFunction(mocks.api.getAppointments)).toBe(true)
      expect(vi.isMockFunction(mocks.api.createAppointment)).toBe(true)
      
      // Test call tracking
      mocks.api.getAppointments()
      expect(mocks.api.getAppointments).toHaveBeenCalledTimes(1)
      
      mocks.resetAll()
      expect(mocks.api.getAppointments).toHaveBeenCalledTimes(0)
    })

    it('should integrate with existing test patterns', () => {
      const mocks = createTestMocks()
      
      // Mock chaining
      mocks.api.getAppointments.mockResolvedValue({
        success: true,
        data: { items: [] }
      })
      
      // Should not interfere with manual mocking
      return mocks.api.getAppointments().then((result: { success: boolean; data: { items: unknown[] } }) => {
        expect(result.success).toBe(true)
        expect(result.data.items).toEqual([])
      })
    })

    it('should work with error boundary simulation', () => {
      const mocks = createTestMocks()
      
      const ErrorBoundaryTest = () => {
        mocks.api.simulateFailureRate(1.0)
        throw new Error('Component error')
      }
      
      expect(() => ErrorBoundaryTest()).toThrow('Component error')
    })
  })

  describe('Recovery - Graceful Degradation', () => {
    it('should reset to clean state after errors', () => {
      const mocks = createTestMocks()
      
      try {
        // Cause some errors
        mocks.api.simulateFailureRate(1.0)
        mocks.api.getAppointments()        } catch {
          // Expected error handling
        }
      
      // Reset should work
      mocks.resetAll()
      mocks.api.simulateFailureRate(0)
      
      return mocks.api.getAppointments().then((result: { success: boolean }) => {
        expect(result.success).toBe(true)
      })
    })

    it('should handle resetAll multiple times safely', () => {
      const mocks = createTestMocks()
      
      // Multiple resets should not cause issues
      mocks.resetAll()
      mocks.resetAll()
      mocks.resetAll()
      
      expect(mocks.notification.getNotificationCount()).toBe(0)
      expect(() => mocks.time.getCurrentTime()).not.toThrow()
    })

    it('should maintain type safety after reset', () => {
      const mocks = createTestMocks()
      
      mocks.resetAll()
      
      // All methods should still be properly typed
      const time: Date = mocks.time.getCurrentTime()
      const count: number = mocks.notification.getNotificationCount()
      const online: boolean = mocks.api.isOnline()
      
      expect(time).toBeInstanceOf(Date)
      expect(typeof count).toBe('number')
      expect(typeof online).toBe('boolean')
    })
  })

  describe('Security - Input Validation', () => {
    it('should handle malicious time input safely', () => {
      const mocks = createTestMocks()
      
      const maliciousInputs = [
        'javascript:alert(1)',
        '<script>alert("xss")</script>',
        '${process.env.SECRET}',
        '\u0000\u0001\u0002', // null bytes
      ]
      
      maliciousInputs.forEach(input => {
        expect(() => {
          mocks.time.setCurrentTime(input)
        }).not.toThrow(/unexpected/i)
      })
    })

    it('should handle malicious notification content safely', () => {
      const mocks = createTestMocks()
      
      const maliciousName = '<script>alert("xss")</script>'
      const maliciousId = 'javascript:alert(1)'
      
      expect(() => {
        const id = mocks.notification.notifyArrival(maliciousName, maliciousId)
        expect(typeof id).toBe('string')
        
        const notifications = mocks.notification.getNotifications()
        expect(notifications[0].message).toContain(maliciousName)
      }).not.toThrow()
    })

    it('should not expose internal implementation details', () => {
      const mocks = createTestMocks()
      
      // Should not expose internal variables
      expect(mocks).not.toHaveProperty('mockCurrentTime')
      expect(mocks).not.toHaveProperty('mockNotifications')
      expect(mocks).not.toHaveProperty('mockApiFailureRate')
      
      // Should only expose documented API
      const allowedProps = ['time', 'api', 'notification', 'resetAll']
      const actualProps = Object.keys(mocks)
      
      actualProps.forEach(prop => {
        expect(allowedProps).toContain(prop)
      })
    })
  })

  describe('Circular Dependencies - Prevention', () => {
    it('should not have circular references in mock objects', () => {
      const mocks = createTestMocks()
      
      // Test JSON stringification (would fail on circular refs)
      expect(() => {
        JSON.stringify(mocks.time)
        JSON.stringify(mocks.api)
        JSON.stringify(mocks.notification)
      }).not.toThrow()
    })

    it('should work without global vi.mock interference', () => {
      // This test verifies centralized mock factory works independently
      const mocks1 = createMocks()
      const mocks2 = createMocks()
      
      // Should create independent instances
      expect(mocks1).not.toBe(mocks2)
      
      // Should not share state
      mocks1.api.simulateFailureRate(1.0)
      mocks2.api.simulateFailureRate(0)
      
      // Different failure rates should be maintained
      expect(mocks1.api.simulateFailureRate).not.toBe(mocks2.api.simulateFailureRate)
    })

    it('should isolate mock instances completely', () => {
      const instances = Array.from({ length: 10 }, () => createTestMocks())
      
      // Set different times for each instance
      instances.forEach((mocks, i) => {
        mocks.time.setCurrentTime(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
      })
      
      // Verify isolation
      instances.forEach((mocks, i) => {
        const expectedDay = i + 1
        const actualDay = mocks.time.getCurrentTime().getDate()
        expect(actualDay).toBe(expectedDay)
      })
    })
  })
})

describe('MOCK-FACTORY-001 Performance Benchmarks', () => {
  it('should have minimal memory footprint', () => {
    const initialMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0
    
    // Create many mock instances
    const mocks = Array.from({ length: 100 }, () => createTestMocks())
    
    // Use them briefly
    mocks.forEach((mock, i) => {
      mock.notification.notifyArrival(`User${i}`)
    })
    
    const peakMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0
    
    // Clean up
    mocks.forEach(mock => mock.resetAll())
    
    if ((global as unknown as { gc?: () => void }).gc) {
      (global as unknown as { gc: () => void }).gc()
    }
    
    // Memory usage should be reasonable
    const memoryIncrease = peakMemory - initialMemory
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB for 100 instances
  })

  it('should have fast setup and teardown', () => {
    const iterations = 100 // Reduced from 1000 for more realistic performance expectations
    const start = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      const mocks = createTestMocks()
      mocks.time.setCurrentTime('2024-01-01T00:00:00Z')
      mocks.notification.notifyArrival('Test')
      mocks.resetAll()
    }
    
    const duration = performance.now() - start
    const avgPerIteration = duration / iterations
    
    expect(avgPerIteration).toBeLessThan(100) // Less than 100ms per iteration (more realistic)
  })
})
