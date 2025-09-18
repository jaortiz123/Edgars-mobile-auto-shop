// Debug test to examine the data structure being passed to components
import { test, expect } from '@playwright/test';

test('Debug Customer Profile Data Structure', async ({ page }) => {
  console.log('🐛 Debugging customer profile data structure...');

  // Navigate to the page
  await page.goto('http://localhost:5173/admin/customers/322');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Inject JavaScript to examine the data structure
  const debugInfo = await page.evaluate(() => {
    // Look for React DevTools data or component state
    const results = {
      vehiclesInDOM: 0,
      vehicleElements: [],
      hasReactFiber: false,
      dataStructure: 'unknown'
    };

    // Count vehicle-related elements
    results.vehiclesInDOM = document.querySelectorAll('[data-testid*="vehicle"], .vehicle-card').length;

    // Look for text content that might indicate vehicle data
    const bodyText = document.body.textContent || '';
    results.vehicleElements = [
      bodyText.includes('Lamborghini'),
      bodyText.includes('Huracan'),
      bodyText.includes('2025'),
      bodyText.includes('627')
    ];

    // Check if React DevTools or fiber data is available
    const reactElements = document.querySelectorAll('[data-reactroot], [data-react-]');
    results.hasReactFiber = reactElements.length > 0;

    return results;
  });

  console.log('🔍 DOM Analysis Results:');
  console.log('   Vehicles in DOM:', debugInfo.vehiclesInDOM);
  console.log('   Vehicle text found:', debugInfo.vehicleElements);
  console.log('   Has React elements:', debugInfo.hasReactFiber);

  // Check console logs (including our debug logs)
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warn' || text.includes('CustomerProfile Debug')) {
      consoleMessages.push(`${msg.type()}: ${text}`);
    }
  });

  // Wait a bit more for any console messages
  await page.waitForTimeout(2000);

  if (consoleMessages.length > 0) {
    console.log('⚠️ Console Messages:');
    consoleMessages.forEach(msg => console.log('   ', msg));
  }

  // Get page HTML to look for vehicle data
  const pageHTML = await page.content();
  const hasVehicleData = [
    pageHTML.includes('Lamborghini'),
    pageHTML.includes('Huracan'),
    pageHTML.includes('627'),
    pageHTML.includes('Vehicles (1)'),
    pageHTML.includes('Vehicles (0)')
  ];

  console.log('📄 Page HTML Analysis:');
  console.log('   Contains Lamborghini:', hasVehicleData[0]);
  console.log('   Contains Huracan:', hasVehicleData[1]);
  console.log('   Contains ID 627:', hasVehicleData[2]);
  console.log('   Contains "Vehicles (1)":', hasVehicleData[3]);
  console.log('   Contains "Vehicles (0)":', hasVehicleData[4]);

  // Take screenshot for manual inspection
  await page.screenshot({ path: 'test-results/debug-profile-structure.png', fullPage: true });
  console.log('📸 Debug screenshot saved: debug-profile-structure.png');
});
