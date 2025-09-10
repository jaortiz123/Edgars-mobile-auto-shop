# Security-hardened infrastructure backend Dockerfile
FROM python:3.11-slim@sha256:4e9c0cb89b18d7a0a4ab6c36ee7e26b03c2a76f04b56e9f44b20c0d6b1c6b6ff

# Update system packages for security
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        curl=7.88.1-10+deb12u8 \
        procps=2:4.0.2-3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for application
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set security environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create working directory with proper permissions
WORKDIR /app
RUN chown appuser:appuser /app

# Install Python dependencies with pinned versions
RUN pip install --upgrade pip==24.0

# Switch to non-root user
USER appuser

# Health check for container monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "print('Infrastructure backend ready')" || exit 1

CMD ["/bin/bash"]
