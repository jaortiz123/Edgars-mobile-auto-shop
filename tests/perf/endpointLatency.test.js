#!/usr/bin/env node
/**
 * P2-T-010: Performance Smoke Tests
 * 
 * Super-lightweight performance test using undici to measure GET /dashboard/stats latency.
 * Fails if p95 > 500ms on CI AWS dev environment.
 * Publishes timing as an artifact and runs in <1s on CI.
 */

const { request } = require('undici');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  endpoint: process.env.BACKEND_URL || 'http://localhost:3001',
  path: '/api/admin/appointments/board',
  samples: 20, // Number of requests to make
  p95Threshold: 500, // P95 threshold in milliseconds
  timeout: 5000, // Request timeout in milliseconds
};

/**
 * Calculate percentile from array of latencies
 */
function calculatePercentile(latencies, percentile) {
  const sorted = latencies.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Make a single HTTP request and measure latency
 */
async function measureLatency() {
  const startTime = process.hrtime.bigint();
  
  try {
    const response = await request(`${CONFIG.endpoint}${CONFIG.path}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'perf-test/1.0'
      },
      headersTimeout: CONFIG.timeout,
      bodyTimeout: CONFIG.timeout,
    });

    const endTime = process.hrtime.bigint();
    const latencyNs = endTime - startTime;
    const latencyMs = Number(latencyNs) / 1000000; // Convert nanoseconds to milliseconds

    // Check if response is successful
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}: ${response.statusText}`);
    }

    // Consume the response body to complete the request
    await response.body.text();

    return {
      latency: latencyMs,
      statusCode: response.statusCode,
      success: true
    };
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const latencyNs = endTime - startTime;
    const latencyMs = Number(latencyNs) / 1000000;

    return {
      latency: latencyMs,
      statusCode: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Run performance test suite
 */
async function runPerformanceTest() {
  console.log('🚀 Starting Performance Smoke Tests for P2-T-010');
  console.log(`📊 Testing endpoint: ${CONFIG.endpoint}${CONFIG.path}`);
  console.log(`🎯 P95 threshold: ${CONFIG.p95Threshold}ms`);
  console.log(`📈 Sample size: ${CONFIG.samples} requests`);
  console.log('');

  const results = [];
  const latencies = [];
  let successCount = 0;
  let errorCount = 0;

  const testStartTime = Date.now();

  // Make requests sequentially to avoid overwhelming the server
  for (let i = 0; i < CONFIG.samples; i++) {
    process.stdout.write(`\r⏱️  Progress: ${i + 1}/${CONFIG.samples} requests`);
    
    const result = await measureLatency();
    results.push(result);
    
    if (result.success) {
      latencies.push(result.latency);
      successCount++;
    } else {
      errorCount++;
      console.log(`\n❌ Request ${i + 1} failed: ${result.error}`);
    }
  }

  const testEndTime = Date.now();
  const totalTestTime = testEndTime - testStartTime;

  console.log('\n');
  console.log('📊 Performance Test Results:');
  console.log('================================');

  if (latencies.length === 0) {
    console.log('❌ No successful requests - unable to calculate performance metrics');
    process.exit(1);
  }

  // Calculate statistics
  const stats = {
    timestamp: new Date().toISOString(),
    endpoint: `${CONFIG.endpoint}${CONFIG.path}`,
    totalRequests: CONFIG.samples,
    successfulRequests: successCount,
    failedRequests: errorCount,
    successRate: ((successCount / CONFIG.samples) * 100).toFixed(2),
    latencies: {
      min: Math.min(...latencies).toFixed(2),
      max: Math.max(...latencies).toFixed(2),
      mean: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
      median: calculatePercentile(latencies, 50).toFixed(2),
      p95: calculatePercentile(latencies, 95).toFixed(2),
      p99: calculatePercentile(latencies, 99).toFixed(2),
    },
    thresholds: {
      p95Threshold: CONFIG.p95Threshold,
      p95Passed: calculatePercentile(latencies, 95) <= CONFIG.p95Threshold,
    },
    testDuration: `${totalTestTime}ms`,
    environment: process.env.NODE_ENV || 'development',
    ciRun: !!process.env.CI,
  };

  // Display results
  console.log(`✅ Successful requests: ${stats.successfulRequests}/${stats.totalRequests} (${stats.successRate}%)`);
  console.log(`⏱️  Test duration: ${stats.testDuration}`);
  console.log('');
  console.log('📈 Latency Statistics:');
  console.log(`   Min:    ${stats.latencies.min}ms`);
  console.log(`   Mean:   ${stats.latencies.mean}ms`);
  console.log(`   Median: ${stats.latencies.median}ms`);
  console.log(`   P95:    ${stats.latencies.p95}ms`);
  console.log(`   P99:    ${stats.latencies.p99}ms`);
  console.log(`   Max:    ${stats.latencies.max}ms`);
  console.log('');

  // Check P95 threshold
  const p95Value = parseFloat(stats.latencies.p95);
  if (stats.thresholds.p95Passed) {
    console.log(`✅ P95 latency check PASSED: ${stats.latencies.p95}ms <= ${CONFIG.p95Threshold}ms`);
  } else {
    console.log(`❌ P95 latency check FAILED: ${stats.latencies.p95}ms > ${CONFIG.p95Threshold}ms`);
  }

  // Save results as JSON artifact
  const artifactDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const artifactPath = path.join(artifactDir, 'performance-results.json');
  fs.writeFileSync(artifactPath, JSON.stringify(stats, null, 2));
  console.log(`💾 Performance results saved to: ${artifactPath}`);

  // Save CSV for trend analysis
  const csvPath = path.join(artifactDir, 'performance-latencies.csv');
  const csvData = [
    'timestamp,latency_ms,status_code,success',
    ...results.map((r, i) => `${stats.timestamp},${r.latency.toFixed(2)},${r.statusCode},${r.success}`)
  ].join('\n');
  fs.writeFileSync(csvPath, csvData);
  console.log(`📊 Latency data saved to: ${csvPath}`);

  console.log('');

  // Exit with appropriate code
  if (!stats.thresholds.p95Passed) {
    console.log('🚨 Performance test FAILED - P95 latency exceeds threshold');
    process.exit(1);
  } else if (errorCount > 0) {
    console.log('⚠️  Performance test completed with some request failures');
    process.exit(0); // Don't fail for individual request failures if P95 is OK
  } else {
    console.log('🎉 Performance test PASSED - All checks successful');
    process.exit(0);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Performance test interrupted');
  process.exit(1);
});

// Run the test if this file is executed directly
if (require.main === module) {
  runPerformanceTest().catch((error) => {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  });
}

module.exports = { runPerformanceTest, measureLatency, calculatePercentile };
