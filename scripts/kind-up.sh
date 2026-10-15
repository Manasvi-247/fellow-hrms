#!/usr/bin/env bash
# Installs the ingress controller and metrics-server (needed by the HPA) into the kind cluster.
# The cluster itself is created by Terraform: cd terraform && terraform apply
set -euo pipefail
cd "$(dirname "$0")/.."

INGRESS_NGINX_VERSION="controller-v1.15.1"
METRICS_SERVER_VERSION="v0.9.0"

if ! kind get clusters | grep -qx fellow; then
  echo "kind cluster 'fellow' not found. Create it first: cd terraform && terraform apply" >&2
  exit 1
fi
kubectl config use-context kind-fellow

kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/kind/deploy.yaml"
# Only the control-plane node maps host ports 80/443, so the controller must run there.
kubectl patch deployment ingress-nginx-controller -n ingress-nginx --type=merge -p '{
  "spec": {"template": {"spec": {
    "nodeSelector": {"ingress-ready": "true", "kubernetes.io/os": "linux"},
    "tolerations": [{"key": "node-role.kubernetes.io/control-plane", "operator": "Exists", "effect": "NoSchedule"}]
  }}}}'

kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/${METRICS_SERVER_VERSION}/components.yaml"
# kind kubelets use self-signed certificates.
kubectl patch deployment metrics-server -n kube-system --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' || true

kubectl rollout status -n ingress-nginx deployment/ingress-nginx-controller --timeout=180s
kubectl rollout status -n kube-system deployment/metrics-server --timeout=180s
kubectl apply -f k8s/namespace.yaml
echo "Ingress and metrics-server are ready on kind-fellow"
