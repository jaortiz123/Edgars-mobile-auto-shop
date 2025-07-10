# Use the official AWS Lambda Python base image for guaranteed compatibility.
FROM public.ecr.aws/lambda/python:3.9

# Install the required psycopg2 binary dependency.
RUN pip install psycopg2-binary

# Copy the function handler code from the build context into the container.
COPY booking_function.py ${LAMBDA_TASK_ROOT}

# Set the command to execute. This tells Lambda which function to run.
CMD [ "booking_function.lambda_handler" ]
