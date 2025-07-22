#!/bin/bash

# Test script for enhanced appointment reminder system
# This script will test the reminder function functionality

echo "🔄 Testing Enhanced Appointment Reminder System"
echo "=============================================="

# First, let's check if we have any appointments in the database that we can use for testing
echo ""
echo "1. Checking current appointments in database..."

# Create a test appointment for tomorrow to test the reminder system
echo ""
echo "2. Creating test appointment for tomorrow..."

# Use the booking API to create a test appointment
API_ENDPOINT="https://nc47d9v6d1.execute-api.us-west-2.amazonaws.com"

# Calculate tomorrow's date and time
TOMORROW=$(date -v+1d '+%Y-%m-%d')
TEST_TIME="14:30:00"
TEST_DATETIME="${TOMORROW}T${TEST_TIME}"

echo "Creating appointment for: $TEST_DATETIME"

# Create test appointment
curl -X POST "${API_ENDPOINT}/appointments" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"test-customer-reminder\",
    \"service_name\": \"Oil Change\",
    \"scheduled_date\": \"$TOMORROW\",
    \"scheduled_time\": \"$TEST_TIME\",
    \"location_address\": \"123 Test Street, Test City\",
    \"notes\": \"Test appointment for reminder system\"
  }" | jq '.'

echo ""
echo "3. Manually triggering reminder function..."

# Note: In production, this would be triggered by EventBridge
# For testing, we can invoke the Lambda function directly

echo "Note: The reminder function will be triggered automatically by EventBridge at noon UTC daily."
echo "To test manually, you would use AWS CLI to invoke the Lambda function:"
echo ""
echo "aws lambda invoke --function-name EdgarAutoReminderFunction --payload '{}' /tmp/reminder-response.json"
echo ""

echo "4. Checking notification tracking table..."
echo "Note: After the reminder function runs, check the DynamoDB table 'edgar-notification-tracking' for tracking entries."

echo ""
echo "✅ Test setup complete!"
echo ""
echo "Next steps:"
echo "- The reminder function will automatically run at noon UTC daily"
echo "- It will query for appointments 24-26 hours in advance"
echo "- SMS notifications will be sent to customers with valid phone numbers"
echo "- All notifications are tracked in the notification tracking table"
echo ""
echo "To monitor the system:"
echo "1. Check CloudWatch logs for the reminder function"
echo "2. Verify entries in the notification tracking DynamoDB table"
echo "3. Confirm SMS delivery through AWS SNS console"
