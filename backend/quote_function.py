import json

def lambda_handler(event, context):
    """
    Minimal test function to verify basic Lambda execution.
    """
    print("Lambda function started")
    print("Event received:", json.dumps(event))
    
    try:
        # Parse the incoming request
        body = json.loads(event.get("body", "{}"))
        service = body.get("service", "Unknown")
        
        print(f"Service requested: {service}")
        
        # Simple pricing logic - exactly what the mandate requires
        if service.lower() == "oil change":
            price = 50
        elif service.lower() == "brake repair":
            price = 200
        elif service.lower() == "battery":
            price = 120
        elif service.lower() == "engine":
            price = 300
        else:
            price = 100
            
        print(f"Price calculated: ${price}")
        
        # Create response
        response = {
            "quote": f"Estimated cost for {service} is ${price}",
            "requestId": context.aws_request_id
        }
        
        print("Returning response:", response)
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps(response)
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({"error": str(e)})
        }
