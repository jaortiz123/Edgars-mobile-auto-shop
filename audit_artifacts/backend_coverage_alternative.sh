#!/usr/bin/env bash
set -euo pipefail

# Alternative backend coverage/info collection when Docker is unavailable.
# Collects function/method counts, Python file list, and lints as proxy metrics.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/audit_artifacts"
mkdir -p "$OUT_DIR"

echo "== Python files (backend) ==" | tee "$OUT_DIR/backend_files.txt"
find "$ROOT_DIR/backend" -type f -name "*.py" | sort | tee -a "$OUT_DIR/backend_files.txt"

echo "== Function definitions (backend) ==" | tee "$OUT_DIR/backend_function_counts.txt"
grep -RnoE '^[[:space:]]*def[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*\(' "$ROOT_DIR/backend" \
	| tee "$OUT_DIR/backend_function_index.txt" \
	| wc -l | awk '{print "TOTAL_FUNCTION_DEFS=" $1}' | tee -a "$OUT_DIR/backend_function_counts.txt"

echo "== Class definitions (backend) ==" | tee -a "$OUT_DIR/backend_function_counts.txt"
grep -RnoE '^[[:space:]]*class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' "$ROOT_DIR/backend" \
	| wc -l | awk '{print "TOTAL_CLASS_DEFS=" $1}' | tee -a "$OUT_DIR/backend_function_counts.txt"

echo "== Python test files (backend) ==" | tee "$OUT_DIR/backend_test_files.txt"
find "$ROOT_DIR/backend" -type f \( -name "test_*.py" -o -name "*_test.py" \) | sort | tee -a "$OUT_DIR/backend_test_files.txt"

echo "== Summary ==" | tee "$OUT_DIR/backend_alt_summary.txt"
{
	echo "PY_FILES=$(find "$ROOT_DIR/backend" -type f -name '*.py' | wc -l | tr -d ' ')"
	echo "TEST_FILES=$(find "$ROOT_DIR/backend" -type f \( -name 'test_*.py' -o -name '*_test.py' \) | wc -l | tr -d ' ')"
	echo "FUNCTIONS=$(wc -l < "$OUT_DIR/backend_function_index.txt" | tr -d ' ')"
} | tee -a "$OUT_DIR/backend_alt_summary.txt"

echo "Alternative backend metrics written to $OUT_DIR"
