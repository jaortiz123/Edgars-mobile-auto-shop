#!/bin/bash

# Test script for CI coverage threshold checking
echo "📊 Testing CI Coverage Threshold Logic..."

if [ ! -f coverage/coverage-summary.json ]; then
  echo "❌ Coverage report not found"
  exit 1
fi

# Extract coverage percentages
statements=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.statements.pct")
branches=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.branches.pct")
funcs=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.functions.pct")
lines=$(node -p "JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json')).total.lines.pct")

echo "📈 Coverage Results:"
echo "  Statements: ${statements}% (CI threshold: 60%)"
echo "  Branches: ${branches}% (CI threshold: 50%)"
echo "  Functions: ${funcs}% (CI threshold: 60%)"
echo "  Lines: ${lines}% (CI threshold: 60%)"

# Install bc if not present (simulating CI environment)
if ! command -v bc &> /dev/null; then
  echo "🧮 bc calculator not found - would install in CI"
  echo "sudo apt-get update && sudo apt-get install -y bc"
else
  echo "🧮 bc calculator available"
fi

echo ""
echo "🔍 CI Threshold Checks:"

# Check if coverage meets CI thresholds (using shell arithmetic instead of bc for compatibility)
if (( $(echo "$statements < 60" | bc -l 2>/dev/null || echo "1") )); then
  echo "❌ Statements coverage ${statements}% is below CI threshold of 60%"
  FAILED=1
else
  echo "✅ Statements coverage ${statements}% meets CI threshold"
fi

if (( $(echo "$branches < 50" | bc -l 2>/dev/null || echo "1") )); then
  echo "❌ Branches coverage ${branches}% is below CI threshold of 50%"
  FAILED=1
else
  echo "✅ Branches coverage ${branches}% meets CI threshold"
fi

if (( $(echo "$funcs < 60" | bc -l 2>/dev/null || echo "1") )); then
  echo "❌ Functions coverage ${funcs}% is below CI threshold of 60%"
  FAILED=1
else
  echo "✅ Functions coverage ${funcs}% meets CI threshold"
fi

if (( $(echo "$lines < 60" | bc -l 2>/dev/null || echo "1") )); then
  echo "❌ Lines coverage ${lines}% is below CI threshold of 60%"
  FAILED=1
else
  echo "✅ Lines coverage ${lines}% meets CI threshold"
fi

echo ""
if [ "${FAILED}" = "1" ]; then
  echo "❌ Coverage does not meet CI minimum thresholds"
  echo "💡 Note: CI uses lower thresholds (60%/50%) while vitest.config.ts enforces higher standards (80%/75%)"
  exit 1
else
  echo "✅ Coverage meets CI minimum thresholds"
fi
