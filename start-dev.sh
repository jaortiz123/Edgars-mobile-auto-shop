#!/bin/bash
# Edgar's Auto Shop - One-command startup script
# This script starts all services needed for development

set -Eeuo pipefail

# Always run from the repo root (the directory of this script)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Edgar's Mobile Auto Shop Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mode: interactive monitoring or not (default: monitor)
MONITOR=true
MONITOR_DURATION=""
for arg in "$@"; do
  case "$arg" in
    --no-monitor|--non-interactive|--ci|--headless)
      MONITOR=false
      ;;
    --monitor-duration=*)
      MONITOR=true
      MONITOR_DURATION="${arg#*=}"
      ;;
  esac
done
# Also honor environment variables
if [ -n "${NO_MONITOR:-}" ] || [ -n "${CI:-}" ]; then
  MONITOR=false
fi
# Allow MONITOR_TIMEOUT or MONITOR_DURATION env to control timeout
if [ -z "$MONITOR_DURATION" ]; then
  MONITOR_DURATION="${MONITOR_DURATION:-${MONITOR_TIMEOUT:-}}"
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Docker compose helper - prefers modern "docker compose" with fallback to "docker-compose"
compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        echo "❌ docker compose not found" >&2
        return 127
    fi
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}Waiting for $service to be ready...${NC}"
    while [ $attempt -le $max_attempts ]; do
        if [ "$service" = "PostgreSQL" ]; then
            # Special check for PostgreSQL using docker exec
            if compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $service is ready!${NC}"
                return 0
            fi
        else
            # Prefer a strict health check when URL ends with /health
            if [[ "$url" == *"/health"* ]]; then
                res="$(curl -fsS "$url" 2>/dev/null || true)"
                if echo "$res" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
                    echo -e "${GREEN}✅ $service is ready!${NC}"
                    return 0
                fi
            else
                # Generic readiness: HTTP 2xx/3xx
                code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo 000)"
                if [[ "$code" =~ ^2|3 ]]; then
                    echo -e "${GREEN}✅ $service is ready!${NC}"
                    return 0
                fi
            fi
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e "${RED}❌ $service failed to start after $max_attempts seconds${NC}"
    return 1
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check for docker compose (either form)
if ! docker compose version >/dev/null 2>&1 && ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo -e "${YELLOW}Install with: docker plugin install compose (for Docker 20.10+)${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ Node.js/npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites are available${NC}"

# Load environment files if present (without failing if missing)
# Allows keeping secrets locally in .env or .env.local, both are gitignored.
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi
if [ -f .env.local ]; then
    set -a
    # shellcheck disable=SC1091
    source .env.local
    set +a
fi

# Provide default Postgres credentials if not supplied by user env (align with existing volume)
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-edgar_db}"

#############################################
# Ensure Docker daemon is running (with timeout)
#############################################
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}Attempting to start Docker Desktop...${NC}"
    # Try to launch Docker Desktop (macOS). No-op elsewhere
    open -a Docker >/dev/null 2>&1 || true

    # Timeout (default 120s) can be overridden for CI/testing via DOCKER_STARTUP_TIMEOUT
    DOCKER_STARTUP_TIMEOUT="${DOCKER_STARTUP_TIMEOUT:-120}"
    if ! [[ "$DOCKER_STARTUP_TIMEOUT" =~ ^[0-9]+$ ]]; then
      DOCKER_STARTUP_TIMEOUT=120
    fi

    echo -e "${YELLOW}Waiting for Docker daemon to become available (timeout: ${DOCKER_STARTUP_TIMEOUT}s)...${NC}"
    echo -e "${YELLOW}If Docker Desktop doesn't start automatically, please open it manually.${NC}"
    start_time=$(date +%s)
    attempt=0
    while ! docker info >/dev/null 2>&1; do
        sleep 2
        attempt=$((attempt + 1))
        now=$(date +%s)
        elapsed=$((now - start_time))

        # Show progress every 10 seconds
        if [ $((elapsed % 10)) -eq 0 ] && [ $elapsed -gt 0 ]; then
            echo -e "${YELLOW}Still waiting for Docker daemon... (${elapsed}/${DOCKER_STARTUP_TIMEOUT}s)${NC}"
        fi

        if [ "$elapsed" -ge "$DOCKER_STARTUP_TIMEOUT" ]; then
            echo -e "${RED}❌ ERROR: Docker daemon failed to start within ${DOCKER_STARTUP_TIMEOUT}s.${NC}"
            echo -e "${RED}   Please open Docker Desktop manually and try again.${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ Docker is running${NC}"
fi

# Start database and Redis services
echo -e "${BLUE}🗄️ Starting database services...${NC}"
compose up -d db redis

# Wait for database to be ready
wait_for_service "postgresql" "PostgreSQL" || exit 1

# Run raw SQL migrations (idempotent) before starting backend - only if the script exists
if [ -f "backend/run_sql_migrations.py" ]; then
        echo -e "${BLUE}🧱 Applying raw SQL migrations (idempotent)...${NC}"
        if [ "${MIGRATIONS_USE_REMOTE_DB:-false}" = true ]; then
            # Use MIGRATIONS_DATABASE_URL if set, otherwise fall back to DATABASE_URL/POSTGRES_*
            python3 backend/run_sql_migrations.py || { echo -e "${RED}❌ Raw SQL migrations failed${NC}"; exit 1; }
        else
            # Force migrations against local docker Postgres regardless of .env
            LOCAL_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
            env MIGRATIONS_DATABASE_URL="$LOCAL_URL" python3 backend/run_sql_migrations.py || { echo -e "${RED}❌ Raw SQL migrations failed${NC}"; exit 1; }
        fi
fi

# Kill any existing backend processes on port 3001
if port_in_use 3001; then
    echo -e "${YELLOW}🔄 Stopping existing backend process...${NC}"
    kill $(lsof -ti:3001) 2>/dev/null || true
    sleep 2
fi

# Start backend with correct configuration (from backend directory)
echo -e "${BLUE}⚙️ Starting backend server...${NC}"
cd backend
LOCAL_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
if [ "${USE_REMOTE_DB:-false}" = true ]; then
    # Use DATABASE_URL/POSTGRES_* from env as-is (remote)
    if [ "$MONITOR" = true ]; then
        HOST=0.0.0.0 PORT=3001 DEV_NO_AUTH=true python3 local_server.py &
    else
        nohup env HOST=0.0.0.0 PORT=3001 DEV_NO_AUTH=true python3 local_server.py >> ../server.log 2>&1 &
    fi
else
    # Force local DB for backend by overriding DATABASE_URL
    if [ "$MONITOR" = true ]; then
        HOST=0.0.0.0 PORT=3001 DEV_NO_AUTH=true DATABASE_URL="$LOCAL_URL" python3 local_server.py &
    else
        nohup env HOST=0.0.0.0 PORT=3001 DEV_NO_AUTH=true DATABASE_URL="$LOCAL_URL" python3 local_server.py >> ../server.log 2>&1 &
    fi
fi
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
wait_for_service "http://localhost:3001/health" "Backend API" || exit 1

# Kill any existing frontend processes on port 5173
if port_in_use 5173; then
    echo -e "${YELLOW}🔄 Stopping existing frontend process...${NC}"
    kill $(lsof -ti:5173) 2>/dev/null || true
    sleep 2
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Start frontend
echo -e "${BLUE}🎨 Starting frontend server...${NC}"
cd frontend
if [ "$MONITOR" = true ]; then
  npm run dev &
else
  nohup npm run dev >> ../frontend.dev.log 2>&1 &
fi
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
wait_for_service "http://localhost:5173" "Frontend" || exit 1

echo ""
echo -e "${GREEN}🎉 SUCCESS! Edgar's Auto Shop is now running:${NC}"
echo -e "${GREEN}   • Frontend: http://localhost:5173${NC}"
echo -e "${GREEN}   • Backend API: http://localhost:3001${NC}"
echo -e "${GREEN}   • Admin Dashboard: http://localhost:5173/admin/dashboard${NC}"
echo -e "${GREEN}   • Database: PostgreSQL on localhost:5432${NC}"
echo -e "${GREEN}   • Redis: localhost:6379${NC}"
echo ""
echo -e "${BLUE}📊 Quick health check:${NC}"
curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null || echo "Backend API responding"
echo ""
echo -e "${YELLOW}📝 To stop all services, press Ctrl+C or run: ./stop-dev.sh${NC}"
echo -e "${YELLOW}📝 Logs are available in the terminal where each service was started${NC}"

# Create stop script with compose helper
cat > stop-dev.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Edgar's Auto Shop development environment..."

# Docker compose helper - prefers modern "docker compose" with fallback
compose() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        echo "Compose not found; skipping container stop"
        return 127
    fi
}

# Stop frontend and backend processes
if pgrep -f "vite" > /dev/null; then
    echo "Stopping frontend..."
    pkill -f "vite"
fi

if pgrep -f "local_server.py" > /dev/null; then
    echo "Stopping backend..."
    pkill -f "local_server.py"
fi

# Stop Docker services
echo "Stopping database services..."
compose stop db redis

echo "✅ All services stopped"
EOF

chmod +x stop-dev.sh

# If in non-interactive mode, skip monitoring and exit cleanly
if [ "$MONITOR" != true ]; then
  echo -e "${BLUE}ℹ️ Non-interactive mode: skipping monitoring. Use ./stop-dev.sh to stop services.${NC}"
  echo -e "${BLUE}ℹ️ Backend logs: server.log${NC}"
  echo -e "${BLUE}ℹ️ Frontend logs: frontend.dev.log${NC}"
  exit 0
fi

# Keep the script running to monitor services (with finite timeout)
trap 'echo -e "\n${YELLOW}🔌 Detaching monitor. Services are still running.${NC}\n${YELLOW}Use ./stop-dev.sh to stop all services.${NC}"; exit 0' INT

# Default monitor timeout to 20s if not provided
MONITOR_TIMEOUT_SEC="${MONITOR_DURATION:-20}"
# Validate it's a positive integer
if ! [[ "$MONITOR_TIMEOUT_SEC" =~ ^[0-9]+$ ]]; then
  MONITOR_TIMEOUT_SEC=20
fi

start_time=$(date +%s)
echo -e "${BLUE}🔍 Monitoring services for up to ${MONITOR_TIMEOUT_SEC}s. Press Ctrl+C to detach sooner (services keep running).${NC}"
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Backend process died${NC}"
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Frontend process died${NC}"
        break
    fi
    now=$(date +%s)
    if [ $((now - start_time)) -ge "$MONITOR_TIMEOUT_SEC" ]; then
        echo -e "${YELLOW}⏱️ Monitor timeout reached (${MONITOR_TIMEOUT_SEC}s). Detaching. Services are still running.${NC}\n${YELLOW}Use ./stop-dev.sh to stop all services.${NC}"
        exit 0
    fi
    sleep 5
done
