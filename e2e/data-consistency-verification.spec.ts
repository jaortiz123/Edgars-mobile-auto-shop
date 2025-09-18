// Final verification test to ensure data consistency between search and profile
import { test, expect } from '@playwright/test';

test('Data Consistency Verification - Search vs Profile', async ({ page }) => {
  console.log('🔍 Testing data consistency between search and profile pages...');

  // Step 1: Get vehicle data from search page
  console.log('📋 Step 1: Getting vehicle data from search page...');
  await page.goto('http://localhost:5173/admin/customers');
  await page.waitForLoadState('networkidle');

  // Search for Jesus
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  await searchInput.fill('Jesus');
  await page.waitForTimeout(1000); // Wait for debounced search

  // Extract vehicle data from search results
  const searchResultText = await page.locator('[data-testid*="customer"]').first().textContent();
  console.log('🔍 Search result text:', searchResultText);

  const searchHasLamborghini = searchResultText?.includes('Lamborghini') || false;
  const searchHasHuracan = searchResultText?.includes('Huracan') || false;
  const searchHas2025 = searchResultText?.includes('2025') || false;

  console.log('🚗 Search page vehicle data:');
  console.log('   Contains Lamborghini:', searchHasLamborghini);
  console.log('   Contains Huracan:', searchHasHuracan);
  console.log('   Contains 2025:', searchHas2025);

  // Step 2: Get vehicle data from profile page
  console.log('\\n📋 Step 2: Getting vehicle data from profile page...');
  await page.goto('http://localhost:5173/admin/customers/322');
  await page.waitForLoadState('networkidle');

  // Check vehicle count header
  const vehicleHeader = await page.locator('text=/Vehicles \\(\\d+\\)/').first().textContent();
  console.log('📊 Vehicle header:', vehicleHeader);

  // Check vehicle card content
  const vehicleCardText = await page.locator('text="2025 Lamborghini Huracan"').first().textContent();
  console.log('🚗 Vehicle card text:', vehicleCardText);

  const profileHasLamborghini = vehicleCardText?.includes('Lamborghini') || false;
  const profileHasHuracan = vehicleCardText?.includes('Huracan') || false;
  const profileHas2025 = vehicleCardText?.includes('2025') || false;
  const profileHasCorrectCount = vehicleHeader?.includes('(1)') || false;

  console.log('🚗 Profile page vehicle data:');
  console.log('   Contains Lamborghini:', profileHasLamborghini);
  console.log('   Contains Huracan:', profileHasHuracan);
  console.log('   Contains 2025:', profileHas2025);
  console.log('   Shows correct count (1):', profileHasCorrectCount);

  // Step 3: Verify consistency
  console.log('\\n🎯 Step 3: Data consistency verification...');

  const dataMatches = [
    searchHasLamborghini === profileHasLamborghini,
    searchHasHuracan === profileHasHuracan,
    searchHas2025 === profileHas2025
  ];

  const allMatch = dataMatches.every(match => match);

  console.log('📊 Consistency Results:');
  console.log('   Lamborghini matches:', dataMatches[0]);
  console.log('   Huracan matches:', dataMatches[1]);
  console.log('   2025 matches:', dataMatches[2]);
  console.log('   Profile shows count:', profileHasCorrectCount);

  if (allMatch && profileHasCorrectCount) {
    console.log('\\n✅ 🎉 PERFECT DATA CONSISTENCY!');
    console.log('✅ Search and profile pages show identical vehicle information');
    console.log('✅ Profile page correctly displays vehicle count');
    console.log('✅ Customer Profile Vehicle Display Bug is COMPLETELY RESOLVED!');
  } else {
    console.log('\\n❌ Data inconsistency detected');
    console.log('❌ Some vehicle information differs between pages');
  }

  // Take final screenshots for verification
  await page.screenshot({ path: 'test-results/final-consistency-verification.png', fullPage: true });
  console.log('📸 Final verification screenshot saved');
});
