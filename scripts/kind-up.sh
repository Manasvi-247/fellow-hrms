#!/usr/bin/env bash
# Creates the local kind cluster with an ingress controller and metrics-server (needed by the HPA).
set -euo pipefail
cd "$(dirname "$0")/.."

INGRESS_NGINX_VERSION="controller-v1.15.1"
METRICS_SERVER_VERSION="v0.9.0"

if ! kind get clusters | grep -qx fellow; then
  kind create cluster --config kind/cluster.yaml
fi
kubectl config use-context kind-fellow

kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/kind/deploy.yaml"

kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/${METRICS_SERVER_VERSION}/components.yaml"
# kind kubelets use self-signed certificates.
kubectl patch deployment metrics-server -n kube-system --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' || true

kubectl wait -n ingress-nginx --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s
kubectl rollout status -n kube-system deployment/metrics-server --timeout=180s
kubectl apply -f k8s/namespace.yaml
echo "kind cluster 'fellow' is ready"
