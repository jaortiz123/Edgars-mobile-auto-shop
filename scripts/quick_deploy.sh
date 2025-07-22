#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Packaging reminder function..."
cd backend
zip -r reminder_function.zip reminder_function.py

echo "⬆️ Updating Lambda function..."
aws lambda update-function-code \
  --function-name EdgarAutoReminderFunction \
  --zip-file fileb://reminder_function.zip

echo "🚀 Testing reminder system..."
python test_reminder_system.py

echo "✅ Deployment complete!"
