# 🚀 Edgar's Mobile Auto Shop - Streamlined Development Setup

## Quick Start (One Command)

```bash
./quick-start.sh
```

That's it! This will start all services needed for development.

## What Gets Started

- ✅ **PostgreSQL Database** (Docker container on port 5432)
- ✅ **Redis Cache** (Docker container on port 6379)
- ✅ **Backend API** (Flask server on port 3001)
- ✅ **Frontend** (Vite React app on port 5173)

## Access Points

- **Main Application**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5173/admin/dashboard
- **API Health Check**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/api/admin/dashboard/stats

## Stopping Services

```bash
./stop-dev.sh
```

Or press `Ctrl+C` in the terminal running `quick-start.sh`

## Manual Development (Advanced)

If you prefer to start services individually:

```bash
# Start database services
npm run dev:services

# Start backend (in another terminal)
npm run dev:backend

# Start frontend (in another terminal)
npm run dev:frontend
```

## Environment Configuration

The system automatically detects the correct configuration:

- **Database**: PostgreSQL on localhost:5432 (when Docker is running)
- **Fallback**: SQLite if PostgreSQL is unavailable
- **Cache**: Redis on localhost:6379
- **Environment**: Development mode with proper CORS

## Troubleshooting

### Database Issues
```bash
# Check database status
docker-compose ps

# View database logs
docker-compose logs db

# Connect to database
npm run psql
```

### Port Conflicts
If ports are in use:
```bash
# Check what's using port 3001 (backend)
lsof -ti:3001

# Check what's using port 5173 (frontend)
lsof -ti:5173

# Kill processes if needed
kill $(lsof -ti:3001)
kill $(lsof -ti:5173)
```

### Reset Everything
```bash
# Stop all services
./stop-dev.sh

# Remove containers and volumes
docker-compose down -v

# Restart fresh
./quick-start.sh
```

## Development Workflow

1. **Start Development**: `./quick-start.sh`
2. **Make Changes**: Edit files in `frontend/` or `backend/`
3. **See Changes**:
   - Frontend: Auto-reloads at http://localhost:5173
   - Backend: Auto-reloads when you save Python files
4. **Test APIs**: Use the endpoints at http://localhost:3001/api/
5. **Stop Development**: `Ctrl+C` or `./stop-dev.sh`

## Key Improvements Made

### Before (Manual & Error-Prone)
- ❌ Had to manually start Docker
- ❌ Had to manually configure `POSTGRES_HOST=localhost`
- ❌ Had to manually start backend server
- ❌ Had to manually start frontend server
- ❌ Mixed deployment model (some Docker, some manual)
- ❌ SQLite fallback when PostgreSQL wasn't configured correctly
- ❌ No single command to start everything

### After (Streamlined)
- ✅ **One command starts everything**: `./quick-start.sh`
- ✅ **Automatic Docker detection and startup**
- ✅ **Automatic PostgreSQL connection configuration**
- ✅ **Automatic frontend dependency installation**
- ✅ **Proper process management and cleanup**
- ✅ **Health checks and service monitoring**
- ✅ **Clear status messages and error handling**
- ✅ **Easy stop command**: `./stop-dev.sh`

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   React/Vite    │────│   Flask API     │
│   Port 5173     │    │   Port 3001     │
└─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   Port 5432     │
                       │   (Docker)      │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │   Port 6379     │
                       │   (Docker)      │
                       └─────────────────┘
```

## Next Steps

- The system is now fully streamlined for development
- All services start with one command
- PostgreSQL is used as the primary database (no more SQLite fallback)
- Frontend and backend auto-reload on changes
- Easy cleanup and restart process

Happy coding! 🎉
