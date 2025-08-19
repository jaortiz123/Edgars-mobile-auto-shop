terraform {
  backend "s3" {
    bucket         = "edgar-terraform-state-xyz"
    key            = "global/sprint1/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "TerraformLock"
    encrypt        = true
  }
}
