# Use latest stable Lambda Python image
FROM public.ecr.aws/lambda/python:3.11

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install system updates and required dependencies with version pinning
RUN yum update -y \
    && yum install -y gcc postgresql-devel \
    && yum clean all \
    && rm -rf /var/cache/yum

# Install the required psycopg2 binary dependency with version pinning
RUN pip install --no-cache-dir --upgrade pip==24.0 \
    && pip install --no-cache-dir psycopg2-binary==2.9.9

# Create app directory with proper permissions
RUN mkdir -p /var/task && chown -R appuser:appuser /var/task

# Copy the function handler code from the build context into the container
COPY --chown=appuser:appuser booking_function.py ${LAMBDA_TASK_ROOT}

# Set proper permissions
RUN chmod 644 ${LAMBDA_TASK_ROOT}/booking_function.py

# Add health check (for local testing)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import booking_function; print('OK')" || exit 1

# Switch to non-root user
USER appuser

# Set environment variables for security
ENV PYTHONPATH=/var/task
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the command to execute. This tells Lambda which function to run.
CMD [ "booking_function.lambda_handler" ]
