#!/usr/bin/env bash
# Installs Prometheus and Grafana (kube-prometheus-stack) into the kind cluster.
set -euo pipefail
cd "$(dirname "$0")/.."

CHART_VERSION="92.8.0"
NAMESPACE=monitoring

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl get secret grafana-admin -n "$NAMESPACE" >/dev/null 2>&1; then
  kubectl create secret generic grafana-admin -n "$NAMESPACE" \
    --from-literal=admin-user=admin \
    --from-literal=admin-password="$(openssl rand -base64 18)"
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update prometheus-community >/dev/null
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --version "$CHART_VERSION" \
  --namespace "$NAMESPACE" \
  -f monitoring/kube-prometheus-stack-values.yaml \
  --wait --timeout 10m

echo "Grafana:    http://grafana.localhost/  (user: admin)"
echo "Password:   kubectl get secret grafana-admin -n $NAMESPACE -o jsonpath='{.data.admin-password}' | base64 -d"
echo "Prometheus: http://prometheus.localhost/targets"
