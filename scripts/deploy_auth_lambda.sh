#!/usr/bin/env bash
set -e

export DOCKER_CLI_EXPERIMENTAL=enabled
export DOCKER_BUILDKIT=1
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# Always run from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

ACCOUNT_ID="588738589514"
REGION="us-west-2"
ECR_REPO_NAME="edgar-auth-function"
# Use first argument as IMAGE_TAG, default to timestamped tag if none provided
if [ -n "$1" ]; then
  IMAGE_TAG="$1"
else
  IMAGE_TAG="latest"
fi
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:$IMAGE_TAG"

aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION || true
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build and push via Buildx to ensure OCI (Schema 2) manifest
docker buildx build \
  --platform linux/amd64 \
  -f backend/Dockerfile.auth \
  --tag $ECR_URI \
  --push \
  backend/

echo "Auth Lambda image pushed: $ECR_URI"
# Update the Lambda function to use the newly pushed image
aws lambda update-function-code \
  --function-name EdgarAuthFunction \
  --image-uri $ECR_URI \
  --region $REGION
