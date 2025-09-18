#!/bin/bash
# Server Test Manager - Handles Flask server lifecycle for testing

SERVER_PID_FILE=".server.pid"
SERVER_LOG_FILE="server.log"
SERVER_PORT=3001
HEALTH_ENDPOINT="http://localhost:${SERVER_PORT}/health"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

start_server() {
    if [ -f "$SERVER_PID_FILE" ]; then
        PID=$(cat "$SERVER_PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            log_warning "Server already running with PID $PID"
            return 1
        else
            log_info "Removing stale PID file"
            rm "$SERVER_PID_FILE"
        fi
    fi

    log_info "Starting Flask server on port $SERVER_PORT..."

    # Start server with proper configuration
    cd backend
    FALLBACK_TO_MEMORY=true JWT_SECRET=test-secret LOG_LEVEL=WARNING python local_server.py > "../$SERVER_LOG_FILE" 2>&1 &
    SERVER_PID=$!
    cd ..

    echo $SERVER_PID > "$SERVER_PID_FILE"

    # Wait for server to start
    log_info "Waiting for server to start (PID: $SERVER_PID)..."

    for i in {1..30}; do
        if curl -s -f "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            log_info "Server started successfully!"
            return 0
        fi

        # Check if process is still running
        if ! ps -p "$SERVER_PID" > /dev/null 2>&1; then
            log_error "Server process died! Check $SERVER_LOG_FILE for details"
            tail -20 "$SERVER_LOG_FILE"
            rm "$SERVER_PID_FILE"
            return 1
        fi

        echo -n "."
        sleep 1
    done

    log_error "Server failed to respond after 30 seconds"
    stop_server
    return 1
}

stop_server() {
    if [ ! -f "$SERVER_PID_FILE" ]; then
        log_warning "No PID file found. Server may not be running."

        # Try to find Flask processes anyway
        FLASK_PIDS=$(ps aux | grep -E '[p]ython.*local_server\.py' | awk '{print $2}')
        if [ -n "$FLASK_PIDS" ]; then
            log_info "Found Flask processes: $FLASK_PIDS"
            echo "$FLASK_PIDS" | xargs kill -TERM 2>/dev/null
            sleep 2
            echo "$FLASK_PIDS" | xargs kill -KILL 2>/dev/null || true
            log_info "Killed orphaned Flask processes"
        fi
        return 0
    fi

    PID=$(cat "$SERVER_PID_FILE")

    if ps -p "$PID" > /dev/null 2>&1; then
        log_info "Stopping server (PID: $PID)..."
        kill -TERM "$PID" 2>/dev/null

        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! ps -p "$PID" > /dev/null 2>&1; then
                log_info "Server stopped gracefully"
                rm "$SERVER_PID_FILE"
                return 0
            fi
            sleep 1
        done

        # Force kill if necessary
        log_warning "Server didn't stop gracefully, forcing..."
        kill -KILL "$PID" 2>/dev/null || true
        rm "$SERVER_PID_FILE"
    else
        log_warning "Server process not found (PID: $PID)"
        rm "$SERVER_PID_FILE"
    fi
}

test_server() {
    log_info "Testing server endpoints..."

    # Test health endpoint
    log_info "Testing health endpoint..."
    RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" = "200" ]; then
        log_info "Health check passed! Response: $BODY"
    else
        log_error "Health check failed! HTTP $HTTP_CODE"
        return 1
    fi

    # Test admin appointments endpoint (T-007 requirement)
    log_info "Testing admin appointments endpoint..."
    ADMIN_ENDPOINT="http://localhost:${SERVER_PORT}/api/admin/appointments"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$ADMIN_ENDPOINT" -H "Content-Type: application/json" 2>/dev/null)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" = "200" ]; then
        log_info "Admin appointments endpoint passed! Testing envelope structure..."

        # Test envelope structure using jq (T-007 requirement)
        ERRORS_FIELD=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('errors', 'MISSING'))")

        if [ "$ERRORS_FIELD" = "None" ]; then
            log_info "✅ SUCCESS: .errors field is null as expected (T-007 requirement met!)"
            log_info "Response structure: $BODY"
        else
            log_error "❌ FAILURE: .errors field is not null, got: $ERRORS_FIELD"
            return 1
        fi
    else
        log_error "Admin appointments endpoint failed! HTTP $HTTP_CODE"
        log_error "Response: $BODY"
        return 1
    fi

    log_info "🎉 All T-007 tests passed!"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if local_server.py exists
    if [ ! -f "backend/local_server.py" ]; then
        log_error "backend/local_server.py not found!"
        return 1
    fi

    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed!"
        return 1
    fi

    # Check if port is already in use
    if lsof -i ":$SERVER_PORT" > /dev/null 2>&1; then
        log_warning "Port $SERVER_PORT is already in use!"
        log_info "Processes using port $SERVER_PORT:"
        lsof -i ":$SERVER_PORT"
        return 1
    fi

    return 0
}

fix_server_config() {
    log_info "Checking current server configuration..."

    # Check for debug mode in local_server.py
    if grep -q "debug=True" backend/local_server.py; then
        log_warning "Debug mode is enabled - this can cause issues with background running"
        log_info "Creating backup and fixing..."

        cp backend/local_server.py backend/local_server.py.backup
        sed -i '' 's/debug=True/debug=False/g' backend/local_server.py
        log_info "Fixed debug mode in backend/local_server.py"
    else
        log_info "Debug mode is already disabled"
    fi

    # Check host binding
    if grep -q 'host="0.0.0.0"' backend/local_server.py; then
        log_info "Server is configured to bind to all interfaces (good)"
    else
        log_warning "Server may not be binding to all interfaces"
    fi

    log_info "Server configuration check complete"
}

# Main script logic
case "${1:-help}" in
    start)
        check_prerequisites && start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 2
        check_prerequisites && start_server
        ;;
    test)
        test_server
        ;;
    status)
        if [ -f "$SERVER_PID_FILE" ]; then
            PID=$(cat "$SERVER_PID_FILE")
            if ps -p "$PID" > /dev/null 2>&1; then
                log_info "Server is running (PID: $PID)"
                ps -f -p "$PID"
            else
                log_warning "Server is not running (stale PID: $PID)"
            fi
        else
            log_info "Server is not running (no PID file)"
        fi
        ;;
    logs)
        if [ -f "$SERVER_LOG_FILE" ]; then
            tail -f "$SERVER_LOG_FILE"
        else
            log_error "No log file found"
        fi
        ;;
    fix)
        fix_server_config
        ;;
    clean)
        stop_server
        rm -f "$SERVER_PID_FILE" "$SERVER_LOG_FILE"
        log_info "Cleaned up server files"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|test|status|logs|fix|clean}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the Flask server"
        echo "  stop     - Stop the Flask server"
        echo "  restart  - Restart the Flask server"
        echo "  test     - Test server endpoints (includes T-007 validation)"
        echo "  status   - Check server status"
        echo "  logs     - Tail server logs"
        echo "  fix      - Fix server configuration issues"
        echo "  clean    - Clean up all server files"
        ;;
esac
