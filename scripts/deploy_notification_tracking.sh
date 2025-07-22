#!/bin/bash

# Deploy Notification Tracking API to AWS Lambda
# This script deploys the notification tracking API endpoints as Lambda functions

set -e

echo "🚀 Deploying Notification Tracking API..."

# Configuration
REGION="us-east-1"
FUNCTION_PREFIX="edgar-notification-tracking"
TABLE_NAME="sms-notification-tracking"

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p temp_deploy
cp notification_tracking_api.py temp_deploy/lambda_function.py

cd temp_deploy

# Create minimal requirements.txt
cat > requirements.txt << EOF
boto3>=1.26.0
EOF

# Install dependencies
pip3 install -r requirements.txt -t .

# Create deployment zip
zip -r ../notification_tracking_api.zip .
cd ..
rm -rf temp_deploy

echo "✅ Deployment package created: notification_tracking_api.zip"

# Deploy Lambda functions
echo "🌩️ Deploying Lambda functions..."

# Function 1: Get Notifications
aws lambda create-function \
    --region $REGION \
    --function-name "${FUNCTION_PREFIX}-get" \
    --runtime python3.9 \
    --role arn:aws:iam::588738589514:role/lambda-execution-role \
    --handler lambda_function.get_notifications \
    --zip-file fileb://notification_tracking_api.zip \
    --environment Variables="{NOTIFICATION_TRACKING_TABLE=${TABLE_NAME}}" \
    --timeout 30 \
    --memory-size 512 \
    || aws lambda update-function-code \
        --region $REGION \
        --function-name "${FUNCTION_PREFIX}-get" \
        --zip-file fileb://notification_tracking_api.zip

echo "✅ Get notifications function deployed"

# Function 2: Retry Notification
aws lambda create-function \
    --region $REGION \
    --function-name "${FUNCTION_PREFIX}-retry" \
    --runtime python3.9 \
    --role arn:aws:iam::588738589514:role/lambda-execution-role \
    --handler lambda_function.retry_notification \
    --zip-file fileb://notification_tracking_api.zip \
    --environment Variables="{NOTIFICATION_TRACKING_TABLE=${TABLE_NAME}}" \
    --timeout 30 \
    --memory-size 512 \
    || aws lambda update-function-code \
        --region $REGION \
        --function-name "${FUNCTION_PREFIX}-retry" \
        --zip-file fileb://notification_tracking_api.zip

echo "✅ Retry notification function deployed"

# Function 3: Get Stats
aws lambda create-function \
    --region $REGION \
    --function-name "${FUNCTION_PREFIX}-stats" \
    --runtime python3.9 \
    --role arn:aws:iam::588738589514:role/lambda-execution-role \
    --handler lambda_function.get_notification_stats \
    --zip-file fileb://notification_tracking_api.zip \
    --environment Variables="{NOTIFICATION_TRACKING_TABLE=${TABLE_NAME}}" \
    --timeout 30 \
    --memory-size 512 \
    || aws lambda update-function-code \
        --region $REGION \
        --function-name "${FUNCTION_PREFIX}-stats" \
        --zip-file fileb://notification_tracking_api.zip

echo "✅ Get stats function deployed"

# Function 4: CORS Handler
aws lambda create-function \
    --region $REGION \
    --function-name "${FUNCTION_PREFIX}-options" \
    --runtime python3.9 \
    --role arn:aws:iam::588738589514:role/lambda-execution-role \
    --handler lambda_function.options_handler \
    --zip-file fileb://notification_tracking_api.zip \
    --timeout 10 \
    --memory-size 128 \
    || aws lambda update-function-code \
        --region $REGION \
        --function-name "${FUNCTION_PREFIX}-options" \
        --zip-file fileb://notification_tracking_api.zip

echo "✅ CORS options function deployed"

# Create API Gateway integration (basic setup)
echo "🌐 Setting up API Gateway integration..."

# Create or get API
API_NAME="edgar-notification-tracking-api"
API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    echo "Creating new API Gateway..."
    API_ID=$(aws apigateway create-rest-api \
        --region $REGION \
        --name $API_NAME \
        --description "Notification tracking API for Edgar's Auto Shop" \
        --query 'id' --output text)
    echo "Created API Gateway with ID: $API_ID"
else
    echo "Using existing API Gateway: $API_ID"
fi

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources --region $REGION --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

echo "📍 API Gateway setup complete"
echo "   API ID: $API_ID"
echo "   Root Resource ID: $ROOT_RESOURCE_ID"

# Clean up
rm -f notification_tracking_api.zip

echo ""
echo "✅ Notification Tracking API deployment complete!"
echo ""
echo "🔗 Next steps:"
echo "   1. Configure API Gateway routes manually or with additional scripts"
echo "   2. Set up proper CORS policies"
echo "   3. Deploy API Gateway stage"
echo "   4. Update frontend to use the API Gateway endpoints"
echo ""
echo "📊 Monitoring:"
echo "   • CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Edgar-SMS-Notification-Monitoring"
echo "   • Lambda Functions: https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions"
echo "   • API Gateway: https://console.aws.amazon.com/apigateway/home?region=us-east-1#/apis"
