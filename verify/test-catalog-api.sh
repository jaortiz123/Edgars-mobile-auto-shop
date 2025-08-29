#!/usr/bin/env bash
# file: test-catalog-api.sh
# Catalog/API shape & sort verification for Phase 2

set -euo pipefail

APP_URL=${APP_URL:-"http://localhost:3000"}
API_ENDPOINT="$APP_URL/api/admin/service-operations"

echo "🔍 Catalog API V2 Verification"
echo "=============================="
echo "Testing endpoint: $API_ENDPOINT"
echo ""

if ! command -v curl >/dev/null; then
    echo "❌ curl not available"
    exit 1
fi

if ! command -v jq >/dev/null; then
    echo "❌ jq not available - install with: brew install jq"
    exit 1
fi

echo "== Root Array Shape & V2 Fields =="
echo "Should be a root array and sorted by display_order asc, nulls last"

if response=$(curl -s -f "$API_ENDPOINT" 2>/dev/null); then
    echo "✅ API endpoint accessible"

    # Check if it's an array
    api_type=$(echo "$response" | jq -r 'type' 2>/dev/null)
    echo "Response type: $api_type"

    if [ "$api_type" = "array" ]; then
        echo "✅ Root array format (correct)"

        # Show first few items with v2 fields
        echo ""
        echo "First 8 items with V2 fields:"
        echo "$response" | jq '[.[0:8][] | {id,name,internal_code,subcategory,display_order}]' 2>/dev/null || {
            echo "⚠️  V2 fields not found or malformed response"
            echo "Raw first item:"
            echo "$response" | jq '.[0] // "no items"' 2>/dev/null || echo "Invalid JSON"
        }

        # Check sorting
        echo ""
        echo "Display order values (first 10):"
        echo "$response" | jq '.[0:10] | map(.display_order)' 2>/dev/null || echo "Could not extract display_order"

        # Test descending sort
        echo ""
        echo "== Descending Sort Test =="
        if desc_response=$(curl -s -f "$API_ENDPOINT?sort=display_order&dir=desc" 2>/dev/null); then
            echo "✅ Descending sort endpoint accessible"
            echo "Display order values (desc, first 8):"
            echo "$desc_response" | jq '.[0:8] | map(.display_order)' 2>/dev/null || echo "Could not extract display_order from desc response"
        else
            echo "⚠️  Descending sort endpoint not accessible or not implemented"
        fi

    elif [ "$api_type" = "object" ]; then
        echo "⚠️  Object format detected - checking for legacy wrapper"
        has_wrapper=$(echo "$response" | jq -r 'has("service_operations")' 2>/dev/null)
        if [ "$has_wrapper" = "true" ]; then
            echo "❌ Legacy wrapper format detected: {\"service_operations\":[...]}"
            echo "This will break the v2 modal sorting/grouping"
            echo "Follow your 'Stale Wrapper Debug Playbook' to remove duplicate handler"
        else
            echo "❌ Unknown object format"
            echo "Response keys:"
            echo "$response" | jq -r 'keys | join(", ")' 2>/dev/null || echo "Invalid object"
        fi
    else
        echo "❌ Unexpected response type: $api_type"
        echo "Raw response preview:"
        echo "$response" | head -c 200
    fi

else
    echo "❌ API endpoint not accessible"
    echo "Check that your application is running at $APP_URL"
    echo "Try: curl -v \"$API_ENDPOINT\""
fi

echo ""
echo "== Summary =="
echo "✅ Expected: Root array with internal_code, subcategory, display_order fields"
echo "✅ Expected: Sorted by display_order ASC NULLS LAST, name ASC"
echo "❌ Problem: Legacy wrapper {\"service_operations\":[...]} breaks v2 modal"
echo ""
echo "To fix wrapper issue:"
echo "1. Find duplicate route handler for /api/admin/service-operations"
echo "2. Ensure v2 handler (returning root array) owns the route"
echo "3. Remove or rename legacy wrapper handler"
