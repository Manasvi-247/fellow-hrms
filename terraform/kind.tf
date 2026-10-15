# Local stand-in for EKS: same Kubernetes API, Helm chart and ingress, at zero cost.
resource "kind_cluster" "local" {
  count          = var.create_kind_cluster ? 1 : 0
  name           = var.cluster_name
  wait_for_ready = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role   = "control-plane"
      labels = { "ingress-ready" = "true" }

      extra_port_mappings {
        container_port = 80
        host_port      = 80
        protocol       = "TCP"
      }
      extra_port_mappings {
        container_port = 443
        host_port      = 443
        protocol       = "TCP"
      }
    }

    dynamic "node" {
      for_each = range(var.kind_worker_count)
      content {
        role = "worker"
      }
    }
  }
}
