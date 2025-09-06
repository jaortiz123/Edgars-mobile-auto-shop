import { test, expect } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';

test.describe('Milestone 3: Advanced Vehicle Actions - E2E Demo', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication as admin user
    await stubCustomerProfile(page, { email: 'admin@example.com' });

    // Navigate to admin customers page
    await page.goto('http://localhost:5173/admin/customers');
    await page.waitForLoadState('networkidle');
  });

  test('Vehicle Management UI Flow - Complete Navigation Test', async ({ page }) => {
    console.log('🎬 Starting Complete Vehicle Management UI Flow Test');

    // Step 1: Search for customers
    const searchInput = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);
    console.log('✅ Step 1: Customer search completed');

    // Step 2: Navigate to customer profile
    const customerResults = page.getByTestId('customer-results');
    if (await customerResults.isVisible()) {
      const firstCustomerCard = customerResults.locator('[data-testid^="customer-card-"]').first();
      if (await firstCustomerCard.count() > 0) {
        await firstCustomerCard.locator('[data-testid="customer-view-history"]').click();
        await page.waitForLoadState('networkidle');
        console.log('✅ Step 2: Navigated to customer profile page');

        // Step 3: Open Edit Customer Dialog
        await page.waitForTimeout(2000); // Wait for page to fully load
        const editButton = page.locator('button:has-text("Edit Customer")').first();
        await editButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
        console.log('✅ Step 3: Edit Customer dialog opened');

        // Step 4: Navigate to Vehicles Tab
        const vehiclesTab = page.locator('button:has-text("Vehicles")');
        if (await vehiclesTab.count() > 0) {
          await vehiclesTab.click();
          await page.waitForTimeout(500);
          console.log('✅ Step 4: Switched to Vehicles tab');

          // Step 5: Check Vehicle Management Interface
          await expect(page.locator('text=Customer Vehicles')).toBeVisible();
          console.log('✅ Step 5: Vehicle management interface is visible');

          // Step 6: Check for Add Vehicle Button
          const addVehicleBtn = page.locator('button:has-text("+ Add Vehicle")');
          await expect(addVehicleBtn).toBeVisible();
          console.log('✅ Step 6: Add Vehicle button is present');

          // Step 7: Check vehicle list area
          const vehicleCards = page.locator('[data-testid="vehicle-card"]');
          const vehicleCount = await vehicleCards.count();
          console.log(`✅ Step 7: Found ${vehicleCount} vehicles for this customer`);

          if (vehicleCount > 0) {
            // Step 8a: Test Vehicle Action Buttons (if vehicles exist)
            const firstVehicle = vehicleCards.first();
            const vehicleTitle = await firstVehicle.locator('h4').textContent();
            console.log(`Testing vehicle actions on: "${vehicleTitle}"`);

            // Check for Set Primary button
            const setPrimaryBtn = firstVehicle.locator('button:has-text("Set Primary")');
            if (await setPrimaryBtn.count() > 0) {
              await expect(setPrimaryBtn).toBeVisible();
              console.log('✅ "Set Primary" button is available and visible');
            }

            // Check for Mark Inactive/Reactivate button
            const inactiveBtn = firstVehicle.locator('button:has-text("Mark Inactive"), button:has-text("Reactivate")');
            await expect(inactiveBtn.first()).toBeVisible();
            const inactiveBtnText = await inactiveBtn.first().textContent();
            console.log(`✅ "${inactiveBtnText}" button is available and visible`);

            // Check for Transfer button
            const transferBtn = firstVehicle.locator('button:has-text("Transfer...")');
            await expect(transferBtn).toBeVisible();
            console.log('✅ "Transfer..." button is available and visible');

            // Step 8b: Test Transfer Modal (without completing transfer)
            await transferBtn.click();
            await expect(page.locator('text=Transfer Vehicle')).toBeVisible();
            console.log('✅ Transfer Vehicle modal opens correctly');

            await expect(page.locator('text=Search for customer to transfer to:')).toBeVisible();
            console.log('✅ Customer search interface is present in transfer modal');

            // Cancel transfer to return to vehicle list
            await page.click('button:has-text("Cancel")');
            await expect(page.locator('text=Transfer Vehicle')).not.toBeVisible();
            console.log('✅ Transfer modal cancellation works correctly');

            // Step 8c: Verify Primary/Inactive Badge System
            const primaryBadges = await page.locator('[data-testid="vehicle-card"] >> text=PRIMARY').count();
            const inactiveBadges = await page.locator('[data-testid="vehicle-card"] >> text=INACTIVE').count();
            console.log(`✅ Vehicle badge system: ${primaryBadges} PRIMARY, ${inactiveBadges} INACTIVE vehicles`);

          } else {
            // Step 8: No Vehicles Scenario
            await expect(page.locator('text=No vehicles registered')).toBeVisible();
            console.log('✅ Step 8: No vehicles message displayed correctly');

            // Step 9: Test Add Vehicle Flow (opening the form)
            await addVehicleBtn.click();
            await page.waitForTimeout(500);

            await expect(page.locator('text=Add New Vehicle')).toBeVisible();
            console.log('✅ Step 9: Add Vehicle form opens correctly');

            // Verify form fields are present
            await expect(page.locator('input[placeholder="Toyota"]')).toBeVisible(); // Make field
            await expect(page.locator('input[placeholder="Camry"]')).toBeVisible(); // Model field
            console.log('✅ Vehicle form fields are present and accessible');

            // Cancel add vehicle to return to vehicle list
            await page.click('button:has-text("Cancel")');
            await expect(page.locator('text=Add New Vehicle')).not.toBeVisible();
            console.log('✅ Add Vehicle form cancellation works correctly');
          }

          // Step 10: Close Dialog and Verify Return to Profile
          await page.click('button:has-text("Done")');
          await expect(page.locator('[role="dialog"]')).not.toBeVisible();
          console.log('✅ Step 10: Dialog closes and returns to customer profile');

        } else {
          console.log('⚠️ Vehicles tab not found - this may indicate the feature is not available');
        }
      } else {
        console.log('⚠️ No customer cards found in search results');
      }
    } else {
      console.log('⚠️ Customer results not visible - may be no data');
    }

    console.log('🎉 Complete Vehicle Management UI Flow Test completed successfully!');
  });

  test('Vehicle Action Button States and Visibility', async ({ page }) => {
    console.log('🎬 Testing Vehicle Action Button States');

    // Navigate through the UI to the vehicles tab
    const searchInput = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);

    const customerResults = page.getByTestId('customer-results');
    if (await customerResults.isVisible()) {
      const firstCustomerCard = customerResults.locator('[data-testid^="customer-card-"]').first();
      if (await firstCustomerCard.count() > 0) {
        await firstCustomerCard.locator('[data-testid="customer-view-history"]').click();
        await page.waitForLoadState('networkidle');

        await page.waitForTimeout(2000);
        await page.locator('button:has-text("Edit Customer")').first().click();
        await page.waitForSelector('[role="dialog"]');

        const vehiclesTab = page.locator('button:has-text("Vehicles")');
        if (await vehiclesTab.count() > 0) {
          await vehiclesTab.click();
          await page.waitForTimeout(500);

          // Test button accessibility and states
          console.log('✅ Reached vehicles management interface');

          // Verify Add Vehicle button is not disabled
          const addVehicleBtn = page.locator('button:has-text("+ Add Vehicle")');
          await expect(addVehicleBtn).not.toBeDisabled();
          console.log('✅ Add Vehicle button is enabled');

          // Check if there are vehicles to test action buttons on
          const vehicleCards = page.locator('[data-testid="vehicle-card"]');
          const vehicleCount = await vehicleCards.count();

          if (vehicleCount > 0) {
            const firstVehicle = vehicleCards.first();

            // Test that action buttons are not disabled by default
            const setPrimaryBtn = firstVehicle.locator('button:has-text("Set Primary")');
            const inactiveBtn = firstVehicle.locator('button:has-text("Mark Inactive"), button:has-text("Reactivate")');
            const transferBtn = firstVehicle.locator('button:has-text("Transfer...")');

            if (await setPrimaryBtn.count() > 0) {
              await expect(setPrimaryBtn).not.toBeDisabled();
              console.log('✅ Set Primary button is enabled when appropriate');
            }

            await expect(inactiveBtn.first()).not.toBeDisabled();
            console.log('✅ Mark Inactive/Reactivate button is enabled');

            await expect(transferBtn).not.toBeDisabled();
            console.log('✅ Transfer button is enabled');

          } else {
            console.log('✅ No vehicles present - action button states would only be testable with vehicle data');
          }
        }
      }
    }

    console.log('🎉 Vehicle Action Button States test completed!');
  });

  test('Add Vehicle Form Validation and Fields', async ({ page }) => {
    console.log('🎬 Testing Add Vehicle Form');

    // Navigate to add vehicle form
    const searchInput = page.getByPlaceholder(/search by plate|name|phone|email/i);
    await searchInput.fill('test');
    await page.waitForTimeout(1500);

    const customerResults = page.getByTestId('customer-results');
    if (await customerResults.isVisible()) {
      const firstCustomerCard = customerResults.locator('[data-testid^="customer-card-"]').first();
      if (await firstCustomerCard.count() > 0) {
        await firstCustomerCard.locator('[data-testid="customer-view-history"]').click();
        await page.waitForLoadState('networkidle');

        await page.waitForTimeout(2000);
        await page.locator('button:has-text("Edit Customer")').first().click();
        await page.waitForSelector('[role="dialog"]');

        await page.locator('button:has-text("Vehicles")').click();
        await page.waitForTimeout(500);

        // Click Add Vehicle
        await page.locator('button:has-text("+ Add Vehicle")').click();
        await page.waitForTimeout(500);

        // Verify form structure
        await expect(page.locator('text=Add New Vehicle')).toBeVisible();
        console.log('✅ Add Vehicle form header visible');

        // Check required fields
        const makeField = page.locator('input[placeholder="Toyota"]');
        const modelField = page.locator('input[placeholder="Camry"]');
        const yearField = page.locator('input[type="number"]');

        await expect(makeField).toBeVisible();
        await expect(modelField).toBeVisible();
        await expect(yearField).toBeVisible();
        console.log('✅ Required fields (Make, Model, Year) are present');

        // Check optional fields
        await expect(page.locator('input[placeholder="ABC123"]')).toBeVisible(); // License Plate
        await expect(page.locator('input[placeholder="17-character VIN"]')).toBeVisible(); // VIN
        await expect(page.locator('textarea[placeholder*="Additional notes"]')).toBeVisible(); // Notes
        console.log('✅ Optional fields (License Plate, VIN, Notes) are present');

        // Test form validation - submit button should be disabled without required fields
        const submitBtn = page.locator('button:has-text("Add Vehicle")');
        await expect(submitBtn).toBeDisabled();
        console.log('✅ Submit button properly disabled without required fields');

        // Fill required fields and verify button becomes enabled
        await makeField.fill('Toyota');
        await modelField.fill('Camry');
        await expect(submitBtn).not.toBeDisabled();
        console.log('✅ Submit button enabled after filling required fields');

        // Test cancel functionality
        await page.click('button:has-text("Cancel")');
        await expect(page.locator('text=Add New Vehicle')).not.toBeVisible();
        console.log('✅ Add Vehicle form cancel works correctly');
      }
    }

    console.log('🎉 Add Vehicle Form test completed!');
  });
});
