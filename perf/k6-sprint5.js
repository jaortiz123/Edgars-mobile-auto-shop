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
    // Sprint 5 performance test - simplified
    performance: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      tags: { phase: 'sprint5' },
    },
  },

  // Sprint 5 thresholds - targeting <400ms p95
  thresholds: {
    'http_req_failed': ['rate<0.005'],
    'http_req_duration{endpoint:board}': ['p(95)<400'],
    'http_req_duration{endpoint:stats}': ['p(95)<400'],
    'http_req_duration{endpoint:move}': ['p(95)<400'],
    'board_latency': ['p(95)<400'],
    'stats_latency': ['p(95)<400'],
    'move_latency': ['p(95)<400'],
    'error_rate': ['rate<0.005'],
  },
};

const URL = __ENV.URL || 'http://localhost:8080';
const DATE = __ENV.TEST_DATE || '2025-01-15';

export function setup() {
  console.log(`Sprint 5 performance testing URL: ${URL}`);
  console.log(`Test date: ${DATE}`);

  // Verify endpoints are accessible
  const healthCheck = http.get(`${URL}/healthz`);
  if (healthCheck.status !== 200) {
    throw new Error(`Health check failed with status ${healthCheck.status}`);
  }

  console.log(`Health check passed - Lambda memory: 1024MB`);
  return { url: URL, date: DATE };
}

export default function (data) {
  // 70% read operations (board + stats)
  if (Math.random() < 0.7) {
    performReadOperations(data);
  } else {
    // 30% write operations (move appointments)
    performMoveOperation(data);
  }

  // Simulate user think time
  sleep(Math.random() * 1 + 0.5); // 0.5-1.5 seconds (faster for performance test)
}

function performReadOperations(data) {
  // Get Status Board
  const boardResponse = http.get(
    `${data.url}/api/admin/appointments/board?date=${data.date}`,
    {
      tags: { endpoint: 'board', phase: 'sprint5' },
    }
  );

  const boardSuccess = check(boardResponse, {
    'status board status is 200': (r) => r.status === 200,
    'status board has data': (r) => {
      try {
        const body = r.json();
        return body && body.data && body.data.columns;
      } catch (e) {
        return false;
      }
    },
  });

  if (boardSuccess) {
    boardLatency.add(boardResponse.timings.duration);
  } else {
    errorRate.add(1);
  }

  // Get Dashboard Stats
  const statsResponse = http.get(
    `${data.url}/api/admin/dashboard/stats?date=${data.date}`,
    {
      tags: { endpoint: 'stats', phase: 'sprint5' },
    }
  );

  const statsSuccess = check(statsResponse, {
    'dashboard stats status is 200': (r) => r.status === 200,
    'dashboard stats has data': (r) => {
      try {
        const body = r.json();
        return body && body.data;
      } catch (e) {
        return false;
      }
    },
  });

  if (statsSuccess) {
    statsLatency.add(statsResponse.timings.duration);
  } else {
    errorRate.add(1);
  }
}

function performMoveOperation(data) {
  // First get board to find appointments to move
  const boardResponse = http.get(
    `${data.url}/api/admin/appointments/board?date=${data.date}`
  );

  if (boardResponse.status !== 200) {
    errorRate.add(1);
    return;
  }

  let boardData;
  try {
    boardData = boardResponse.json();
  } catch (e) {
    errorRate.add(1);
    return;
  }

  const columns = boardData?.data?.columns;
  if (!columns) {
    return;
  }

  // Pick appointments based on valid workflow transitions
  let pick, new_status;
  if (columns?.scheduled?.items?.length > 0) {
    pick = columns.scheduled.items[0];
    new_status = 'in_progress';
  } else if (columns?.in_progress?.items?.length > 0) {
    pick = columns.in_progress.items[0];
    new_status = 'ready';
  } else if (columns?.ready?.items?.length > 0) {
    pick = columns.ready.items[0];
    new_status = 'completed';
  }

  if (!pick) {
    return;
  }

  // Perform the move operation
  const moveBody = JSON.stringify({
    new_status: new_status,
    expected_version: pick.version,
    position: 0
  });

  const moveResponse = http.post(
    `${data.url}/api/admin/appointments/${pick.id}/move`,
    moveBody,
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'move', phase: 'sprint5' },
    }
  );

  const moveSuccess = check(moveResponse, {
    'move operation status is 200': (r) => r.status === 200,
    'move operation has result': (r) => {
      try {
        const body = r.json();
        return body && (body.success || body.data);
      } catch (e) {
        return false;
      }
    },
  });

  if (moveSuccess) {
    moveLatency.add(moveResponse.timings.duration);
  } else {
    errorRate.add(1);
  }
}
