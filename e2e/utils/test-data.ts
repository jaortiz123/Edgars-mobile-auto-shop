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

  try {
    const response = await request.post('http://localhost:3001/api/appointments', {
      data: defaultAppointment,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getStoredToken()
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
    const response = await request.get('http://localhost:3001/api/appointments', {
      headers: {
        'Authorization': 'Bearer ' + getStoredToken()
      }
    });

    console.log(`Get appointments response: ${response.status()}`);

    if (response.ok()) {
      const appointments = await response.json();
      const appointmentList = appointments.data || appointments || [];
      console.log(`Found ${appointmentList.length} appointments to delete`);

      for (const appointment of appointmentList) {
        const deleteResponse = await request.delete(`http://localhost:3001/api/appointments/${appointment.id}`, {
          headers: {
            'Authorization': 'Bearer ' + getStoredToken()
          }
        });
        console.log(`Delete appointment ${appointment.id}: ${deleteResponse.status()}`);
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
