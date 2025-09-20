#!/bin/bash
# Build and Deploy Edgar's Auto Shop to AWS
# Usage: ./deploy.sh [env] [action]

set -e

ENV=${1:-dev}
ACTION=${2:-plan}
AWS_REGION=${AWS_REGION:-us-west-2}
PROJECT_NAME="edgar-auto-shop"

echo "🚀 Deploying ${PROJECT_NAME} to ${ENV} environment"

# Ensure required tools are available
check_dependencies() {
    echo "🔍 Checking dependencies..."

    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found. Please install AWS CLI."
        exit 1
    fi

    if ! command -v terraform &> /dev/null; then
        echo "❌ Terraform not found. Please install Terraform."
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found. Please install Docker."
        exit 1
    fi

    echo "✅ All dependencies available"
}

# Setup Terraform backend (S3 + DynamoDB)
setup_backend() {
    echo "🏗️ Setting up Terraform backend..."

    BUCKET_NAME="${PROJECT_NAME}-terraform-state"
    LOCK_TABLE="${PROJECT_NAME}-terraform-locks"

    # Create S3 bucket for Terraform state
    if ! aws s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
        echo "📦 Creating S3 bucket: ${BUCKET_NAME}"
        aws s3 mb "s3://${BUCKET_NAME}" --region "${AWS_REGION}"

        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "${BUCKET_NAME}" \
            --versioning-configuration Status=Enabled

        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "${BUCKET_NAME}" \
            --server-side-encryption-configuration '{
              "Rules": [
                {
                  "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                  }
                }
              ]
            }'
    fi

    # Create DynamoDB table for state locking
    if ! aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${AWS_REGION}" 2>/dev/null; then
        echo "🔒 Creating DynamoDB table: ${LOCK_TABLE}"
        aws dynamodb create-table \
            --table-name "${LOCK_TABLE}" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
            --region "${AWS_REGION}"

        echo "⏳ Waiting for DynamoDB table to be active..."
        aws dynamodb wait table-exists --table-name "${LOCK_TABLE}" --region "${AWS_REGION}"
    fi

    echo "✅ Terraform backend ready"
}

# Build and push Docker image
build_and_push_image() {
    echo "🐳 Building and pushing Docker image..."

    # Get AWS account ID for ECR
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    ECR_REPOSITORY="${PROJECT_NAME}-${ENV}-flask-app"
    IMAGE_URI="${ECR_REGISTRY}/${ECR_REPOSITORY}:latest"

    # Create ECR repository if it doesn't exist
    if ! aws ecr describe-repositories --repository-names "${ECR_REPOSITORY}" --region "${AWS_REGION}" 2>/dev/null; then
        echo "📦 Creating ECR repository: ${ECR_REPOSITORY}"
        aws ecr create-repository \
            --repository-name "${ECR_REPOSITORY}" \
            --image-scanning-configuration scanOnPush=true \
            --region "${AWS_REGION}"
    fi

    # Login to ECR
    echo "🔐 Logging into ECR..."
    aws ecr get-login-password --region "${AWS_REGION}" | \
        docker login --username AWS --password-stdin "${ECR_REGISTRY}"

    # Build image
    echo "🏗️ Building Docker image..."
    docker build -t "${ECR_REPOSITORY}:latest" .

    # Tag for ECR
    docker tag "${ECR_REPOSITORY}:latest" "${IMAGE_URI}"

    # Push to ECR
    echo "⬆️ Pushing image to ECR..."
    docker push "${IMAGE_URI}"

    echo "✅ Docker image pushed: ${IMAGE_URI}"
    echo "IMAGE_URI=${IMAGE_URI}" > ".env.${ENV}"
}

# Deploy infrastructure
deploy_infrastructure() {
    echo "🏗️ Deploying infrastructure..."

    cd "infra/terraform/envs/${ENV}"

    # Initialize Terraform
    echo "🔧 Initializing Terraform..."
    terraform init

    # Plan or Apply
    if [ "${ACTION}" == "apply" ]; then
        echo "📋 Planning infrastructure changes..."
        terraform plan -out=tfplan

        echo "🚀 Applying infrastructure changes..."
        terraform apply tfplan

        # Enable Lambda deployment after first infrastructure apply
        if [ ! -f ".lambda_deployed" ]; then
            echo "🔄 Enabling Lambda deployment..."
            terraform apply -var="deploy_lambda=true" -auto-approve
            touch .lambda_deployed
        fi

    else
        echo "📋 Planning infrastructure changes..."
        terraform plan
    fi

    cd - > /dev/null
}

# Smoke test deployment
smoke_test() {
    echo "🧪 Running smoke tests..."

    cd "infra/terraform/envs/${ENV}"

    # Get application URL
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "")

    if [ -z "${APP_URL}" ]; then
        echo "⚠️ No application URL found. Skipping smoke test."
        return
    fi

    echo "🌐 Testing application at: ${APP_URL}"

    # Test health endpoint
    if curl -f "${APP_URL}/healthz" --max-time 30; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
        exit 1
    fi

    cd - > /dev/null
}

# Main execution
main() {
    echo "🎯 Starting deployment process..."

    check_dependencies
    setup_backend

    if [ "${ACTION}" == "apply" ]; then
        build_and_push_image
    fi

    deploy_infrastructure

    if [ "${ACTION}" == "apply" ]; then
        smoke_test
        echo "🎉 Deployment completed successfully!"
        echo "📊 Check CloudWatch for metrics and logs"
    else
        echo "📋 Plan completed. Run with 'apply' to deploy changes."
    fi
}

# Show usage if help requested
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [env] [action]"
    echo ""
    echo "Arguments:"
    echo "  env      Environment (default: dev)"
    echo "  action   Terraform action: plan|apply (default: plan)"
    echo ""
    echo "Environment variables:"
    echo "  AWS_REGION   AWS region (default: us-west-2)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Plan dev environment"
    echo "  $0 dev apply          # Deploy to dev environment"
    echo "  $0 prod plan          # Plan prod environment"
    exit 0
fi

main
