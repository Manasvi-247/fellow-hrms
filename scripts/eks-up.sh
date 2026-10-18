#!/usr/bin/env bash
# Sets up the EKS cluster created by Terraform: ingress-nginx behind an AWS load balancer, Argo CD,
# and the fellow-eks Application that deploys helm/fellow from GitHub (GitOps, no AWS credentials in CI).
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-ap-southeast-2}"
CLUSTER="${EKS_CLUSTER:-fellow}"
CONTEXT=fellow-eks
INGRESS_NGINX_VERSION="controller-v1.15.1"
ARGOCD_VERSION="v3.5.5"
METRICS_SERVER_VERSION="v0.9.0"
NS=fellow-staging
k() { kubectl --context "$CONTEXT" "$@"; }

aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" --alias "$CONTEXT" ${AWS_PROFILE:+--profile "$AWS_PROFILE"}
k get nodes -o wide

k apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/aws/deploy.yaml"
k rollout status -n ingress-nginx deployment/ingress-nginx-controller --timeout=300s

# EKS does not ship metrics-server; the HPA needs it for CPU metrics.
k apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/${METRICS_SERVER_VERSION}/components.yaml"

k create namespace argocd --dry-run=client -o yaml | k apply -f -
k apply -n argocd --server-side --force-conflicts \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"
k rollout status -n argocd deployment/argocd-server --timeout=300s

# The database password is generated here, outside Git.
k create namespace "$NS" --dry-run=client -o yaml | k apply -f -
if ! k get secret fellow-staging-db -n "$NS" >/dev/null 2>&1; then
  password="$(openssl rand -hex 16)"
  k create secret generic fellow-staging-db -n "$NS" \
    --from-literal=POSTGRES_DB=fellow \
    --from-literal=POSTGRES_USER=fellow \
    --from-literal=POSTGRES_PASSWORD="$password" \
    --from-literal=DATABASE_URL="postgresql+psycopg://fellow:${password}@fellow-staging-postgres:5432/fellow"
fi

k apply -f argocd/fellow-eks.yaml

echo "Waiting for the load balancer address..."
for _ in $(seq 1 60); do
  lb="$(k get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  [ -n "$lb" ] && break
  sleep 5
done
echo "Fellow on EKS:  http://${lb:-<pending>}/"
echo "Argo CD:        kubectl --context $CONTEXT port-forward svc/argocd-server -n argocd 8443:443"
