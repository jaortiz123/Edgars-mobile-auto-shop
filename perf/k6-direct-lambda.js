import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { createSigV4Params } from './aws-sig-v4.js';

// Custom metrics for detailed tracking
const boardLatency = new Trend('board_latency');
const statsLatency = new Trend('stats_latency');
const moveLatency = new Trend('move_latency');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    // Quick performance test - 20 VUs for 60s to match Sprint 4 testing
    performance: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      tags: { phase: 'performance' },
    },
  },

  // Sprint 5 thresholds - targeting <400ms p95
  thresholds: {
    'http_req_failed': ['rate<0.005'],
    'http_req_duration{endpoint:board}': ['p(95)<400'],   // Sprint 5 target
    'http_req_duration{endpoint:stats}': ['p(95)<400'],   // Sprint 5 target
    'http_req_duration{endpoint:move}': ['p(95)<400'],    // Sprint 5 target
    'board_latency': ['p(95)<400'],
    'stats_latency': ['p(95)<400'],
    'move_latency': ['p(95)<400'],
    'error_rate': ['rate<0.005'],
  },
};

// Direct Lambda Function URL (bypassing localhost:8080 SigV4 proxy)
const LAMBDA_URL = 'https://onourabnw45tm2rrq72gegkgai0codqj.lambda-url.us-west-2.on.aws';
const DATE = __ENV.TEST_DATE || '2025-01-15';

// AWS credentials from environment
const AWS_ACCESS_KEY_ID = __ENV.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = __ENV.AWS_SECRET_ACCESS_KEY;
const AWS_SESSION_TOKEN = __ENV.AWS_SESSION_TOKEN;

export function setup() {
  console.log(`Direct Lambda testing URL: ${LAMBDA_URL}`);
  console.log(`Test date: ${DATE}`);

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials required for direct Lambda testing');
  }

  return { url: LAMBDA_URL, date: DATE };
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
  sleep(Math.random() * 2 + 0.5);
}

function performReadOperations(data) {
  // Get Status Board with AWS SigV4
  const boardParams = createSigV4Params(
    'GET',
    `${data.url}/api/admin/appointments/board?date=${data.date}`,
    {},
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN
  );

  const boardResponse = http.get(
    `${data.url}/api/admin/appointments/board?date=${data.date}`,
    {
      headers: boardParams.headers,
      tags: { endpoint: 'board', phase: 'performance' },
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
  const statsParams = createSigV4Params(
    'GET',
    `${data.url}/api/admin/dashboard/stats?date=${data.date}`,
    {},
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN
  );

  const statsResponse = http.get(
    `${data.url}/api/admin/dashboard/stats?date=${data.date}`,
    {
      headers: statsParams.headers,
      tags: { endpoint: 'stats', phase: 'performance' },
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
  const boardParams = createSigV4Params(
    'GET',
    `${data.url}/api/admin/appointments/board?date=${data.date}`,
    {},
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN
  );

  const boardResponse = http.get(
    `${data.url}/api/admin/appointments/board?date=${data.date}`,
    { headers: boardParams.headers }
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

  const moveParams = createSigV4Params(
    'POST',
    `${data.url}/api/admin/appointments/${pick.id}/move`,
    moveBody,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN
  );

  const moveResponse = http.post(
    `${data.url}/api/admin/appointments/${pick.id}/move`,
    moveBody,
    {
      headers: {
        ...moveParams.headers,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'move', phase: 'performance' },
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
