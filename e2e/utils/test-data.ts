import { APIRequestContext } from '@playwright/test';

export async function createTestAppointment(request: APIRequestContext, appointmentData: any = {}) {
  const defaultAppointment = {
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: '555-0123',
    service_type: 'Oil Change',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00',
    status: 'SCHEDULED',
    ...appointmentData
  };

  try {
    // Backend exposes create via admin endpoint
    const response = await request.post('http://localhost:3001/api/admin/appointments', {
      data: normalizeCreatePayload(defaultAppointment),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getStoredToken(),
        ...getTenantHeader()
      }
    });

    console.log(`Create appointment response: ${response.status()}`);
    if (!response.ok()) {
      console.log(`Create appointment failed: ${await response.text()}`);
    }

    return response;
  } catch (error) {
    console.log('Error creating test appointment:', error);
    throw error;
  }
}

export async function clearTestAppointments(request: APIRequestContext) {
  try {
    // Get all appointments and delete them
    const response = await request.get('http://localhost:3001/api/admin/appointments', {
      headers: {
        'Authorization': 'Bearer ' + getStoredToken(),
        ...getTenantHeader()
      }
    });

    console.log(`Get appointments response: ${response.status()}`);

    if (response.ok()) {
      const payload = await response.json();
      const appointmentList = payload?.data?.appointments || payload?.appointments || payload || [];
      console.log(`Found ${appointmentList.length || 0} appointments to delete`);

      for (const appointment of appointmentList) {
        const apptId = appointment.id || appointment?.appointment?.id;
        if (!apptId) continue;
        const deleteResponse = await request.delete(`http://localhost:3001/api/admin/appointments/${apptId}`, {
          headers: {
            'Authorization': 'Bearer ' + getStoredToken(),
            ...getTenantHeader()
          }
        });
        console.log(`Delete appointment ${apptId}: ${deleteResponse.status()}`);
      }
    }
  } catch (error) {
    console.log('Error clearing test appointments:', error);
    // Don't throw - this is cleanup, continue with tests
  }
}

function getStoredToken(): string {
  // Read token from the storage state file created by global setup
  try {
    const fs = require('fs');
    const path = require('path');
    const storageStatePath = path.join(process.cwd(), 'e2e', 'storageState.json');
    const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
    const origin = storageState.origins?.find((o: any) => o.origin === 'http://localhost:5173');
    const tokenItem = origin?.localStorage?.find((item: any) => item.name === 'auth_token');
    return tokenItem?.value || '';
  } catch {
    return '';
  }
}

function getTenantHeader(): Record<string, string> {
  // Prefer explicit env; else use default stable test tenant UUID (backend accepts either UUID or slug)
  const tenantId = process.env.E2E_TENANT_ID || '11111111-1111-1111-1111-111111111111';
  return { 'X-Tenant-Id': tenantId };
}

function normalizeCreatePayload(data: any): any {
  // Map generic fields to backend expectations
  const nowIso = new Date().toISOString();
  return {
    status: data.status || 'SCHEDULED',
    // Backend accepts 'start' or 'requested_time'
    start: data.start || data.requested_time || nowIso,
    customer_name: data.customer_name,
    customer_email: data.customer_email,
    customer_phone: data.customer_phone,
    license_plate: data.license_plate,
    vehicle_year: data.vehicle_year,
    vehicle_make: data.vehicle_make,
    vehicle_model: data.vehicle_model,
    notes: data.notes || 'E2E seeded'
  };
}
