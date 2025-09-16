# Multi-stage build for security and smaller image size
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Install tools for diagnostics (unpin; Alpine uses procps-ng)
RUN apk add --no-cache lsof procps-ng \
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
FROM node:20-alpine AS production

# Install security updates and minimal runtime tools
RUN apk update && apk upgrade \
	&& apk add --no-cache lsof procps-ng \
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
