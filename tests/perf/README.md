# Performance Tests

## Overview

This directory contains performance smoke tests that ensure critical endpoints maintain acceptable response times.

## Tests

### `endpointLatency.test.js`
- **Purpose**: Measures latency of GET `/api/admin/appointments/board`
- **Threshold**: P95 < 500ms
- **Sample Size**: 20 requests
- **Runtime**: <1 second

## Usage

```bash
# Run performance tests
npm run test:perf

# With custom backend URL
BACKEND_URL=http://localhost:3001 npm run test:perf
```

## Output

- **JSON**: `test-results/performance-results.json` - Aggregated metrics
- **CSV**: `test-results/performance-latencies.csv` - Raw latency data

## CI Integration

Performance tests run automatically on:
- Pull requests
- Pushes to main/develop branches

Tests **fail the build** if P95 latency exceeds 500ms threshold.

## Configuration

See `CONFIG` object in `endpointLatency.test.js` for tunable parameters:
- Sample size
- P95 threshold
- Request timeout
- Target endpoint
