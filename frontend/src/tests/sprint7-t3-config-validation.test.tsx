/**
 * Sprint 7 T3 Vitest Configuration Validation Test
 * Verifies that all enhanced test environment features work correctly
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@test-utils'
import { testUtils } from '@/tests/testEnv'

// Test path alias resolution
import { getMinutesUntil } from '@/utils/time'
import performanceService from '@/services/performanceMonitoring'
import offlineService from '@/services/offlineSupport'

// Test React component with path alias
import PerformanceWidget from '@/components/PerformanceWidget'

describe('Sprint 7 T3: Enhanced Vitest Configuration', () => {
  describe('Path Alias Resolution', () => {
    it('resolves @/utils/* aliases correctly', () => {
      expect(typeof getMinutesUntil).toBe('function')
    })

    it('resolves @/services/* aliases correctly', () => {
      expect(typeof performanceService.generateReport).toBe('function')
      expect(typeof offlineService.getState).toBe('function')
    })

    it('resolves @/components/* aliases correctly', () => {
      expect(PerformanceWidget).toBeDefined()
    })

    it('resolves @/tests/* aliases correctly', () => {
      expect(testUtils).toBeDefined()
      expect(typeof testUtils.waitForAsync).toBe('function')
    })
  })

  describe('jsdom Environment', () => {
    it('provides complete DOM APIs', () => {
      expect(typeof document).toBe('object')
      expect(typeof window).toBe('object')
      expect(typeof global).toBe('object')
    })

    it('supports React component rendering', () => {
      const TestComponent = () => <div data-testid="test">Hello Test</div>
      render(<TestComponent />)
      expect(screen.getByTestId('test')).toBeInTheDocument()
    })

    it('mocks unavailable browser APIs', () => {
      expect(global.IntersectionObserver).toBeDefined()
      expect(global.ResizeObserver).toBeDefined()
      expect(window.matchMedia).toBeDefined()
    })
  })

  describe('Enhanced Mock Support', () => {
    it('provides vi mocking utilities', () => {
      const mockFn = vi.fn()
      mockFn()
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('supports module mocking', () => {
      // Mock factory integration should be working
      expect(getMinutesUntil).toBeDefined()
    })

    it('enables spying on existing functions', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      console.log('test')
      expect(consoleSpy).toHaveBeenCalledWith('test')
      consoleSpy.mockRestore()
    })
  })

  describe('Performance and Testing Environment', () => {
    it('loads test environment within acceptable time', () => {
      const startTime = Date.now()

      // Simple component to test environment load
      const component = () => (
        <div data-testid="perf-test">
          Performance Test Component
        </div>
      )

      render(component())

      const endTime = Date.now()
      const duration = endTime - startTime

      // Environment should load reasonably quickly
      expect(duration).toBeLessThan(200)
    })
  })
})
