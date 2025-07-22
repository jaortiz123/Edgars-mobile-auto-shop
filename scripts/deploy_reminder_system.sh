#!/bin/bash

# Deployment script for Enhanced Appointment Reminder System
# This script deploys the complete notification infrastructure

set -e

echo "🚀 Deploying Enhanced Appointment Reminder System"
echo "=================================================="
echo "Date: $(date)"
echo ""

# Check if we're in the right directory
if [ ! -f "infrastructure/main.tf" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Error: Terraform is not installed"
    echo "Please install Terraform: https://www.terraform.io/downloads"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Error: AWS CLI not configured or no credentials"
    echo "Please run: aws configure"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Package the reminder function
echo "📦 Packaging reminder function..."
./scripts/package_reminder_function.sh

# Ensure lambda packages directory exists in infrastructure
mkdir -p infrastructure/lambda_packages

# Copy packaged function to infrastructure directory
cp backend/lambda_packages/reminder_function.zip infrastructure/lambda_packages/

echo "✅ Lambda function packaged"
echo ""

# Navigate to infrastructure directory
cd infrastructure

# Initialize Terraform (in case it's not initialized)
echo "🔧 Initializing Terraform..."
terraform init

# Validate Terraform configuration
echo "🔍 Validating Terraform configuration..."
terraform validate

if [ $? -ne 0 ]; then
    echo "❌ Terraform validation failed"
    exit 1
fi

echo "✅ Terraform configuration validated"
echo ""

# Plan the deployment
echo "📋 Planning infrastructure deployment..."
terraform plan -out=tfplan

if [ $? -ne 0 ]; then
    echo "❌ Terraform plan failed"
    exit 1
fi

echo ""
echo "📊 Infrastructure changes planned. Review the plan above."
echo ""
read -p "Do you want to proceed with deployment? (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Applying infrastructure changes..."
    terraform apply tfplan
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Infrastructure deployment completed successfully!"
        echo ""
        echo "🎯 What was deployed:"
        echo "  • Enhanced reminder Lambda function with database connectivity"
        echo "  • DynamoDB notification tracking table"
        echo "  • EventBridge rule for daily 12:00 PM UTC execution"
        echo "  • IAM permissions for database and DynamoDB access"
        echo "  • Enhanced notification function with direct SMS capability"
        echo ""
        echo "📊 System Information:"
        echo "  • Reminder schedule: Daily at 12:00 PM UTC"
        echo "  • Reminder window: 24-26 hours before appointments"
        echo "  • Notification tracking: 30-day retention with auto-cleanup"
        echo "  • SMS delivery: Direct via AWS SNS with fallback to topic"
        echo ""
        echo "🔍 Monitoring:"
        echo "  • CloudWatch logs: /aws/lambda/EdgarAutoReminderFunction"
        echo "  • DynamoDB table: edgar-notification-tracking"
        echo "  • SNS topic: edgar-appointment-notifications"
        echo ""
        echo "📱 Testing:"
        echo "  • Run: ../scripts/test_reminder_system.sh"
        echo "  • Create test appointments for tomorrow to verify reminders"
        echo ""
        
        # Clean up plan file
        rm -f tfplan
        
    else
        echo "❌ Infrastructure deployment failed"
        exit 1
    fi
else
    echo "❌ Deployment cancelled by user"
    rm -f tfplan
    exit 1
fi

echo ""
echo "🎉 Enhanced Appointment Reminder System deployment complete!"
echo ""
echo "Next steps:"
echo "1. Monitor the first scheduled run at 12:00 PM UTC"
echo "2. Check CloudWatch logs for execution details"
echo "3. Verify notification tracking in DynamoDB"
echo "4. Test with real appointments to ensure SMS delivery"
echo ""
echo "For troubleshooting, see the logs at:"
echo "https://console.aws.amazon.com/cloudwatch/home#logStreams:group=/aws/lambda/EdgarAutoReminderFunction"
