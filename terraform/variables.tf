variable "aws_region" {
  description = "AWS region for the network and EKS cluster."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name used in tags and resource names."
  type        = string
  default     = "dev"
}

variable "use_localstack" {
  description = "Send AWS API calls to LocalStack instead of real AWS."
  type        = bool
  default     = true
}

variable "localstack_endpoint" {
  description = "LocalStack edge endpoint."
  type        = string
  default     = "http://localhost:4566"
}

variable "cluster_name" {
  description = "Name of the Kubernetes cluster (EKS or kind)."
  type        = string
  default     = "fellow"
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Two or more availability zones; one public and one private subnet is created in each."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "Use at least two availability zones."
  }
}

variable "create_eks" {
  description = "Create the EKS cluster and managed node group. Needs real AWS or a LocalStack plan with EKS."
  type        = bool
  default     = false
}

variable "eks_version" {
  description = "Kubernetes version for EKS."
  type        = string
  default     = "1.34"
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_group_size" {
  description = "Min, desired and max size of the EKS managed node group."
  type        = object({ min = number, desired = number, max = number })
  default     = { min = 1, desired = 2, max = 4 }
}

variable "create_kind_cluster" {
  description = "Create the local kind cluster that stands in for EKS during development."
  type        = bool
  default     = true
}

variable "kind_worker_count" {
  description = "Number of kind worker nodes."
  type        = number
  default     = 2
}
