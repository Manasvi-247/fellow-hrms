#!/usr/bin/env bash
# Installs Argo CD into the kind cluster and registers the fellow-staging Application (GitOps from GitHub).
set -euo pipefail
cd "$(dirname "$0")/.."

ARGOCD_VERSION="v3.5.5"
STAGING_NS=fellow-staging

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd --server-side --force-conflicts \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

# TLS ends at the ingress controller, so the Argo CD server itself serves plain HTTP.
kubectl patch configmap argocd-cmd-params-cm -n argocd --type=merge -p '{"data":{"server.insecure":"true"}}'
kubectl rollout restart deployment/argocd-server -n argocd
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s
kubectl apply -f argocd/ingress.yaml

# The database secret is created here, outside Git, so no password is committed.
kubectl create namespace "$STAGING_NS" --dry-run=client -o yaml | kubectl apply -f -
if ! kubectl get secret fellow-staging-db -n "$STAGING_NS" >/dev/null 2>&1; then
  password="$(openssl rand -hex 16)"
  kubectl create secret generic fellow-staging-db -n "$STAGING_NS" \
    --from-literal=POSTGRES_DB=fellow \
    --from-literal=POSTGRES_USER=fellow \
    --from-literal=POSTGRES_PASSWORD="$password" \
    --from-literal=DATABASE_URL="postgresql+psycopg://fellow:${password}@fellow-staging-postgres:5432/fellow"
fi

kubectl apply -f argocd/fellow-staging.yaml

echo "Argo CD:  http://argocd.localhost/  (user: admin)"
echo "Password: kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d"
echo "Staging:  http://staging.fellow.localhost/"
