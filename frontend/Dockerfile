FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install required utilities for port management and create non-root user
RUN apk add --no-cache lsof procps \
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

# Drop privileges
USER app
ENV HOME=/home/app

EXPOSE 5173

# Do not bind privileged ports; dev server will explicitly set host via args
CMD ["npm", "run", "dev", "--", "--host"]
