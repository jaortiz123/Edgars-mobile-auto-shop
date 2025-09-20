# Backend configuration for Terraform state
# Note: S3 bucket and DynamoDB table must be created manually first

# Create S3 bucket and DynamoDB table with these commands:
# aws s3 mb s3://edgar-auto-shop-terraform-state --region us-west-2
# aws s3api put-bucket-versioning --bucket edgar-auto-shop-terraform-state --versioning-configuration Status=Enabled
# aws s3api put-bucket-encryption --bucket edgar-auto-shop-terraform-state --server-side-encryption-configuration '{
#   "Rules": [
#     {
#       "ApplyServerSideEncryptionByDefault": {
#         "SSEAlgorithm": "AES256"
#       }
#     }
#   ]
# }'

# aws dynamodb create-table \
#   --table-name edgar-auto-shop-terraform-locks \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
#   --region us-west-2

terraform {
  backend "s3" {
    bucket         = "edgar-auto-shop-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "edgar-auto-shop-terraform-locks"
    encrypt        = true
  }
}
