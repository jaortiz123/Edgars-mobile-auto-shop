# Security-hardened profile function Dockerfile
FROM public.ecr.aws/lambda/python:3.9@sha256:4ac7c7a02065ad8b90c7c3fc862b27bc0afe2e4024c9e0bdbfd89dc12a63c8f7

# Update system packages for security
RUN yum update -y && \
    yum clean all && \
    rm -rf /var/cache/yum

# Create non-root user for application
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set security environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Copy the profile function code with proper permissions
COPY profile_function.py ${LAMBDA_TASK_ROOT}
RUN chown -R appuser:appuser ${LAMBDA_TASK_ROOT} && \
    chmod 644 ${LAMBDA_TASK_ROOT}/profile_function.py

# Switch to non-root user
USER appuser

# Health check for container monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import profile_function; print('Profile function loaded')" || exit 1

# Set the handler
CMD ["profile_function.lambda_handler"]
