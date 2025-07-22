#!/bin/bash

# Script to package and deploy the enhanced reminder function

echo "📦 Packaging Enhanced Reminder Function"
echo "======================================"

cd "$(dirname "$0")/../backend"

# Create package directory
mkdir -p lambda_packages
rm -rf lambda_packages/reminder_function
mkdir -p lambda_packages/reminder_function

# Copy reminder function to root of package
cp reminder_function.py lambda_packages/reminder_function/

# Install pg8000 (pure Python PostgreSQL driver)
pip install pg8000==1.30.3 -t lambda_packages/reminder_function/

# Create requirements.txt for the reminder function
cat > lambda_packages/reminder_function/requirements.txt << EOF
boto3>=1.26.0
pg8000>=1.30.0
EOF

echo "✅ Reminder function packaged successfully"

# Create the zip file with files at root level
cd lambda_packages/reminder_function
zip -r ../reminder_function.zip .

echo "📁 Package created: lambda_packages/reminder_function.zip"
echo ""
echo "Next steps:"
echo "1. Update infrastructure with: terraform apply"
echo "2. The reminder function will run daily at 12:00 PM UTC"
echo "3. Monitor CloudWatch logs for execution details"
echo "4. Check DynamoDB notification tracking table for records"
