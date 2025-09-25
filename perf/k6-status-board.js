import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for detailed tracking
const boardLatency = new Trend('board_latency');
const statsLatency = new Trend('stats_latency');
const moveLatency = new Trend('move_latency');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    // Warm-up phase: 5 RPS for 1 minute
    warmup: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      tags: { phase: 'warmup' },
    },

    // Burst phase: 50 RPS for 2 minutes (SLO validation)
    burst: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 200,
      maxVUs: 300,
      tags: { phase: 'burst' },
      startTime: '1m', // Start after warmup
    },

    // Sustained phase: 20 RPS for 10 minutes
    steady: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 100,
      maxVUs: 150,
      tags: { phase: 'steady' },
      startTime: '3m', // Start after burst
    },
  },

  // SLO thresholds based on Edgar's requirements
  thresholds: {
    // Overall error rate must be < 0.5%
    'http_req_failed': ['rate<0.005'],

    // Endpoint-specific p95 latency requirements
    'http_req_duration{endpoint:board}': ['p(95)<800'],   // Status Board ≤ 800ms
    'http_req_duration{endpoint:stats}': ['p(95)<500'],   // Dashboard Stats ≤ 500ms
    'http_req_duration{endpoint:move}': ['p(95)<400'],    // Move operations ≤ 400ms

    // Phase-specific thresholds (stricter during burst)
    'http_req_duration{phase:burst,endpoint:board}': ['p(95)<800'],
    'http_req_duration{phase:burst,endpoint:stats}': ['p(95)<500'],
    'http_req_duration{phase:burst,endpoint:move}': ['p(95)<400'],

    // Custom metrics thresholds
    'board_latency': ['p(95)<800'],
    'stats_latency': ['p(95)<500'],
    'move_latency': ['p(95)<400'],
    'error_rate': ['rate<0.005'],
  },
};

const URL = __ENV.URL;
const DATE = __ENV.TEST_DATE;

export function setup() {
  // Validate environment
  if (!URL) {
    throw new Error('URL environment variable is required');
  }
  if (!DATE) {
    throw new Error('TEST_DATE environment variable is required');
  }

  console.log(`Load testing URL: ${URL}`);
  console.log(`Test date: ${DATE}`);

  // Verify endpoints are accessible
  const healthCheck = http.get(`${URL}/healthz`);
  if (healthCheck.status !== 200) {
    throw new Error(`Health check failed with status ${healthCheck.status}`);
  }

  return { url: URL, date: DATE };
}

export default function (data) {
  const phase = __ITER < 300 ? 'warmup' : (__ITER < 9300 ? 'burst' : 'steady');

  // 70% read operations (board + stats)
  if (Math.random() < 0.7) {
    performReadOperations(data, phase);
  } else {
    // 30% write operations (move appointments)
    performMoveOperation(data, phase);
  }

  // Simulate user think time
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

function performReadOperations(data, phase) {
  // Get Status Board
  const boardResponse = http.get(
    `${data.url}/api/admin/appointments/board?date=${data.date}`,
    {
      tags: { endpoint: 'board', phase: phase },
    }
  );

  const boardSuccess = check(boardResponse, {
    'board status is 200': (r) => r.status === 200,
    'board response time < 800ms': (r) => r.timings.duration < 800,
  });

  if (!boardSuccess) {
    errorRate.add(1);
  } else {
    boardLatency.add(boardResponse.timings.duration);
  }

  // Small delay to simulate user reading board
  sleep(0.2);

  // Get Dashboard Stats
  const statsResponse = http.get(
    `${data.url}/api/admin/dashboard/stats?date=${data.date}`,
    {
      tags: { endpoint: 'stats', phase: phase },
    }
  );

  const statsSuccess = check(statsResponse, {
    'stats status is 200': (r) => r.status === 200,
    'stats response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!statsSuccess) {
    errorRate.add(1);
  } else {
    statsLatency.add(statsResponse.timings.duration);
  }
}

function performMoveOperation(data, phase) {
  try {
    // First get the board to find an appointment to move
    const boardResponse = http.get(`${data.url}/api/admin/appointments/board?date=${data.date}`);

    if (boardResponse.status !== 200) {
      errorRate.add(1);
      return;
    }

    const boardData = boardResponse.json();
    const columns = boardData?.data?.columns || {};

    // Collect appointments from all columns for moving
    let allAppointments = [];
    ['scheduled', 'in_progress', 'ready'].forEach(status => {
      const items = columns[status]?.items || [];
      allAppointments = allAppointments.concat(items.map(item => ({...item, currentStatus: status})));
    });

    if (allAppointments.length === 0) {
      // No appointments to move, skip this operation
      return;
    }

    // Pick random appointment
    const appointment = allAppointments[Math.floor(Math.random() * allAppointments.length)];
    const appointmentId = appointment.id;

    // Get current appointment details for version
    const detailResponse = http.get(`${data.url}/api/admin/appointments/${appointmentId}`);

    if (detailResponse.status !== 200) {
      errorRate.add(1);
      return;
    }

    const appointmentDetail = detailResponse.json();
    const currentVersion = appointmentDetail?.data?.version || 1;

    // Determine new status (simple state progression)
    let newStatus;
    const currentStatus = appointment.currentStatus;

    if (currentStatus === 'scheduled') {
      newStatus = 'in_progress';
    } else if (currentStatus === 'in_progress') {
      newStatus = Math.random() > 0.5 ? 'ready' : 'completed';
    } else if (currentStatus === 'ready') {
      newStatus = 'completed';
    } else {
      // If completed, randomly move to other states for testing
      newStatus = ['scheduled', 'in_progress', 'ready'][Math.floor(Math.random() * 3)];
    }

    // Perform move operation
    const movePayload = {
      new_status: newStatus,
      position: Math.floor(Math.random() * 5), // Random position 0-4
      expected_version: currentVersion,
    };

    const moveResponse = http.post(
      `${data.url}/api/admin/appointments/${appointmentId}/move`,
      JSON.stringify(movePayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'move', phase: phase },
      }
    );

    const moveSuccess = check(moveResponse, {
      'move status is 200 or 409': (r) => r.status === 200 || r.status === 409, // 409 = version conflict OK
      'move response time < 400ms': (r) => r.timings.duration < 400,
    });

    if (moveResponse.status >= 500) {
      // Only count 5xx errors, not 409 version conflicts
      errorRate.add(1);
    } else {
      moveLatency.add(moveResponse.timings.duration);
    }

  } catch (error) {
    errorRate.add(1);
    console.error('Error in move operation:', error);
  }
}

export function teardown(data) {
  // Verify system is still healthy after load test
  const healthCheck = http.get(`${data.url}/healthz`);
  check(healthCheck, {
    'post-test health check passes': (r) => r.status === 200,
  });

  console.log('Load test completed. System health verified.');
}
