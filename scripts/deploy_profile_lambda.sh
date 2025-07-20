#!/bin/bash
set -e

# Always run from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

ACCOUNT_ID="588738589514"
REGION="us-west-2"
ECR_REPO_NAME="edgar-profile-function"

# Use first argument as IMAGE_TAG, default to 'latest'
if [ -n "$1" ]; then
  IMAGE_TAG="$1"
else
  IMAGE_TAG="latest"
fi
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:$IMAGE_TAG"

aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION || true
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Disable BuildKit and build for linux/amd64
export DOCKER_BUILDKIT=0
docker build --platform linux/amd64 -f backend/Dockerfile.profile -t $ECR_URI backend/

docker push $ECR_URI

echo "Profile Lambda image pushed: $ECR_URI"
# Update the Lambda function to use the newly pushed image
aws lambda update-function-code \
  --function-name EdgarProfileFunction \
  --image-uri $ECR_URI \
  --region $REGION
