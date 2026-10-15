#!/usr/bin/env bash
# Generates in-cluster load on the backend so the HPA scales out. Watch with: kubectl get hpa -n fellow -w
set -euo pipefail

NAMESPACE="${NAMESPACE:-fellow}"
WORKERS="${WORKERS:-6}"
DURATION="${DURATION:-180}"
TARGET="${TARGET:-http://fellow-backend:8000/api/dashboard/stats}"

kubectl create deployment load-generator -n "$NAMESPACE" --image=busybox:1.37 --replicas="$WORKERS" \
  -- /bin/sh -c "while true; do wget -q -O /dev/null $TARGET; done"
trap 'kubectl delete deployment load-generator -n "$NAMESPACE" --ignore-not-found' EXIT

echo "Sending load to $TARGET with $WORKERS workers for ${DURATION}s"
end=$((SECONDS + DURATION))
while [ $SECONDS -lt $end ]; do
  kubectl get hpa -n "$NAMESPACE" --no-headers
  sleep 15
done
