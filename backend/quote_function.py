import json
import os
import boto3

# Initialize the DynamoDB resource outside the handler for performance.
# This allows the connection to be reused across invocations.
ddb = boto3.resource('dynamodb')
# Retrieve table name from environment variables; provides flexibility.
table_name = os.environ.get('QUOTES_TABLE', 'EdgarQuotes')
table = ddb.Table(table_name)

def lambda_handler(event, context):
    """
    Handles incoming requests from API Gateway.
    - Logs the event for debugging.
    - Stores a record of the request in DynamoDB.
    - Returns a static quote response.
    """
    print("Received event:", json.dumps(event))

    # Use the unique AWS request ID as the primary key for our record.
    request_id = context.aws_request_id

    try:
        # Prove we can write to DynamoDB. We store the raw event body.
        # In a real-world scenario, we would store parsed and validated data.
        table.put_item(
            Item={
                'RequestID': request_id,
                'Request': event.get('body', event)  # Store body if from API GW, else the whole event
            }
        )
    except Exception as e:
        # Log any database errors but do not fail the function.
        # This makes the function resilient, though we lose the record.
        print(f"Error writing to DynamoDB: {e}")

    # Prepare the response payload.
    response_payload = {
        "quote": "Your estimated cost is $100",
        "requestId": request_id
    }

    # Format the response for API Gateway (HTTP API).
    # It expects a specific JSON structure with statusCode, headers, and body.
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(response_payload)
    }
