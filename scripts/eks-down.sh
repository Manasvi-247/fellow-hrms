#!/usr/bin/env bash
# Removes what Kubernetes created in AWS (the ingress load balancer and EBS volumes) so `terraform destroy` can delete the VPC.
set -euo pipefail
CONTEXT=fellow-eks
k() { kubectl --context "$CONTEXT" "$@"; }

k delete application fellow-eks -n argocd --ignore-not-found --wait=true --timeout=180s || true
k delete namespace fellow-staging --ignore-not-found --wait=true --timeout=300s || true
k delete namespace ingress-nginx --ignore-not-found --wait=true --timeout=300s || true
echo "Load balancer and volumes released. Now run: cd terraform && terraform destroy -var-file=aws-sydney.tfvars"
