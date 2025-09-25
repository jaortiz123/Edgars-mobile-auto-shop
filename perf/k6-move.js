import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 20,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
  },
};

const URL = __ENV.URL;
const DATE = __ENV.DATE;

export default function () {
  // Get board, pick appointments to move through workflow
  let b = http.get(`${URL}/api/admin/appointments/board?date=${DATE}`).json();
  const col = b?.data?.columns;

  // Pick appointments based on valid workflow transitions
  let pick, new_status;
  if (col?.scheduled?.items?.length > 0) {
    pick = col.scheduled.items[0];
    new_status = 'in_progress';
  } else if (col?.in_progress?.items?.length > 0) {
    pick = col.in_progress.items[0];
    new_status = 'ready';
  } else if (col?.ready?.items?.length > 0) {
    pick = col.ready.items[0];
    new_status = 'completed';
  }

  if (!pick) {
    console.log('No appointments found to move');
    sleep(1);
    return;
  }

  // Log the appointment we're trying to move for debugging
  console.log(`Moving appointment ${pick.id} from status ${pick.status} to ${new_status}, version ${pick.version}`);

  const body = JSON.stringify({
    new_status: new_status,
    expected_version: pick.version,
    position: 0
  });

  const res = http.post(`${URL}/api/admin/appointments/${pick.id}/move`, body, {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, {
    '200 or 409': r => r.status === 200 || r.status === 409,
    'has response': r => r.body && r.body.length > 0
  });

  // Log conflicts for analysis
  if (res.status === 409) {
    console.log(`Conflict detected for appointment ${pick.id}: ${res.body}`);
  }

  sleep(0.5);
}
