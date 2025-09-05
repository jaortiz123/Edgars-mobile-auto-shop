FROM node:20-alpine
WORKDIR /app

# Install required utilities for port management
RUN apk add --no-cache lsof procps

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Use npm ci for more reliable installs in containerized environments
RUN npm ci --only=production=false

# Copy the rest of the application
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
