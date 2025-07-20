# filepath: backend/Dockerfile.profile
FROM public.ecr.aws/lambda/python:3.9

# Copy the profile function code
COPY profile_function.py ${LAMBDA_TASK_ROOT}

# Set the handler
CMD ["profile_function.lambda_handler"]
