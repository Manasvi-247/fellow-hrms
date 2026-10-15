provider "aws" {
  region = var.aws_region

  # LocalStack accepts any credentials; real AWS uses the normal credential chain.
  access_key                  = var.use_localstack ? "test" : null
  secret_key                  = var.use_localstack ? "test" : null
  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack

  dynamic "endpoints" {
    for_each = var.use_localstack ? [var.localstack_endpoint] : []
    content {
      ec2 = endpoints.value
      eks = endpoints.value
      iam = endpoints.value
      sts = endpoints.value
    }
  }

  default_tags {
    tags = {
      Project     = "fellow"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "kind" {}
