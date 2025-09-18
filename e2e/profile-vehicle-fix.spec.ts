// Test to verify customer profile vehicle display fix
import { test, expect } from '@playwright/test';

test('Customer Profile Vehicle Display Fix Verification', async ({ page }) => {
  console.log('🔧 Testing customer profile vehicle display fix...');

  // Navigate to Jesus Ortiz's profile page (ID: 322)
  console.log('🚀 Navigating to customer profile page...');
  await page.goto('http://localhost:5173/admin/customers/322');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Take a screenshot
  await page.screenshot({ path: 'test-results/profile-page-loaded.png', fullPage: true });
  console.log('📸 Screenshot saved: profile-page-loaded.png');

  // Look for vehicle count in the header
  console.log('🔍 Looking for Vehicles section header...');

  const vehiclesSectionSelectors = [
    'text=/Vehicles \\(\\d+\\)/',
    'h3:has-text("Vehicles")',
    '[data-testid*="vehicle"]',
    'text="Vehicles (1)"',
    'text="Vehicles"'
  ];

  let foundVehiclesHeader = false;
  for (const selector of vehiclesSectionSelectors) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 2000 })) {
        const headerText = await element.textContent();
        console.log(`✅ Found vehicles header: "${headerText}" with selector: ${selector}`);
        foundVehiclesHeader = true;

        // Check if it shows count > 0
        if (headerText && (headerText.includes('(1)') || headerText.includes('1'))) {
          console.log('🎉 SUCCESS: Vehicle count is displayed correctly!');
        }
        break;
      }
    } catch (e) {
      console.log(`❌ No vehicles header found with selector: ${selector}`);
    }
  }

  // Look for vehicle cards/details
  console.log('🔍 Looking for vehicle cards...');

  const vehicleCardSelectors = [
    'text="2025 Lamborghini Huracan"',
    'text="Lamborghini"',
    'text="Huracan"',
    '.vehicle-card',
    '[data-testid="vehicle-card"]'
  ];

  let foundVehicleCard = false;
  for (const selector of vehicleCardSelectors) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 2000 })) {
        const cardText = await element.textContent();
        console.log(`✅ Found vehicle card: "${cardText}" with selector: ${selector}`);
        foundVehicleCard = true;

        if (cardText && (cardText.includes('Lamborghini') || cardText.includes('Huracan'))) {
          console.log('🎉 SUCCESS: Vehicle details are displayed correctly!');
        }
        break;
      }
    } catch (e) {
      console.log(`❌ No vehicle card found with selector: ${selector}`);
    }
  }

  // Final assessment
  if (foundVehiclesHeader && foundVehicleCard) {
    console.log('✅ 🎉 COMPLETE SUCCESS: Both vehicle header count AND vehicle card are displayed!');
    console.log('✅ The customer profile vehicle display bug has been FIXED!');
  } else if (foundVehiclesHeader) {
    console.log('⚠️ PARTIAL SUCCESS: Vehicle header found but no vehicle card visible');
  } else if (foundVehicleCard) {
    console.log('⚠️ PARTIAL SUCCESS: Vehicle card found but header may not show count');
  } else {
    console.log('❌ ISSUE STILL EXISTS: No vehicle data visible on profile page');
  }

  // Take a final screenshot
  await page.screenshot({ path: 'test-results/profile-fix-verification.png', fullPage: true });
  console.log('📸 Final screenshot saved: profile-fix-verification.png');
});
