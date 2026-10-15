#!/usr/bin/env bash
# Records command output for the terminal-style screenshots. Usage: terminal.sh [name ...]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/docs/screenshots/terminal"
mkdir -p "$OUT"

record() {
  local name="$1" cmd="$2"
  if [ "${#SELECTED[@]}" -gt 0 ] && [[ ! " ${SELECTED[*]} " =~ " $name " ]]; then return; fi
  echo "recording $name"
  { echo "\$ $cmd"; (cd "$ROOT" && eval "$cmd") 2>&1; } > "$OUT/$name.txt"
}

SELECTED=("$@")
record kubectl-fellow "kubectl get pods,svc,ingress,hpa -n fellow"
record kubectl-monitoring "kubectl get pods -n monitoring"
record helm-list "helm list -A"
record kind-nodes "kubectl get nodes -o wide"
record pytest "cd backend && .venv/bin/pytest -v -p no:warnings"
record docker-compose "docker compose ps"
record curl-health "curl -s http://localhost:8000/health; echo; curl -s http://localhost:8000/ready; echo"
record curl-metrics "curl -s http://localhost:8000/metrics | grep -E '^http_requests_total' | head -15"
