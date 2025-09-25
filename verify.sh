#!/bin/bash
# Pre-deployment verification script
# Validates all components before AWS deployment

set -e

PROJECT_ROOT=$(dirname "$0")
cd "$PROJECT_ROOT"

echo "🔍 Pre-Deployment Verification for Edgar's Auto Shop"
echo "================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success_count=0
failure_count=0

# Function to run checks
run_check() {
    local check_name="$1"
    local check_command="$2"

    echo -n "Checking $check_name... "

    if eval "$check_command" &>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((failure_count++))
    fi
}

# 1. Check dependencies
echo "1. Dependencies"
echo "-------------"
run_check "AWS CLI installed" "aws --version"
run_check "Terraform installed" "terraform version"
run_check "Docker installed" "docker --version"
run_check "jq installed" "jq --version"

# 2. Check Flask application
echo ""
echo "2. Flask Application"
echo "------------------"
run_check "Flask app imports" "cd backend && python -c 'from app import create_prod_app; print(\"OK\")'"
run_check "Production extensions" "cd backend && python -c 'from production import init_production_extensions; print(\"OK\")'"
run_check "Requirements.txt exists" "test -f backend/requirements.txt"

# 3. Check Terraform configuration
echo ""
echo "3. Terraform Configuration"
echo "-------------------------"
run_check "Terraform format" "cd infra/terraform && terraform fmt -check -recursive"
run_check "Dev environment syntax" "cd infra/terraform/envs/dev && terraform init -backend=false && terraform validate"

# 4. Check Docker configuration
echo ""
echo "4. Docker Configuration"
echo "---------------------"
run_check "Dockerfile exists" "test -f Dockerfile"
run_check ".dockerignore exists" "test -f .dockerignore"
run_check "Docker build (dry run)" "docker build --dry-run ."

# 5. Check CI/CD configuration
echo ""
echo "5. CI/CD Configuration"
echo "--------------------"
run_check "GitHub workflow exists" "test -f .github/workflows/deploy-aws.yml"
run_check "Deploy script exists" "test -f deploy.sh && test -x deploy.sh"

# 6. Check extracted API components
echo ""
echo "6. Extracted API Components"
echo "-------------------------"
run_check "Customers API" "test -f backend/api/v1/admin/customers/routes.py"
run_check "Appointments API" "test -f backend/api/v1/admin/appointments/routes.py"
run_check "Vehicles API" "test -f backend/api/v1/admin/vehicles/routes.py"
run_check "Invoices API" "test -f backend/api/v1/admin/invoices/routes.py"

# 7. Check domain layers
echo ""
echo "7. Domain Layers"
echo "--------------"
run_check "Customer domain" "test -f backend/domain/customers/service.py && test -f backend/domain/customers/repository.py"
run_check "Appointment domain" "test -f backend/domain/appointments/service.py && test -f backend/domain/appointments/repository.py"
run_check "Vehicle domain" "test -f backend/domain/vehicles/service.py && test -f backend/domain/vehicles/repository.py"
run_check "Invoice domain" "test -f backend/domain/invoices/service.py && test -f backend/domain/invoices/repository.py"

# 8. Check test coverage
echo ""
echo "8. Test Coverage"
echo "--------------"
run_check "API tests exist" "find tests/api -name 'test_*.py' | wc -l | awk '{exit \$1 < 10}'"
run_check "Unit tests exist" "find backend/tests -name 'test_*.py' 2>/dev/null | wc -l | awk '{exit \$1 >= 0}'"

# 9. Environment configuration
echo ""
echo "9. Environment Configuration"
echo "--------------------------"
run_check "Environment example" "test -f .env.example"
run_check "Deployment docs" "test -f DEPLOYMENT.md"

# 10. AWS readiness check (optional)
echo ""
echo "10. AWS Readiness (Optional)"
echo "--------------------------"
if aws sts get-caller-identity &>/dev/null; then
    run_check "AWS credentials configured" "true"

    # Check if S3 bucket exists for Terraform state
    if aws s3 ls s3://edgar-auto-shop-terraform-state &>/dev/null; then
        run_check "Terraform state bucket exists" "true"
    else
        echo -e "${YELLOW}⚠️  Terraform state bucket doesn't exist (will be created)${NC}"
    fi

    # Check if ECR repository exists
    if aws ecr describe-repositories --repository-names edgar-auto-shop-dev-flask-app --region us-west-2 &>/dev/null; then
        run_check "ECR repository exists" "true"
    else
        echo -e "${YELLOW}⚠️  ECR repository doesn't exist (will be created)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  AWS credentials not configured (optional for validation)${NC}"
fi

# Summary
echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo -e "✅ Passed: ${GREEN}$success_count${NC}"
echo -e "❌ Failed: ${RED}$failure_count${NC}"

if [ $failure_count -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All checks passed! Ready for deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./deploy.sh dev plan"
    echo "2. Review the infrastructure plan"
    echo "3. Run: ./deploy.sh dev apply"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some checks failed. Please fix issues before deployment.${NC}"
    exit 1
fi
