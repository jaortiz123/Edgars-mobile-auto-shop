# Multi-stage Dockerfile for Flask + Lambda Web Adapter
# Optimized for cold start performance and minimal image size

# Stage 1: Get Lambda Web Adapter
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 AS adapter

# Stage 2: Production Flask application
FROM python:3.11-slim

# Install system dependencies for PostgreSQL and other requirements
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy requirements first for better Docker layer caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# Copy application code
COPY backend/ ./backend/
COPY generate_openapi_baseline.py .

# Copy Lambda Web Adapter
COPY --from=adapter /lambda-adapter /opt/

# Set environment variables for Lambda
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap
ENV PORT=8000
ENV PYTHONPATH=/app
ENV FLASK_APP=backend.app:create_prod_app()

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app
USER appuser

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/healthz || exit 1

# Expose port
EXPOSE ${PORT}

# Command to run the application
# Lambda Web Adapter optimized configuration
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "1", \
     "--worker-class", "sync", \
     "--timeout", "0", \
     "--keep-alive", "0", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "backend.debug_app:app"]
