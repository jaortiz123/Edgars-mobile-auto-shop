# Security-hardened psycopg2 layer rebuild Dockerfile
FROM amazonlinux:2023@sha256:2de4a9b7d0316b7bf6b30f8371ec5fd88f09ee02b7ec1e74de5f3a5f5dd2e8a9

# Update system packages for security
RUN yum update -y && \
    yum install -y \
        python3 \
        python3-pip \
        gcc \
        python3-devel \
        postgresql-devel=15.7 && \
    yum clean all && \
    rm -rf /var/cache/yum

# Create non-root user for building
RUN groupadd -r builder && useradd -r -g builder builder

# Set security environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Create working directory with proper permissions
RUN mkdir -p /opt/python && \
    chown -R builder:builder /opt/python

# Switch to non-root user
USER builder

# Install psycopg2-binary with pinned version
RUN pip3 install --target /opt/python psycopg2-binary==2.9.9

# Health check for layer validation
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import psycopg2; print('psycopg2 layer ready')" || exit 1

CMD ["/bin/bash"]
