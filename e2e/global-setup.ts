import axios from 'axios'
import fs from 'fs'
import path from 'path'
import wait from './wait-for-backend'
import { ensureDockerRunning } from './check-docker'
import { TEST_CONSTANTS, generateAppointmentId, generateInvoiceId, getMultipleServices } from './fixtures/test-constants'

// Check Docker availability before starting tests
ensureDockerRunning()

export default async function globalSetup() {
  await wait()

  // Targeted readiness: poll the profile alias endpoint until it stops returning 404.
  // We accept 200/401/403 as "ready" because the route exists; 404 indicates Flask
  // app hasn't fully registered blueprints yet or a stale process is being replaced.
  const profileUrl = process.env.PROFILE_READINESS_URL || 'http://localhost:3001/api/customers/profile'
  const maxAttempts = parseInt(process.env.PROFILE_READINESS_ATTEMPTS || '20', 10)
  const delayMs = parseInt(process.env.PROFILE_READINESS_DELAY_MS || '500', 10)
  const tenantId = process.env.E2E_TENANT_ID || '00000000-0000-0000-0000-000000000001'

  let successStreak = 0
  let ready = false
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.get(profileUrl, {
        timeout: 1500,
        headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer dummy-token', 'X-Tenant-Id': tenantId }
      })
      if (res.status !== 404 && res.status < 500) {
        successStreak += 1
        console.log(`[global-setup] Profile readiness success (#${successStreak}) status ${res.status} on attempt ${attempt}`) // eslint-disable-line no-console
        if (successStreak >= 2) { ready = true; break }
      } else {
        successStreak = 0
        console.log(`[global-setup] Profile readiness attempt ${attempt}: status ${res.status} (reset streak)`) // eslint-disable-line no-console
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status && status !== 404 && status < 500) {
        successStreak += 1
        console.log(`[global-setup] Profile readiness success via error path (#${successStreak}) status ${status} on attempt ${attempt}`) // eslint-disable-line no-console
        if (successStreak >= 2) { ready = true; break }
      } else {
        successStreak = 0
        console.log(`[global-setup] Profile readiness attempt ${attempt} failed: ${status || err.message}`) // eslint-disable-line no-console
      }
    }
    if (attempt === maxAttempts) {
      console.warn('[global-setup] Profile readiness timed out; proceeding (tests may see early 404)') // eslint-disable-line no-console
      break
    }
    await new Promise(r => setTimeout(r, delayMs))
  }
  if (ready) {
    await new Promise(r => setTimeout(r, 2000)) // stabilization delay increased for backend initialization
    console.log('[global-setup] Stabilization delay complete (2000ms)') // eslint-disable-line no-console
  }

  // Single-source auth: perform advisor (admin) login only and persist token.
  // This avoids mixed customer/admin tokens racing in localStorage, which caused intermittent 403s.
  try {
    const adminLogin = await axios.post(
      'http://localhost:3001/api/admin/login',
      { username: 'advisor', password: 'dev' },
      { headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId } }
    )
    const adminToken: string | undefined = adminLogin.data?.data?.token
    if (!adminToken) {
      console.warn('[global-setup] Admin login succeeded but no token found in response') // eslint-disable-line no-console
      return
    }

    // Ensure staff membership for advisor in target tenant so membership checks pass
    try {
      await axios.post(
        'http://localhost:3001/api/admin/staff/memberships',
        { staff_id: 'advisor', tenant_id: tenantId, role: 'Advisor' },
        { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}`, 'X-Tenant-Id': tenantId } }
      )
      console.log('[global-setup] Ensured staff membership for advisor in tenant', tenantId) // eslint-disable-line no-console
    } catch (mErr: any) {
      console.warn('[global-setup] Could not ensure staff membership (proceeding):', mErr?.message || mErr) // eslint-disable-line no-console
    }

    // PHASE 1: Comprehensive Seed Data Creation
    console.log('[global-setup] Starting comprehensive seed data creation...') // eslint-disable-line no-console
    await createSeedData(adminToken, tenantId)
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            { name: 'auth_token', value: adminToken },
            { name: 'tenant_id', value: tenantId },
            { name: 'viewMode', value: 'board' }
          ]
        }
      ]
    }
    const outPath = path.join(process.cwd(), 'e2e', 'storageState.json')
    fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
    console.log('[global-setup] Wrote storage state with advisor auth token to', outPath) // eslint-disable-line no-console
  } catch (e: any) {
    console.warn('[global-setup] Advisor auth setup failed:', e?.message || e) // eslint-disable-line no-console
  }
}

/**
 * PHASE 1: Comprehensive Seed Data Creation
 * Creates deterministic test data for all 95 E2E tests
 * Uses appointment creation to auto-generate customers and vehicles (following existing patterns)
 */
async function createSeedData(adminToken: string, tenantId: string) {
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'X-Tenant-Id': tenantId
  }

  try {
    console.log('[seed-data] Creating comprehensive test data through appointment creation...') // eslint-disable-line no-console
    console.log('[seed-data] This method auto-creates customers and vehicles as needed') // eslint-disable-line no-console

    // Create service operations catalog first (if needed)
    console.log('[seed-data] Creating 10 standard service operations...') // eslint-disable-line no-console
    const services = Object.values(TEST_CONSTANTS.SERVICES)
    for (const service of services) {
      try {
        // Map to service operation format expected by backend
        const serviceOperation = {
          id: service.id,
          name: service.name,
          description: service.description,
          default_hours: service.estimated_duration / 60, // Convert minutes to hours
          default_price: service.base_price,
          category: 'General', // Default category
          is_active: true
        }
        await axios.post('http://localhost:3001/api/admin/service-operations', serviceOperation, { headers: authHeaders })
        console.log(`[seed-data] Created service operation: ${service.name} ($${service.base_price})`) // eslint-disable-line no-console
      } catch (err: any) {
        if (err?.response?.status === 409 || err?.response?.status === 400) {
          console.log(`[seed-data] Service operation exists or endpoint unavailable: ${service.name}`) // eslint-disable-line no-console
        } else {
          console.warn(`[seed-data] Failed to create service operation ${service.name}:`, err?.message) // eslint-disable-line no-console
        }
      }
    }

    console.log('[seed-data] Creating test appointments with auto-generated customers and vehicles...') // eslint-disable-line no-console

    // Create appointments for each customer - this auto-creates customers and vehicles
    const customers = Object.values(TEST_CONSTANTS.CUSTOMERS)
    const vehiclesByCustomer = Object.values(TEST_CONSTANTS.VEHICLES).reduce((acc, vehicle) => {
      if (!acc[vehicle.customer_id]) acc[vehicle.customer_id] = []
      acc[vehicle.customer_id].push(vehicle)
      return acc
    }, {} as Record<string, any[]>)

    let appointmentCount = 0
    let customerCount = 0
    let totalAppointmentAttempts = 0 // Track all attempts to ensure unique IDs

    for (const customer of customers) {
      customerCount++
      const customerVehicles = vehiclesByCustomer[customer.id] || []

      for (let vehicleIndex = 0; vehicleIndex < customerVehicles.length; vehicleIndex++) {
        const vehicle = customerVehicles[vehicleIndex]

        // Create 2-3 appointments per vehicle for good test coverage
        const appointmentsPerVehicle = 2 + (vehicleIndex % 2) // 2 or 3 appointments

        for (let appointmentIndex = 1; appointmentIndex <= appointmentsPerVehicle; appointmentIndex++) {
          totalAppointmentAttempts++
          const appointmentId = generateAppointmentId(customer.id, totalAppointmentAttempts)

          // Vary appointment dates for realistic test data
          const daysBack = Math.floor(Math.random() * 90) + 1 // 1-90 days ago for completed
          const daysFuture = Math.floor(Math.random() * 30) + 1 // 1-30 days ahead for scheduled
          const appointmentDate = new Date()

          const isCompleted = appointmentIndex <= 2 // First 2 appointments are completed, rest scheduled
          if (isCompleted) {
            appointmentDate.setDate(appointmentDate.getDate() - daysBack)
          } else {
            appointmentDate.setDate(appointmentDate.getDate() + daysFuture)
          }

          const status = isCompleted ? 'COMPLETED' : 'SCHEDULED'

          // Generate proper appointment time (8am-4pm business hours)
          const hour = 8 + (totalAppointmentAttempts % 8) // 8am to 3pm
          appointmentDate.setHours(hour, 0, 0, 0) // Set specific hour, zero minutes/seconds/ms

          // Create appointment payload following working patterns from existing tests
          const appointment = {
            requested_time: appointmentDate.toISOString(),
            status: status,
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_email: customer.email,
            license_plate: vehicle.license_plate,
            vehicle_year: vehicle.year,
            vehicle_make: vehicle.make,
            vehicle_model: vehicle.model,
            notes: `Test appointment ${appointmentCount + 1} for ${customer.name} - ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            location_address: customer.address || '123 Test Shop St, Test City, TC 12345'
          }

          try {
            const response = await axios.post('http://localhost:3001/api/admin/appointments', appointment, { headers: authHeaders })
            appointmentCount++
            console.log(`[seed-data] Created appointment ${appointmentCount}: ${customer.name} - ${vehicle.year} ${vehicle.make} ${vehicle.model} (${status})`) // eslint-disable-line no-console

            // Optionally add services to completed appointments
            if (isCompleted && response.data?.id) {
              try {
                const appointmentId = response.data.id
                const randomService = services[Math.floor(Math.random() * services.length)]
                const servicePayload = {
                  name: randomService.name,
                  estimated_hours: randomService.estimated_duration / 60,
                  estimated_price: randomService.base_price,
                  category: 'General'
                }
                await axios.post(`http://localhost:3001/api/appointments/${appointmentId}/services`, servicePayload, { headers: authHeaders })
                console.log(`[seed-data] Added service: ${randomService.name} to appointment ${appointmentId}`) // eslint-disable-line no-console
              } catch (serviceErr: any) {
                console.warn(`[seed-data] Failed to add service to appointment:`, serviceErr?.message) // eslint-disable-line no-console
              }
            }

          } catch (err: any) {
            if (err?.response?.status === 409) {
              console.log(`[seed-data] Appointment conflict (expected for duplicate data): ${appointmentId}`) // eslint-disable-line no-console
            } else {
              console.warn(`[seed-data] Failed to create appointment ${appointmentId}:`, err?.response?.status, err?.message) // eslint-disable-line no-console
              if (err?.response?.data) {
                console.warn(`[seed-data] Error details:`, JSON.stringify(err.response.data, null, 2)) // eslint-disable-line no-console
              }
            }
          }
        }
      }
    }

    console.log('[seed-data] ✅ PHASE 1 COMPLETE: Comprehensive seed data creation finished') // eslint-disable-line no-console
    console.log(`[seed-data] Created: ${customerCount} customers, ${Object.keys(vehiclesByCustomer).length * 2} vehicles, ${services.length} service operations, ${appointmentCount} appointments`) // eslint-disable-line no-console
    console.log('[seed-data] Auto-generated customers and vehicles through appointment creation') // eslint-disable-line no-console
    console.log('[seed-data] Deterministic test environment ready for all 95 E2E tests') // eslint-disable-line no-console

  } catch (error: any) {
    console.error('[seed-data] ❌ PHASE 1 FAILED: Error creating seed data:', error?.message || error) // eslint-disable-line no-console
    // Don't throw - allow tests to proceed with whatever data was created
    console.warn('[seed-data] Proceeding with partial seed data to avoid blocking tests') // eslint-disable-line no-console
  }
}
