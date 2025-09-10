# Multi-stage build for security and smaller image size
# Pin base image with digest for security
FROM node:20-alpine@sha256:92a6c6ff178dbfbd0398f22d6ae6a3e3e1e6e6b30d4c1b5a7866ae6edcc08b51 AS builder

# Create app directory
WORKDIR /app

# Install required utilities for port management and create non-root user
RUN apk add --no-cache lsof=4.95.0-r2 procps=3.3.17-r3 \
	&& addgroup -S app && adduser -S app -G app \
	&& mkdir -p /home/app && chown -R app:app /home/app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies as root, then fix permissions
RUN npm ci --only=production=false \
	&& chown -R app:app /app

# Copy the rest of the application and ensure ownership
COPY . .
RUN chown -R app:app /app

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine@sha256:92a6c6ff178dbfbd0398f22d6ae6a3e3e1e6e6b30d4c1b5a7866ae6edcc08b51 AS production

# Install security updates and required utilities
RUN apk update && apk upgrade \
	&& apk add --no-cache lsof=4.95.0-r2 procps=3.3.17-r3 \
	&& addgroup -S app && adduser -S app -G app \
	&& mkdir -p /home/app && chown -R app:app /home/app

WORKDIR /app

# Copy package files for production dependencies
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production \
	&& npm cache clean --force \
	&& chown -R app:app /app

# Copy built application from builder stage
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules

# Drop privileges early
USER app
ENV HOME=/home/app
ENV NODE_ENV=production

# Use non-privileged port
EXPOSE 5173

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

# Do not bind privileged ports; dev server will explicitly set host via args
CMD ["npm", "run", "dev", "--", "--host"]
