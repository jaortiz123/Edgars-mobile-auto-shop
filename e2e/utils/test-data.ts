import { APIRequestContext } from '@playwright/test';

export async function createTestAppointment(request: APIRequestContext, appointmentData: any = {}) {
  const defaultAppointment = {
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: '555-0123',
    service_type: 'Oil Change',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00',
    status: 'scheduled',
    ...appointmentData
  };

  const response = await request.post('http://localhost:3001/api/appointments', {
    data: defaultAppointment,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getStoredToken()
    }
  });

  return response;
}

export async function clearTestAppointments(request: APIRequestContext) {
  // Get all appointments and delete them
  const response = await request.get('http://localhost:3001/api/appointments', {
    headers: {
      'Authorization': 'Bearer ' + getStoredToken()
    }
  });

  if (response.ok()) {
    const appointments = await response.json();
    for (const appointment of appointments.data || []) {
      await request.delete(`http://localhost:3001/api/appointments/${appointment.id}`, {
        headers: {
          'Authorization': 'Bearer ' + getStoredToken()
        }
      });
    }
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
