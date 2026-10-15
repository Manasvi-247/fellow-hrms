terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.69"
    }
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.11"
    }
  }
}
