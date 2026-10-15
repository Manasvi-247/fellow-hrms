#!/usr/bin/env bash
# Builds both images, loads them into kind and installs the Helm chart.
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${TAG:-dev}"
docker build -t "fellow/hrms-backend:${TAG}" backend
docker build -t "fellow/hrms-frontend:${TAG}" frontend
kind load docker-image --name fellow "fellow/hrms-backend:${TAG}" "fellow/hrms-frontend:${TAG}"

helm upgrade --install fellow helm/fellow \
  --namespace fellow \
  -f helm/fellow/values-kind.yaml \
  --set imageTag="${TAG}" \
  --wait --timeout 5m

kubectl get pods,svc,ingress,hpa -n fellow
echo "Open http://fellow.localhost/"
