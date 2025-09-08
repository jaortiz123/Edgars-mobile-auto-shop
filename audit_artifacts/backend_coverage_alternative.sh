#!/bin/bash
# Backend Coverage Alternative Script
# Alternative approach to run backend tests without full Docker dependency

echo "🔍 Backend Coverage Analysis - Alternative Approach"
echo "=================================================="

# Check if Python environment is ready
if [ ! -f .venv/bin/python ]; then
    echo "❌ Python virtual environment not found"
    exit 1
fi

echo "✅ Python environment: $(.venv/bin/python --version)"

# Try to run backend analysis without testcontainers
echo ""
echo "📊 Attempting backend test analysis..."

# Option 1: Try to run tests with fallback database
export FALLBACK_TO_MEMORY=true
export DISABLE_DB_CONFIG_CACHE=true
export TEST_MODE=memory

# Try minimal test execution
echo "🧪 Testing individual modules..."

# Test validation module (likely pure unit tests)
echo "  • Testing validation.py..."
.venv/bin/python -c "
import sys, os
sys.path.insert(0, './backend')
try:
    from validation import validate_appointment_payload, find_conflicts
    print('    ✅ validation module imports successfully')
    # Test a basic function
    result = validate_appointment_payload({
        'start_datetime': '2024-12-01T10:00:00Z',
        'end_datetime': '2024-12-01T11:00:00Z',
        'customer_id': 'test-123',
        'status': 'scheduled'
    })
    print('    ✅ validate_appointment_payload callable')
except Exception as e:
    print(f'    ❌ validation module error: {e}')
"

# Try to count test coverage without execution
echo ""
echo "📈 Code analysis metrics..."
find backend -name "*.py" -not -path "*/tests/*" | wc -l | xargs echo "  • Source files:"
find backend/tests -name "test_*.py" 2>/dev/null | wc -l | xargs echo "  • Test files:"

# Try basic linting/analysis
echo ""
echo "🔍 Static analysis..."
.venv/bin/python -c "
import ast
import os

def analyze_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())

        functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        classes = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]

        return len(functions), len(classes)
    except:
        return 0, 0

total_functions = 0
total_classes = 0

# Analyze main backend files
for root, dirs, files in os.walk('backend'):
    if 'tests' in root:
        continue
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            funcs, classes = analyze_file(filepath)
            total_functions += funcs
            total_classes += classes

print(f'  • Total functions in backend: {total_functions}')
print(f'  • Total classes in backend: {total_classes}')
"

echo ""
echo "💡 Recommendations:"
echo "  1. Fix Docker daemon connectivity to enable full pytest coverage"
echo "  2. Consider pytest-mock for database-independent testing"
echo "  3. Implement in-memory database fixtures for unit tests"
echo "  4. Use testcontainers alternatives (e.g., pytest-postgresql)"

echo ""
echo "📋 Coverage configuration ready at .coveragerc"
echo "⏳ Awaiting Docker resolution for complete backend coverage analysis"
