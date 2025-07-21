#!/usr/bin/env bash
# Edgar Auto Shop CI/CD Deploy Script

export DOCKER_CLI_EXPERIMENTAL=enabled
export DOCKER_BUILDKIT=1
export DOCKER_DEFAULT_PLATFORM=linux/amd64
set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d%H%M)
ECR_REPO="588738589514.dkr.ecr.us-west-2.amazonaws.com/edgar-auto-booking-function"
IMAGE_TAG="${TIMESTAMP}"
AWS_REGION="us-west-2"
API_ENDPOINT="https://nc47d9v6d1.execute-api.us-west-2.amazonaws.com"

echo "🚀 Starting Edgar Auto Shop deployment..."
echo "Image tag: ${IMAGE_TAG}"

# Step 1: Build and push Lambda container
echo "📦 Building and pushing Lambda container..."
cd backend
# Ensure Buildx builder is available
docker buildx create --use --name lambda_builder || true
docker buildx build \
  --platform linux/amd64 \
  --tag "${ECR_REPO}:${IMAGE_TAG}" \
  --push \
  -f Dockerfile.lambda \
  .

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

# Step 2: Update infrastructure with new image (uses push from buildx)
echo "🏗️ Updating infrastructure..."
cd ../infrastructure
terraform apply -auto-approve -var="lambda_image_tag=${IMAGE_TAG}"

# Step 3: Health check
echo "🏥 Running post-deploy health check..."
sleep 10  # Give Lambda time to update

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${API_ENDPOINT}/appointments")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ Health check passed - /appointments returned 200"
else
    echo "❌ Health check failed - /appointments returned $HEALTH_CHECK"
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "📊 API Endpoint: ${API_ENDPOINT}"
echo "🏷️ Image Tag: ${IMAGE_TAG}"
