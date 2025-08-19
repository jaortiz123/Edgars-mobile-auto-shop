# Automated Appointment Reminder System

## Overview

Edgar's Mobile Auto Shop now features a comprehensive automated appointment reminder system that sends SMS notifications to customers 24 hours before their scheduled appointments. The system includes robust tracking, error handling, and monitoring capabilities.

## System Architecture

### Components

1. **Reminder Function** (`backend/reminder_function.py`)
   - Triggered daily by EventBridge at 12:00 PM UTC
   - Queries RDS database for appointments 24-26 hours in advance
   - Sends reminders via SNS and tracks notification status
   - Implements duplicate prevention and error handling

2. **Enhanced Notification Function** (`backend/notification_function.py`)
   - Processes all notification requests (confirmations, reminders, cancellations)
   - Sends direct SMS messages with phone number validation
   - Includes fallback to SNS topic publishing
   - Enhanced message formatting with location details

3. **Notification Tracking Table** (DynamoDB: `edgar-notification-tracking`)
   - Tracks all notification attempts and their status
   - Prevents duplicate reminders
   - Auto-cleanup after 30 days via TTL
   - Supports monitoring and analytics

4. **EventBridge Schedule**
   - Rule: `Edgar24hReminderRule`
   - Schedule: `cron(0 12 * * ? *)` (Daily at noon UTC)
   - Triggers the reminder function automatically

## Features

### Automated 24-Hour Reminders
- **Smart Scheduling**: Queries appointments 24-26 hours in advance
- **Duplicate Prevention**: Tracks sent reminders to avoid duplicates
- **Database Integration**: Retrieves customer and appointment details from RDS
- **Error Handling**: Tracks failed notifications with error messages

### Enhanced SMS Notifications
- **Direct SMS**: Sends SMS directly to customer phone numbers via SNS
- **Phone Validation**: Validates and formats phone numbers to E.164 format
- **Fallback Mechanism**: Falls back to SNS topic if direct SMS fails
- **Message Templates**: Different templates for confirmations, reminders, and cancellations

### Notification Tracking
- **Status Tracking**: Tracks sent, failed, and pending notifications
- **Error Logging**: Records error messages for failed notifications
- **TTL Cleanup**: Automatically removes old records after 30 days
- **Query Support**: Enables monitoring and analytics

## Database Schema

### Appointments Table
```sql
-- Required fields for reminder system
id SERIAL PRIMARY KEY
customer_id INTEGER REFERENCES customers(id)
service_id INTEGER REFERENCES services(id)
scheduled_date DATE
scheduled_time TIME
status VARCHAR(50) DEFAULT 'scheduled'
location_address TEXT
notes TEXT
```

### Customers Table
```sql
-- Required fields for notifications
id SERIAL PRIMARY KEY
name VARCHAR(255)
phone VARCHAR(20)  -- Required for SMS notifications
email VARCHAR(255)
```

### Notification Tracking Table (DynamoDB)
```json
{
  "appointment_id": "string",        // Partition key
  "notification_type": "string",     // Sort key (reminder_24h, confirmation, etc.)
  "status": "string",                // sent, failed, pending
  "timestamp": "string",             // ISO 8601 timestamp
  "ttl": "number",                   // Unix timestamp for auto-cleanup
  "error_message": "string",         // Optional error details
  "customer_phone": "string"         // Optional phone number
}
```

## Configuration

### Environment Variables

#### Reminder Function
- `SNS_TOPIC_ARN`: ARN of the SNS topic for notifications
- `DB_SECRET_ARN`: ARN of the Secrets Manager secret for database credentials
- `NOTIFICATION_TRACKING_TABLE`: Name of the DynamoDB tracking table

#### Notification Function
- `SNS_TOPIC_ARN`: ARN of the SNS topic for notifications

### Infrastructure Resources

#### IAM Permissions
- **Database Access**: SecretsManager GetSecretValue for DB credentials
- **SNS Publishing**: SNS Publish and GetTopicAttributes
- **DynamoDB Access**: GetItem, PutItem, UpdateItem, Query, Scan on tracking table
- **VPC Access**: Lambda VPC execution role for database connectivity

#### Networking
- **VPC Configuration**: Lambda functions run in private subnets
- **Security Groups**: Allow outbound HTTPS for AWS services, PostgreSQL for database
- **VPC Endpoints**: SNS and Secrets Manager endpoints for private connectivity

## Deployment

### Prerequisites
- AWS CLI configured with appropriate permissions
- Terraform installed
- Database initialized with customer phone numbers

### Deployment Steps

1. **Package the Functions**
   ```bash
   ./scripts/package_reminder_function.sh
   ```

2. **Deploy Infrastructure**
   ```bash
   ./scripts/deploy_reminder_system.sh
   ```

3. **Verify Deployment**
   ```bash
   ./scripts/test_reminder_system.sh
   ```

### Manual Deployment
```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

## Testing

### Unit Tests
```bash
# Test enhanced notification function
cd backend
python -m pytest tests/test_enhanced_notification_function.py -v

# Test reminder function
python -m pytest tests/test_reminder_function.py -v
```

### Integration Testing
```bash
# Create test appointment and verify reminder
./scripts/test_reminder_system.sh
```

### Manual Testing
```bash
# Invoke reminder function manually
aws lambda invoke \
  --function-name EdgarAutoReminderFunction \
  --payload '{}' \
  /tmp/reminder-response.json
```

## Monitoring

### CloudWatch Logs
- **Reminder Function**: `/aws/lambda/EdgarAutoReminderFunction`
- **Notification Function**: `/aws/lambda/EdgarNotificationFunction`

### Key Metrics to Monitor
- **Reminder Execution**: Daily at 12:00 PM UTC
- **Notification Success Rate**: SMS delivery success
- **Error Rate**: Failed notifications and reasons
- **Tracking Table Size**: Number of tracked notifications

### DynamoDB Monitoring
```bash
# Query notification tracking
aws dynamodb scan \
  --table-name edgar-notification-tracking \
  --filter-expression "#status = :status" \
  --expression-attribute-names '{"#status": "status"}' \
  --expression-attribute-values '{":status": {"S": "failed"}}'
```

### SNS Monitoring
- **Message Delivery**: Check SNS delivery reports
- **Failed Messages**: Monitor bounce and failure rates
- **Cost Tracking**: Monitor SMS costs

## Message Templates

### 24-Hour Reminder
```
Hi {customer_name}!

This is a friendly reminder about your appointment tomorrow:

🔧 Service: {service}
📅 Time: {formatted_time}
📍 Address: {location_address}

Please ensure someone is available and the vehicle is accessible.

See you tomorrow!
Edgar's Mobile Auto Shop
```

### Appointment Confirmation
```
Hello {customer_name}!

Your appointment with Edgar's Mobile Auto Shop has been confirmed:

🔧 Service: {service}
📅 Date & Time: {formatted_time}
📍 Location: {location_address}

We'll send a reminder 24 hours before your appointment. If you need to reschedule, please call us.

Thank you for choosing Edgar's Auto Shop!
```

## Troubleshooting

### Common Issues

#### No Reminders Being Sent
1. Check EventBridge rule is enabled
2. Verify Lambda function has database access
3. Check customer phone numbers are valid
4. Review CloudWatch logs for errors

#### SMS Not Delivered
1. Verify phone number format (E.164)
2. Check SNS delivery reports
3. Verify customer opted in for SMS
4. Check AWS SNS sandbox mode (if applicable)

#### Database Connection Issues
1. Verify VPC configuration
2. Check security group rules
3. Validate Secrets Manager permissions
4. Test database connectivity

### Log Analysis
```bash
# Search for errors in reminder function logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/EdgarAutoReminderFunction \
  --filter-pattern "ERROR"

# Check notification delivery
aws logs filter-log-events \
  --log-group-name /aws/lambda/EdgarNotificationFunction \
  --filter-pattern "SMS sent successfully"
```

## Security Considerations

### Data Protection
- Phone numbers stored securely in RDS
- Database credentials in AWS Secrets Manager
- VPC isolation for Lambda functions
- Encrypted SNS message delivery

### Access Control
- Least privilege IAM policies
- VPC security groups restrict database access
- Lambda execution roles scoped to required resources

### Compliance
- SMS opt-in tracking (implement as needed)
- Data retention policies (30-day TTL on tracking)
- Audit logging via CloudWatch

## Cost Optimization

### SMS Costs
- Use transactional SMS type for better rates
- Implement opt-out mechanisms
- Monitor delivery rates to optimize phone validation

### Lambda Costs
- Functions run only when needed (scheduled + event-driven)
- Minimal memory allocation for cost efficiency
- VPC endpoints reduce NAT gateway costs

### DynamoDB Costs
- Pay-per-request billing model
- Automatic TTL cleanup reduces storage costs
- Efficient query patterns

## Future Enhancements

### Planned Features
1. **Multi-Channel Notifications**: Email backup for failed SMS
2. **Customizable Timing**: Customer preference for reminder timing
3. **Rich Notifications**: Include weather, traffic, or service tips
4. **Admin Dashboard**: Real-time monitoring interface
5. **A/B Testing**: Test different message formats
6. **International Support**: Support for international phone numbers

### Performance Improvements
1. **Batch Processing**: Process multiple reminders efficiently
2. **Caching**: Cache customer preferences
3. **Async Processing**: Queue-based notification processing
4. **Smart Scheduling**: AI-optimized reminder timing

## Support

For technical support or questions about the reminder system:

1. **Check Documentation**: Review this guide and logs
2. **Monitor Dashboards**: Use CloudWatch for real-time monitoring
3. **Test Scripts**: Use provided testing scripts for validation
4. **Log Analysis**: Review CloudWatch logs for detailed error information

---

*Last Updated: July 21, 2025*
*Version: 1.0*
*System: Edgar's Mobile Auto Shop - Automated Appointment Reminders*
