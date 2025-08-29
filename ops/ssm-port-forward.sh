#!/usr/bin/env bash
set -euo pipefail

: "${INSTANCE_ID:?export INSTANCE_ID=i-...}"
: "${RDS_ENDPOINT:?export RDS_ENDPOINT=your-db.xyz.amazonaws.com}"
LOCAL_PORT=${LOCAL_PORT:-5432}
AWS_REGION=${AWS_REGION:-us-west-2}

exec aws ssm start-session \
  --region "$AWS_REGION" \
  --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters host="$RDS_ENDPOINT",portNumber="5432",localPortNumber="$LOCAL_PORT"
