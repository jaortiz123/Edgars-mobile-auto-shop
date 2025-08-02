/**
 * P2-T-006: Isolated Error Handlers for MSW
 * 
 * This file contains individual error handlers for each error scenario.
 * Each handler is designed to be used with server.use() for true test isolation.
 */

import { http, HttpResponse } from 'msw';

// Helper function for generating request IDs
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to simulate network delay
async function simulateNetworkDelay(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

// ========== ERROR SCENARIO HANDLERS ==========

/**
 * Handler for 500 error on PATCH /appointments/:id
 */
export const appointmentPatch500Handler = http.patch('http://localhost:3001/appointments/:id', async () => {
  console.log('🚨 MSW: Simulating 500 error for appointment PATCH');
  return HttpResponse.json(
    { 
      data: null,
      errors: [{ status: '500', code: 'PROVIDER_ERROR', detail: 'Internal server error updating appointment' }],
      meta: { request_id: generateRequestId() }
    },
    { status: 500 }
  );
});

/**
 * Handler for 500 error on PATCH /api/appointments/:id (API version)
 */
export const appointmentPatchApi500Handler = http.patch('http://localhost:3001/api/appointments/:id', async () => {
  console.log('🚨 MSW: Simulating 500 error for API appointment PATCH');
  return HttpResponse.json(
    { 
      data: null,
      errors: [{ status: '500', code: 'PROVIDER_ERROR', detail: 'Internal server error updating appointment' }],
      meta: { request_id: generateRequestId() }
    },
    { status: 500 }
  );
});

/**
 * Handler for 500 error on PATCH /admin/appointments/:id/move
 */
export const appointmentMove500Handler = http.patch('http://localhost:3001/admin/appointments/:id/move', async () => {
  console.log('🚨 MSW: Simulating 500 error for appointment move');
  return HttpResponse.json(
    { 
      data: null,
      errors: [{ status: '500', code: 'PROVIDER_ERROR', detail: 'Internal server error updating appointment' }],
      meta: { request_id: generateRequestId() }
    },
    { status: 500 }
  );
});

/**
 * Handler for 401 unauthorized on protected admin endpoints
 */
export const unauthorizedAccessHandler = http.patch('http://localhost:3001/admin/appointments/:id/status', async () => {
  console.log('🚨 MSW: Simulating 401 unauthorized error');
  return HttpResponse.json(
    { 
      data: null,
      errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required' }],
      meta: { request_id: generateRequestId() }
    },
    { status: 401 }
  );
});

/**
 * Handler for 401 unauthorized on dashboard stats
 */
export const dashboardStats401Handler = http.get('http://localhost:3001/admin/dashboard/stats', async () => {
  console.log('🚨 MSW: Simulating 401 error for protected admin endpoint: dashboard stats');
  return HttpResponse.json(
    { 
      data: null,
      errors: [{ status: '401', code: 'AUTH_REQUIRED', detail: 'Authentication required for admin endpoints' }],
      meta: { request_id: generateRequestId() }
    },
    { status: 401 }
  );
});

/**
 * Handler for network delay >3s on dashboard stats
 */
export const dashboardStatsDelayHandler = http.get('http://localhost:3001/admin/dashboard/stats', async () => {
  console.log('🚨 MSW: Simulating network delay (3.5s) for dashboard stats');
  await simulateNetworkDelay(3500); // 3.5 second delay to test loading states

  return HttpResponse.json({
    data: {
      totals: {
        today_completed: 3,
        today_booked: 5,
        avg_cycle: 120,
        avg_cycle_formatted: '2h 0m'
      },
      countsByStatus: {
        scheduled: 8,
        in_progress: 3,
        ready: 2,
        completed: 11,
        cancelled: 1
      },
      carsOnPremises: [
        { license: 'ABC-123', customer: 'John Doe', arrival: '09:30' },
        { license: 'XYZ-789', customer: 'Jane Smith', arrival: '11:15' }
      ],
      unpaidTotal: 1250.50
    },
    errors: null,
    meta: { request_id: generateRequestId() }
  });
});

/**
 * Handler for network timeout on dashboard stats
 */
export const dashboardStatsTimeoutHandler = http.get('http://localhost:3001/admin/dashboard/stats', async () => {
  console.log('🚨 MSW: Simulating network timeout for dashboard stats');
  // Simulate a timeout by rejecting after 1 second
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Network timeout'));
    }, 1000);
  });
});

// ========== CONVENIENCE COLLECTIONS ==========

/**
 * All 500 error handlers for appointment PATCH operations
 */
export const appointment500Handlers = [
  appointmentPatch500Handler,
  appointmentPatchApi500Handler,
  appointmentMove500Handler,
];

/**
 * All 401 unauthorized handlers
 */
export const unauthorizedHandlers = [
  unauthorizedAccessHandler,
  dashboardStats401Handler,
];

/**
 * Network delay/timeout handlers
 */
export const networkIssueHandlers = [
  dashboardStatsDelayHandler,
  dashboardStatsTimeoutHandler,
];
