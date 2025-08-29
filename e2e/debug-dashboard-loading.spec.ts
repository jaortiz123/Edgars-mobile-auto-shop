import { test, expect } from '@playwright/test'

test.describe('Dashboard Loading Debug', () => {

  test('Debug dashboard loading issue', async ({ page }) => {
    console.log('🔍 Starting Dashboard Debug Test')

    // Navigate to dashboard
    await page.goto('http://localhost:5173/admin/dashboard')
    await page.waitForLoadState('networkidle')

    // Take a screenshot of current state
    await page.screenshot({ path: 'test-results/dashboard-debug.png', fullPage: true })
    console.log('📸 Screenshot saved to test-results/dashboard-debug.png')

    // Check console errors
    const consoleLogs: string[] = []
    const consoleErrors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        console.log('❌ Console Error:', msg.text())
      } else if (msg.type() === 'log' || msg.type() === 'info' || msg.type() === 'warn') {
        consoleLogs.push(msg.text())
        console.log(`📋 Console ${msg.type()}:`, msg.text())
      }
    })

    // Reload page to capture console messages
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // Wait for any async operations

    // Check network requests
    const failedRequests: string[] = []

    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`)
        console.log('🔴 Failed Request:', response.status(), response.url())
      } else {
        console.log('✅ Request:', response.status(), response.url())
      }
    })

    // Try to reload again to see network requests
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check for specific dashboard elements
    const dashboardTitle = await page.$('text=EDGAR\'S SHOP DASHBOARD')
    console.log('Dashboard title found:', !!dashboardTitle)

    const dashboardCards = await page.$$('.card, [class*="card"]')
    console.log(`Found ${dashboardCards.length} card elements`)

    // Check for error messages or loading states
    const errorElements = await page.$$('text=error, text=Error, text=ERROR')
    const loadingElements = await page.$$('text=Loading, text=loading')

    console.log(`Error elements: ${errorElements.length}`)
    console.log(`Loading elements: ${loadingElements.length}`)

    // Get page content
    const bodyText = await page.textContent('body')
    console.log('Page contains content:', !!bodyText && bodyText.length > 100)

    // Check for React dev tools errors
    const reactErrors = await page.evaluate(() => {
      const errors: string[] = []

      // Check if React is loaded
      if (typeof (window as any).React !== 'undefined') {
        errors.push('React is loaded')
      } else {
        errors.push('React not found on window')
      }

      // Check for common React error indicators
      const reactErrorBoundary = document.querySelector('[data-reactroot] [class*="error"], [id*="error"]')
      if (reactErrorBoundary) {
        errors.push('Potential React error boundary detected')
      }

      return errors
    })

    console.log('React status:', reactErrors.join(', '))

    // Final summary
    console.log('\n🔍 DEBUG SUMMARY:')
    console.log(`- Console Errors: ${consoleErrors.length}`)
    console.log(`- Failed Requests: ${failedRequests.length}`)
    console.log(`- Dashboard cards found: ${dashboardCards.length}`)
    console.log('- Screenshot saved for visual inspection')

    if (consoleErrors.length > 0) {
      console.log('\n❌ CONSOLE ERRORS:')
      consoleErrors.forEach(error => console.log('  -', error))
    }

    if (failedRequests.length > 0) {
      console.log('\n🔴 FAILED REQUESTS:')
      failedRequests.forEach(req => console.log('  -', req))
    }

    console.log('🔍 Dashboard Debug Test Complete')
  })
})
