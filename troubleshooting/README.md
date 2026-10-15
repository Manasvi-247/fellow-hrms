# Troubleshooting labs

Run these against the `fellow` namespace after deploying the Helm chart.

## Lab 1: broken image

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n fellow -l app=fellow-broken-image
kubectl describe pod -n fellow -l app=fellow-broken-image
kubectl get events -n fellow --sort-by=.lastTimestamp | tail
```

Expected: `ErrImagePull` then `ImagePullBackOff`, with a "not found" message for the `does-not-exist` tag.
Fix: point the image at a tag that exists (a commit SHA pushed by CI), for example
`kubectl set image deployment/fellow-broken-image -n fellow backend=ghcr.io/manasvi-247/hrms-backend:<sha>`.

## Lab 2: broken Service

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get endpointslices -n fellow -l kubernetes.io/service-name=fellow-broken-service
kubectl get pods -n fellow --show-labels | grep backend
kubectl run curl -n fellow --rm -it --image=curlimages/curl:8.11.1 --restart=Never -- curl -m 5 http://fellow-broken-service:8000/health
```

Expected: the EndpointSlice lists no endpoints and the curl times out. The selector uses
`app.kubernetes.io/name: fellow-backend`, but the backend pods are labelled `app.kubernetes.io/name: backend`.
Fix: `kubectl patch service fellow-broken-service -n fellow -p '{"spec":{"selector":{"app.kubernetes.io/name":"backend"}}}'`
and check that the EndpointSlice now lists the backend pod IPs.

## Clean up

```bash
kubectl delete -f troubleshooting/
```
