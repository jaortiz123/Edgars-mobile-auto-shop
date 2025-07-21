#!/usr/bin/env bash
set -e

# Default AWS Account ID and region, can be overridden via environment variables
ACCOUNT_ID="${ACCOUNT_ID:-588738589514}"
REGION="${REGION:-us-west-2}"

# Determine environment (e.g., dev, prod) and set ECR repo name accordingly
ENVIRONMENT="${1:-dev}"
TAG="${2:-latest}"
ECR_REPO_NAME="${ENVIRONMENT}-profile-function"
IMAGE_TAG="$TAG"

# ECR URI for building and pushing
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:$IMAGE_TAG"

# Create repository if it doesn't exist
aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION || true
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build and push via Buildx in one command producing a Schema 2 manifest
docker buildx build \
  --platform linux/amd64 \
  -f backend/Dockerfile.profile \
  --tag $ECR_URI \
  --push \
  backend/

echo "Profile Lambda image pushed: $ECR_URI"
# Update the Lambda function to use the newly pushed image
aws lambda update-function-code \
  --function-name EdgarProfileFunction \
  --image-uri $ECR_URI \
  --region $REGION
