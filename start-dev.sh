#!/bin/bash
# Edgar's Auto Shop - One-command startup script
# This script starts all services needed for development

set -e

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
            if docker-compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $service is ready!${NC}"
                return 0
            fi
        else
            # HTTP service check
            if curl -s $url >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $service is ready!${NC}"
                return 0
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

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
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

# Provide default Postgres credentials if not supplied by user env
export POSTGRES_USER="${POSTGRES_USER:-user}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-password}"
export POSTGRES_DB="${POSTGRES_DB:-autoshop}"

# Start Docker if not running
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}Starting Docker Desktop...${NC}"
    open -a Docker
    echo -e "${YELLOW}Waiting for Docker to start...${NC}"
    while ! docker info >/dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo -e "${GREEN}✅ Docker is running${NC}"
fi

# Start database and Redis services
echo -e "${BLUE}🗄️ Starting database services...${NC}"
docker-compose up -d db redis

# Wait for database to be ready
wait_for_service "postgresql" "PostgreSQL" || exit 1

# Run raw SQL migrations (idempotent) before starting backend
echo -e "${BLUE}🧱 Applying raw SQL migrations (idempotent)...${NC}"
python3 backend/run_sql_migrations.py || { echo -e "${RED}❌ Raw SQL migrations failed${NC}"; exit 1; }

# Kill any existing backend processes on port 3001
if port_in_use 3001; then
    echo -e "${YELLOW}🔄 Stopping existing backend process...${NC}"
    kill $(lsof -ti:3001) 2>/dev/null || true
    sleep 2
fi

# Start backend with correct configuration
echo -e "${BLUE}⚙️ Starting backend server...${NC}"
cd backend
if [ "$MONITOR" = true ]; then
  HOST=0.0.0.0 PORT=3001 DEV_NO_AUTH=true POSTGRES_HOST=localhost POSTGRES_USER=${POSTGRES_USER} POSTGRES_PASSWORD=${POSTGRES_PASSWORD} POSTGRES_DB=${POSTGRES_DB} python3 local_server.py &
else
  nohup env HOST=0.0.0.0 PORT=3001 DEV_NO_AUTH=true POSTGRES_HOST=localhost POSTGRES_USER=${POSTGRES_USER} POSTGRES_PASSWORD=${POSTGRES_PASSWORD} POSTGRES_DB=${POSTGRES_DB} python3 local_server.py >> server.log 2>&1 &
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

# Create stop script
cat > stop-dev.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Edgar's Auto Shop development environment..."

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
docker-compose stop db redis

echo "✅ All services stopped"
EOF

chmod +x stop-dev.sh

# If in non-interactive mode, skip monitoring and exit cleanly
if [ "$MONITOR" != true ]; then
  echo -e "${BLUE}ℹ️ Non-interactive mode: skipping monitoring. Use ./stop-dev.sh to stop services.${NC}"
  echo -e "${BLUE}ℹ️ Backend logs: backend/server.log${NC}"
  echo -e "${BLUE}ℹ️ Frontend logs: frontend.dev.log (repo root)${NC}"
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
