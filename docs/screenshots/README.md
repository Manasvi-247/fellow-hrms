# Screenshots

Live captures of every service, used in the main README, the slides and the demo video.
Regenerate them after changes with:

```bash
cd tools/screenshots && npm ci && npm run capture
```

Terminal screenshots (kubectl, helm, pytest, terraform) are taken directly from the real terminal window.

`npm run capture -- <name> ...` captures only the named shots, for example `npm run capture -- grafana-dashboard`.
Capture needs the kind cluster (`scripts/kind-up.sh`, `scripts/deploy-kind.sh`, `scripts/monitoring-up.sh`)
and the Docker Compose stack running, plus Google Chrome installed.
