#!/bin/bash
# Create GitHub issues for Sprint 5: Notifications & Admin

set -e

echo "🚀 Creating Sprint 5 GitHub issues..."

# Ensure required labels exist
echo "📋 Checking/creating labels..."
for label in sprint5 backend infra security frontend; do
    if ! gh label list --json name | grep -q "\"$label\""; then
        echo "Creating label: $label"
        case $label in
            sprint5)
                gh label create "$label" --color "FF8800" --description "Sprint 5 backlog"
                ;;
            backend)
                gh label create "$label" --color "0366D6" --description "Backend work"
                ;;
            infra)
                gh label create "$label" --color "28A745" --description "Infrastructure work"
                ;;
            security)
                gh label create "$label" --color "D73A49" --description "Security-related tasks"
                ;;
            frontend)
                gh label create "$label" --color "6F42C1" --description "Frontend work"
                ;;
        esac
    else
        echo "Label exists: $label"
    fi
done
echo ""

# Issue #1: SNS Setup
gh issue create \
    --title "Sprint 5: Set up SNS topic & SMS" \
    --body "**Tasks:**
- Terraform aws_sns_topic for appointment-notifications
- Configure SMS sender ID
- IAM policy for Lambda publish
- Smoke-test via CLI" \
    --label sprint5,infra

# Issue #2: Notification Lambda
gh issue create \
    --title "Sprint 5: Build notification Lambda" \
    --body "**Tasks:**
- backend/notification_function.py
- SNS publish logic
- Unit + E2E tests" \
    --label sprint5,backend

# Issue #3: EventBridge Reminders
gh issue create \
    --title "Sprint 5: Schedule 24h reminders (EventBridge)" \
    --body "**Tasks:**
- EventBridge rule
- Reminder Lambda
- IAM + tests" \
    --label sprint5,backend

# Issue #4: Cognito Admin Auth
gh issue create \
    --title "Sprint 5: Cognito user pool for admin auth" \
    --body "**Tasks:**
- Terraform Cognito pool & client
- API GW JWT authorizer
- Login flow test" \
    --label sprint5,security

# Issue #5: Admin API Endpoints
gh issue create \
    --title "Sprint 5: Admin API endpoints" \
    --body "**Tasks:**
- GET /admin/appointments/today
- PUT /admin/appointments/{id}
- Authorizer wiring
- Pytest coverage" \
    --label sprint5,backend

# Issue #6: Admin Dashboard UI
gh issue create \
    --title "Sprint 5: Admin dashboard UI" \
    --body "**Tasks:**
- AdminSchedule.tsx table + modal
- Cognito login in frontend
- E2E smoke test" \
    --label sprint5,frontend

echo "✅ Sprint 5 issues created successfully!"
