'use strict';

const https = require('https');
const http = require('http');

module.exports = {
  pickAppointment,
};

/**
 * Make HTTP GET request
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;

    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Pick a random appointment for move operations
 * This function fetches the current board state and selects an appointment
 * to move, then gets its version for optimistic concurrency control.
 */
async function pickAppointment(req, ctx, ee, next) {
  try {
    const baseUrl = process.env.URL;
    const testDate = process.env.TEST_DATE;

    if (!baseUrl || !testDate) {
      console.warn('Missing URL or TEST_DATE environment variables');
      return next();
    }

    // Get current board state
    const boardUrl = `${baseUrl}/api/admin/appointments/board?date=${testDate}`;
    const boardResponse = await httpGet(boardUrl);

    if (boardResponse.statusCode !== 200) {
      console.warn(`Board request failed with status ${boardResponse.statusCode}`);
      return next();
    }

    const boardData = JSON.parse(boardResponse.body);

    // Look for appointments in scheduled or in_progress columns
    const columns = boardData?.data?.columns || {};
    const scheduledItems = columns?.scheduled?.items || [];
    const inProgressItems = columns?.in_progress?.items || [];
    const allItems = [...scheduledItems, ...inProgressItems];

    if (allItems.length === 0) {
      console.warn('No appointments available for move operation');
      return next();
    }

    // Pick random appointment
    const randomAppointment = allItems[Math.floor(Math.random() * allItems.length)];
    const appointmentId = randomAppointment.id;

    // Get appointment details to fetch current version
    const detailUrl = `${baseUrl}/api/admin/appointments/${appointmentId}`;
    const detailResponse = await httpGet(detailUrl);

    if (detailResponse.statusCode !== 200) {
      console.warn(`Detail request failed with status ${detailResponse.statusCode} for appointment ${appointmentId}`);
      return next();
    }

    const appointmentDetail = JSON.parse(detailResponse.body);
    const currentVersion = appointmentDetail?.data?.version || 1;

    // Set variables for the request
    ctx.vars.apptId = appointmentId;
    ctx.vars.expectedVersion = currentVersion;

    // Vary the target status to create realistic load patterns
    const possibleStatuses = ['in_progress', 'ready', 'completed'];
    const currentStatus = randomAppointment.status || 'scheduled';

    // Simple state transition logic
    let newStatus;
    if (currentStatus === 'scheduled') {
      newStatus = 'in_progress';
    } else if (currentStatus === 'in_progress') {
      newStatus = Math.random() > 0.5 ? 'ready' : 'completed';
    } else {
      newStatus = possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)];
    }

    ctx.vars.newStatus = newStatus;
    ctx.vars.position = Math.floor(Math.random() * 5); // Random position 0-4

    return next();

  } catch (error) {
    console.error('Error in pickAppointment:', error.message);
    return next();
  }
}
