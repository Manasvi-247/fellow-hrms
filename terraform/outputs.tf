output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (one per AZ)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (one per AZ)."
  value       = aws_subnet.private[*].id
}

output "nat_gateway_id" {
  description = "NAT gateway used by the private subnets."
  value       = aws_nat_gateway.main.id
}

output "eks_cluster_name" {
  description = "EKS cluster name, when create_eks is true."
  value       = try(aws_eks_cluster.main[0].name, null)
}

output "eks_endpoint" {
  description = "EKS API server endpoint, when create_eks is true."
  value       = try(aws_eks_cluster.main[0].endpoint, null)
}

output "eks_update_kubeconfig" {
  description = "Command to point kubectl at EKS."
  value       = var.create_eks ? "aws eks update-kubeconfig --region ${var.aws_region} --name ${var.cluster_name}" : null
}

output "kind_context" {
  description = "kubectl context of the local kind cluster."
  value       = var.create_kind_cluster ? "kind-${var.cluster_name}" : null
}

output "next_steps" {
  description = "What to run after apply."
  value       = "scripts/kind-up.sh && scripts/deploy-kind.sh && scripts/monitoring-up.sh"
}
