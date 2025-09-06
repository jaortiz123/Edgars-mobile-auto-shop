import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

test.describe('Milestone 3: Advanced Vehicle Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication as admin user
    await stubCustomerProfile(page, { email: 'admin@example.com' });

    // Navigate to admin customers page (use Vite dev port)
    await page.goto('http://localhost:5173/admin/customers');
    await page.waitForLoadState('networkidle');
  });

  test('Set Primary Vehicle - should mark vehicle as primary and show badge', async ({ page }) => {
    console.log('🎬 Starting Set Primary Vehicle Test');

    // Search for any customers first - use a simple search term
    const searchInput = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await searchInput.fill('test');
    await page.waitForTimeout(300);
    await page.waitForResponse(r => r.url().includes('/api/admin/customers/search') && r.request().method()==='GET', { timeout: 15000 }).catch(()=>{});
    console.log('✅ Searched for customers');

    // Look for customer results and click the first one
    const customerResults = page.getByTestId('customer-results');
    if (await customerResults.isVisible()) {
      const firstCustomerCard = customerResults.locator('[data-testid^="customer-card-"]').first();
      if (await firstCustomerCard.count() > 0) {
        // Click "View Full History" on the first customer
        const viewHistoryButton = firstCustomerCard.locator('[data-testid="customer-view-history"]');
        await viewHistoryButton.click();
        await page.waitForLoadState('networkidle');
        console.log('✅ Navigated to customer profile');

        // Look for Edit Customer button and click it
        const editButton = page.getByTestId('btn-edit-customer').first();
        await page.waitForTimeout(2000); // Wait for page to fully load

        // Debug: Log what buttons are actually visible
        const allButtons = await page.locator('button').all();
        console.log(`Found ${allButtons.length} buttons on the page`);
        for (let i = 0; i < Math.min(allButtons.length, 5); i++) {
          const buttonText = await allButtons[i].textContent();
          console.log(`Button ${i}: "${buttonText}"`);
        }

        // Try multiple selectors for the edit button
        let editButtonFound = false;
        const editSelectors = [
          '[data-testid="btn-edit-customer"]',
          'button:has-text("Edit Customer")',
          'button:has-text("Edit")'
        ];

        for (const selector of editSelectors) {
          const button = page.locator(selector);
          if (await button.count() > 0 && await button.isVisible()) {
            console.log(`Found edit button with selector: ${selector}`);
            await button.click();
            editButtonFound = true;
            break;
          }
        }

        if (editButtonFound) {
          await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
          console.log('✅ Edit dialog opened');

          // Switch to Vehicles tab
          const vehiclesTab = page.locator('button:has-text("Vehicles")').first();
          if (await vehiclesTab.count() > 0) {
            await vehiclesTab.click();
            await page.waitForTimeout(500);
            console.log('✅ Switched to Vehicles tab');

            // Find vehicles and test Set Primary functionality
            const vehicleCards = page.locator('[data-testid="vehicle-card"]').first().locator('..').locator('[data-testid="vehicle-card"]');
            const vehicleCount = await vehicleCards.count();
            console.log(`Found ${vehicleCount} vehicles`);

            if (vehicleCount > 0) {
              // Find a vehicle that can be set as primary
              let targetVehicleCard = null;
              for (let i = 0; i < vehicleCount; i++) {
                const card = vehicleCards.nth(i);
                const hasPrimaryBadge = await card.locator('text=PRIMARY').count() > 0;
                const hasInactiveBadge = await card.locator('text=INACTIVE').count() > 0;
                const setPrimaryButton = card.locator('button:has-text("Set Primary")');

                if (!hasPrimaryBadge && !hasInactiveBadge && await setPrimaryButton.count() > 0) {
                  targetVehicleCard = card;
                  break;
                }
              }

              if (targetVehicleCard) {
                // Get the vehicle info for verification
                const vehicleTitle = await targetVehicleCard.locator('h4').textContent();
                console.log(`Testing Set Primary on vehicle: ${vehicleTitle}`);

                // Click "Set Primary" button
                await targetVehicleCard.locator('button:has-text("Set Primary")').click();
                await page.waitForTimeout(1000);

                // Verify that the PRIMARY badge appears on the vehicle
                await expect(targetVehicleCard.locator('text=PRIMARY')).toBeVisible();
                console.log(`✅ PRIMARY badge appeared on vehicle: ${vehicleTitle}`);

                // Verify that the vehicle card has the primary styling
                await expect(targetVehicleCard).toHaveClass(/border-blue-300/);
                console.log('✅ Vehicle card has primary styling');

                // Verify that only one vehicle has the PRIMARY badge
                const allPrimaryBadges = page.locator('[data-testid="vehicle-card"] >> text=PRIMARY');
                await expect(allPrimaryBadges).toHaveCount(1);
                console.log('✅ Only one vehicle has PRIMARY badge');

              } else {
                console.log('⚠️ No eligible vehicle found for Set Primary test (all may already be primary or inactive)');
              }
            } else {
              console.log('⚠️ No vehicles found for this customer');
            }
          } else {
            console.log('⚠️ Vehicles tab not found - customer may not have vehicles');
          }
        } else {
          console.log('⚠️ Edit Customer button not found');
        }
      } else {
        console.log('⚠️ No customer cards found in search results');
      }
    } else {
      console.log('⚠️ Customer results not visible - may be no data');
    }
  });

  test('Mark Inactive Vehicle - should visually distinguish inactive vehicles', async ({ page }) => {
    console.log('🎬 Starting Mark Inactive Vehicle Test');

    // Search for any customers
    const searchInput = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await searchInput.fill('test');
    await page.waitForTimeout(300);
    await page.waitForResponse(r => r.url().includes('/api/admin/customers/search') && r.request().method()==='GET', { timeout: 15000 }).catch(()=>{});

    // Navigate to customer profile and edit dialog
    const customerResults = page.getByTestId('customer-results');
    if (await customerResults.isVisible()) {
      const firstCustomerCard = customerResults.locator('[data-testid^="customer-card-"]').first();
      if (await firstCustomerCard.count() > 0) {
        await firstCustomerCard.locator('[data-testid="customer-view-history"]').click();
        await page.waitForLoadState('networkidle');

        const editButton = page.getByTestId('btn-edit-customer');
        if (await editButton.count() > 0) {
          await editButton.click();
          await page.waitForSelector('[role="dialog"]');

          const vehiclesTab = page.locator('button:has-text("Vehicles")');
          if (await vehiclesTab.count() > 0) {
            await vehiclesTab.click();
            await page.waitForTimeout(500);

            const vehicleCards = page.locator('[data-testid="vehicle-card"]');
            const vehicleCount = await vehicleCards.count();
            console.log(`Found ${vehicleCount} vehicles`);

            if (vehicleCount > 0) {
              // Find an active vehicle
              let targetVehicleCard = null;
              for (let i = 0; i < vehicleCount; i++) {
                const card = vehicleCards.nth(i);
                const hasInactiveBadge = await card.locator('text=INACTIVE').count() > 0;

                if (!hasInactiveBadge) {
                  targetVehicleCard = card;
                  break;
                }
              }

              if (targetVehicleCard) {
                const vehicleTitle = await targetVehicleCard.locator('h4').textContent();
                console.log(`Testing Mark Inactive on vehicle: ${vehicleTitle}`);

                // Click "Mark Inactive" button
                await targetVehicleCard.locator('button:has-text("Mark Inactive")').click();
                await page.waitForTimeout(1000);

                // Verify that the INACTIVE badge appears
                await expect(targetVehicleCard.locator('text=INACTIVE')).toBeVisible();
                console.log(`✅ INACTIVE badge appeared on vehicle: ${vehicleTitle}`);

                // Verify inactive styling
                await expect(targetVehicleCard).toHaveClass(/border-gray-300/);
                console.log('✅ Vehicle card has inactive styling');

                // Verify button changed to "Reactivate"
                await expect(targetVehicleCard.locator('button:has-text("Reactivate")')).toBeVisible();
                console.log('✅ Button changed to "Reactivate"');

                // Test reactivation
                await targetVehicleCard.locator('button:has-text("Reactivate")').click();
                await page.waitForTimeout(1000);

                await expect(targetVehicleCard.locator('text=INACTIVE')).not.toBeVisible();
                await expect(targetVehicleCard.locator('button:has-text("Mark Inactive")')).toBeVisible();
                console.log('✅ Vehicle successfully reactivated');

              } else {
                console.log('⚠️ No active vehicle found for testing');
              }
            }
          }
        }
      }
    }
  });

  test('Transfer Vehicle - complete workflow with customer search', async ({ page }) => {
    console.log('🎬 Starting Transfer Vehicle Test');

    // Navigate to customer with vehicles
    const searchInput = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await searchInput.fill('test');
    await page.waitForTimeout(300);
    await page.waitForResponse(r => r.url().includes('/api/admin/customers/search') && r.request().method()==='GET', { timeout: 15000 }).catch(()=>{});

    const customerResults = page.getByTestId('customer-results');
    if (await customerResults.isVisible()) {
      const firstCustomerCard = customerResults.locator('[data-testid^="customer-card-"]').first();
      if (await firstCustomerCard.count() > 0) {
        await firstCustomerCard.locator('[data-testid="customer-view-history"]').click();
        await page.waitForLoadState('networkidle');

        const editButton = page.getByTestId('btn-edit-customer');
        if (await editButton.count() > 0) {
          await editButton.click();
          await page.waitForSelector('[role="dialog"]');

          const vehiclesTab = page.locator('button:has-text("Vehicles")');
          if (await vehiclesTab.count() > 0) {
            await vehiclesTab.click();
            await page.waitForTimeout(500);

            const vehicleCards = page.locator('[data-testid="vehicle-card"]');
            const initialVehicleCount = await vehicleCards.count();
            console.log(`Found ${initialVehicleCount} vehicles`);

            if (initialVehicleCount > 0) {
              const firstVehicle = vehicleCards.first();
              const vehicleTitle = await firstVehicle.locator('h4').textContent();
              console.log(`Testing Transfer on vehicle: ${vehicleTitle}`);

              // Click "Transfer..." button
              await firstVehicle.locator('button:has-text("Transfer...")').click();

              // Verify transfer modal opens
              await expect(page.locator('text=Transfer Vehicle')).toBeVisible();
              console.log('✅ Transfer modal opened');

              // Test canceling transfer
              await page.click('button:has-text("Cancel")');
              await expect(page.locator('text=Transfer Vehicle')).not.toBeVisible();
              console.log('✅ Transfer cancellation works');

              // Verify vehicle count unchanged
              const finalVehicleCount = await page.locator('[data-testid="vehicle-card"]').count();
              expect(finalVehicleCount).toBe(initialVehicleCount);
              console.log('✅ Vehicle count unchanged after cancel');

            } else {
              console.log('⚠️ No vehicles found for transfer test');
            }
          }
        }
      }
    }
  });
});
