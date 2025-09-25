#!/usr/bin/env node

/**
 * Test Status Board API endpoints
 * Tests the new GET /api/admin/appointments/board and related endpoints
 */

const https = require('https');

const API_BASE = 'https://zqz4buacq2lmijsk3xcdr33dmy0ixcqt.lambda-url.us-west-2.on.aws';

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StatusBoard-Test/1.0'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, body });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, body, error: 'Invalid JSON' });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testStatusBoardAPI() {
  console.log('🧪 Testing Status Board API endpoints...\n');

  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const health = await makeRequest('/healthz');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response:`, JSON.stringify(health.data, null, 2));
  } catch (e) {
    console.log(`   Error:`, e.message);
  }

  // Test 2: Status Board endpoint
  console.log('\n2. Testing Status Board endpoint...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const board = await makeRequest(`/api/admin/appointments/board?date=${today}`);
    console.log(`   Status: ${board.status}`);
    console.log(`   Response:`, JSON.stringify(board.data, null, 2));
  } catch (e) {
    console.log(`   Error:`, e.message);
  }

  // Test 3: Dashboard stats endpoint
  console.log('\n3. Testing Dashboard stats endpoint...');
  try {
    const stats = await makeRequest('/api/admin/dashboard/stats');
    console.log(`   Status: ${stats.status}`);
    console.log(`   Response:`, JSON.stringify(stats.data, null, 2));
  } catch (e) {
    console.log(`   Error:`, e.message);
  }

  // Test 4: Database initialization (reinitialize with Status Board schema)
  console.log('\n4. Testing Database reinitialization...');
  try {
    const initDb = await makeRequest('/api/admin/init-db', 'POST', {});
    console.log(`   Status: ${initDb.status}`);
    console.log(`   Response:`, JSON.stringify(initDb.data, null, 2));
  } catch (e) {
    console.log(`   Error:`, e.message);
  }

  // Test 5: Re-test Status Board after DB init
  console.log('\n5. Re-testing Status Board after DB init...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const board = await makeRequest(`/api/admin/appointments/board?date=${today}`);
    console.log(`   Status: ${board.status}`);
    console.log(`   Response:`, JSON.stringify(board.data, null, 2));

    if (board.data && board.data.data && board.data.data.board) {
      const boardData = board.data.data.board;
      console.log('\n   📊 Status Board Summary:');
      console.log(`   • Scheduled: ${boardData.scheduled?.length || 0} appointments`);
      console.log(`   • In Progress: ${boardData.in_progress?.length || 0} appointments`);
      console.log(`   • Ready: ${boardData.ready?.length || 0} appointments`);
      console.log(`   • Completed: ${boardData.completed?.length || 0} appointments`);
      console.log(`   • No Show: ${boardData.no_show?.length || 0} appointments`);
    }
  } catch (e) {
    console.log(`   Error:`, e.message);
  }

  console.log('\n✅ Status Board API test completed!');
}

// Run the test
testStatusBoardAPI().catch(console.error);
