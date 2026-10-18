<p align="center">
  <img src="docs/screenshots/app-dashboard.png" alt="Fellow dashboard" width="900">
</p>

<h1 align="center">Fellow</h1>
<p align="center"><b>An employee management app, shipped the DevOps way.</b><br>
React · FastAPI · PostgreSQL · Docker · GitHub Actions · Trivy · GHCR · Terraform · AWS (VPC, EKS) · LocalStack · Kubernetes (kind, EKS) · Helm · Argo CD · Prometheus · Grafana</p>

<p align="center"><b>Live:</b> <a href="https://fellow-hrms.onrender.com">fellow-hrms.onrender.com</a> · API docs: <a href="https://fellow-hrms-api.onrender.com/docs">fellow-hrms-api.onrender.com/docs</a><br><sub>Free tier: the API sleeps when idle, so the first request can take about a minute.</sub></p>

<p align="center">
  <a href="https://github.com/Manasvi-247/fellow-hrms/actions/workflows/ci-cd.yml"><img src="https://github.com/Manasvi-247/fellow-hrms/actions/workflows/ci-cd.yml/badge.svg" alt="CI/CD"></a>
</p>

Fellow is a lightweight HR workspace for a 20 to 200 person company: people, departments, leave and attendance in one place.
The application is the vehicle; the point of the project is the path it takes from a laptop to a monitored Kubernetes cluster:
tested, scanned, containerised, provisioned with Terraform, packaged with Helm and delivered through GitOps.

Built as the DevOps final capstone (Session 21).

## Demo video

[![Watch the Fellow demo video](docs/screenshots/demo-video-thumbnail.png)](demo/fellow-demo.mp4)

**[Watch the 9 minute walkthrough](demo/fellow-demo.mp4)** (1080p, subtitles burned in, [`.srt`](demo/fellow-demo.srt) included): the app, the codebase and API docs,
a live push through CI/CD and Argo CD, Terraform, Kubernetes autoscaling, Prometheus and Grafana, and the troubleshooting labs.
Every scene is a real screen recording, produced with the scripts in [`tools/video`](tools/video/).

Slides: [`presentation.pptx`](presentation.pptx) (PDF copy: [`demo/slides.pdf`](demo/slides.pdf)).

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Repository layout](#repository-layout)
5. [Run it locally with Docker Compose](#run-it-locally-with-docker-compose)
6. [Backend and tests](#backend-and-tests)
7. [CI/CD and DevSecOps](#cicd-and-devsecops)
8. [Infrastructure with Terraform](#infrastructure-with-terraform)
9. [Kubernetes and Helm](#kubernetes-and-helm)
10. [GitOps with Argo CD](#gitops-with-argo-cd)
11. [Real AWS deployment: VPC and EKS](#real-aws-deployment-vpc-and-eks)
12. [Observability](#observability)
13. [Troubleshooting labs](#troubleshooting-labs)
14. [Live deployment on Render](#live-deployment-on-render)
15. [Screenshots](#screenshots)
16. [Known issues and limitations](#known-issues-and-limitations)

---

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Headcount, who is in, who is out, pending approvals, headcount by department, today's attendance donut, upcoming holidays, birthdays and work anniversaries. |
| **Employees** | Directory with search, filters, table and card views; add, edit, exit and delete; profiles with overview, leave, attendance and team tabs. |
| **Departments** | Heads of department and live headcount. Deleting a department that still has people is blocked. |
| **Leave** | Casual, sick and earned leave with yearly balances. Weekends and holidays are not counted, half days are supported, overlapping requests are rejected. Managers and admins approve or reject; nobody approves their own leave. |
| **Attendance** | Check in and check out with server time (late after 09:30 IST), a daily board, and a monthly calendar per person. Shifts that cross midnight close correctly. |
| **Holidays** | Public and optional holidays that feed the leave and attendance rules. |
| **Roles** | No login screen for the demo: a "Viewing as" switcher picks the current user. Admins and managers see approvals; employees get a self-service view. |
| **UI** | Light and dark themes, a collapsible sidebar, real URL routing (`/employees/12`, `/leave/approvals`), responsive down to phone width. |

## Architecture

```mermaid
flowchart LR
    dev([Developer]) -- git push --> gh[(GitHub<br/>main)]
    gh --> ci[GitHub Actions<br/>pytest · build · Trivy]
    ci -- images tagged with commit SHA --> ghcr[(GHCR)]
    ci -- bot commits new tag --> gh
    gh -. watched by .-> argo[Argo CD]

    subgraph vpc[AWS VPC on LocalStack · Terraform]
      subgraph kind[kind cluster · 3 nodes · Terraform]
        ing[ingress-nginx]
        subgraph app[namespace fellow / fellow-staging]
          fe[Frontend x2<br/>React on nginx]
          be[Backend x2-6<br/>FastAPI + HPA]
          db[(PostgreSQL<br/>StatefulSet + PVC)]
        end
        prom[Prometheus]
        graf[Grafana]
        argo
      end
    end

    user([Browser]) --> ing
    ing -- "/" --> fe
    ing -- "/api" --> be
    be --> db
    prom -- scrapes /metrics --> be
    graf --> prom
    argo -- syncs Helm chart --> app
    ghcr -- pulls images --> app
```

**Request path.** The browser reaches the ingress controller. `/` goes to the React frontend (static files on unprivileged nginx);
`/api` goes to the FastAPI backend, which talks to PostgreSQL through SQLAlchemy. The frontend never needs the backend's hostname.

**Delivery path.** A push to `main` runs the pipeline. If tests pass and Trivy finds no HIGH or CRITICAL vulnerabilities, both images are
pushed to GHCR tagged with the commit SHA. A bot commit writes that SHA into `helm/fellow/values-staging.yaml`, and Argo CD rolls the
staging environment to it. Git is the single source of truth for what runs in staging.

The diagram shows the local setup. The same Terraform, Helm chart and Argo CD flow also ran on a real Amazon EKS cluster, where
the cluster sits in private subnets of a real VPC and an AWS Network Load Balancer replaces localhost; see
[Real AWS deployment](#real-aws-deployment-vpc-and-eks).

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18, Vite 6, react-router 6, Phosphor icons, plain CSS with light and dark themes |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic, prometheus-fastapi-instrumentator |
| Database | PostgreSQL 16 |
| Tests | pytest (34 tests, SQLite test database) |
| Containers | Docker multi-stage builds, non-root users, Docker Compose |
| CI/CD | GitHub Actions, GitHub Container Registry (GHCR) |
| Security | Trivy image scanning, actionlint, pinned dependencies, non-root pods, no secrets in Git |
| Infrastructure | Terraform, real AWS (VPC, NAT, EKS 1.35, EBS CSI) in `ap-southeast-2`, LocalStack (AWS emulator), kind |
| Orchestration | Kubernetes, Helm, ingress-nginx, Horizontal Pod Autoscaler, metrics-server |
| GitOps | Argo CD |
| Observability | Prometheus, Grafana, kube-state-metrics (kube-prometheus-stack) |

## Repository layout

```text
.
├── backend/               FastAPI app, Alembic migrations, pytest suite, Dockerfile
│   ├── app/               models, schemas, routers, services, seed data, bootstrap (migrate + seed)
│   ├── alembic/versions/  database migrations
│   └── tests/             pytest tests and fixtures
├── frontend/              React + Vite app, nginx config, multi-stage Dockerfile
├── docker-compose.yml     full local stack: postgres, backend, frontend
├── .github/workflows/     CI/CD pipeline
├── terraform/             VPC, subnets, NAT, EKS (optional) and the kind cluster; LocalStack compose file
├── helm/fellow/           Helm chart, values for kind (dev) and staging, Grafana dashboard JSON
├── argocd/                Argo CD Application for staging and its ingress
├── k8s/                   namespace bootstrap manifest
├── monitoring/            kube-prometheus-stack values
├── scripts/               kind add-ons, deploy, monitoring, Argo CD and load test scripts
├── troubleshooting/       broken image and broken Service labs
├── tools/screenshots/     reproducible live screenshots for these docs
├── tools/video/           scripted screen recording, subtitles and assembly for the demo video
├── docs/screenshots/      screenshots used below
├── demo/                  demo video, its subtitles and a PDF copy of the slides
└── presentation.pptx      presentation deck
```

## Run it locally with Docker Compose

Requirements: Docker Desktop (or Docker Engine with Compose v2).

```bash
git clone https://github.com/Manasvi-247/fellow-hrms.git
cd fellow-hrms
docker compose up --build
```

| URL | What |
|---|---|
| http://localhost:3000 | Fellow web app |
| http://localhost:8000/docs | Swagger UI for the API |
| http://localhost:8000/health | liveness, `{"status":"UP"}` |
| http://localhost:8000/ready | readiness, checks the database |
| http://localhost:8000/metrics | Prometheus metrics |

On start the backend runs `python -m app.bootstrap`, which applies Alembic migrations and loads demo data (25 employees,
5 departments, a month of attendance, leave requests, 2026 holidays) under a Postgres advisory lock, so several replicas
starting together never race. Dates in the demo data are relative to today, so the dashboard always looks current.

```bash
docker compose down        # stop
docker compose down -v     # stop and delete the database volume
```

## Backend and tests

### API

26 REST endpoints under `/api`, plus `/health`, `/ready` and `/metrics`. Full schema at `/docs`.

| Resource | Endpoints |
|---|---|
| Dashboard | `GET /api/dashboard/stats` |
| Employees | `GET /api/employees` (search and filters), `GET/PUT/DELETE /api/employees/{id}`, `POST /api/employees`, `GET /api/employees/{id}/reports`, `GET /api/employees/{id}/leave-balance` |
| Departments | `GET/POST /api/departments`, `GET/PUT/DELETE /api/departments/{id}` |
| Leave | `GET /api/leave-types`, `GET/POST /api/leaves`, `GET /api/leaves/{id}`, `POST /api/leaves/{id}/approve`, `/reject`, `/cancel` |
| Attendance | `GET /api/attendance` (daily board or monthly history), `POST /api/attendance/check-in`, `POST /api/attendance/check-out` |
| Holidays | `GET/POST /api/holidays`, `DELETE /api/holidays/{id}` |

### Run without Docker

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://hrms:hrms@localhost:5432/hrms'
SEED_DEMO_DATA=true python -m app.bootstrap
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm ci && npm run dev    # http://localhost:5173, proxies /api to :8000
```

### Tests

```bash
cd backend && pytest -v
```

34 tests run against a throwaway SQLite database (configured in `tests/conftest.py` and `pytest.ini`), never the real one.
They cover health and readiness, metrics, every resource's CRUD paths, validation errors, leave rules (working days, balances,
overlaps, half days on weekends, approval permissions), attendance (late check-in, server-side time, overnight shifts, the daily board on
non-working days), dashboard counts, idempotent seeding, and a guard that list endpoints do not issue one query per row.

## CI/CD and DevSecOps

Workflow: [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml). Runs on every push and pull request to `main`.

```text
push to main
  ├─ Backend tests (pytest)          fails the build on any failing test
  └─ Frontend build (npm ci, vite)
        └─ Image backend  ┐  build once, scan with Trivy (fail on HIGH/CRITICAL),
           Image frontend ┘  push ghcr.io/manasvi-247/hrms-{backend,frontend}:<commit sha>
                 └─ Promote to staging   bot commits the SHA to helm/fellow/values-staging.yaml
                          └─ Argo CD sees the commit and rolls staging
```

- **Tests before images.** Images are only built after pytest and the frontend build pass, so a broken commit never reaches the registry.
- **SHA tags, no `latest`.** Every image is traceable to the exact commit that produced it, which also makes rollback a one-line change.
- **Trivy gate.** Trivy (pinned official image, `0.58.1`) scans both images with `--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`.
  The report is shown on the run page and kept as an artifact.
- **Pull requests** run tests, builds and scans but never push or deploy.
- **Concurrency.** Pull request runs replace each other; every push to `main` gets its own run, so every commit gets its images.

**What Trivy found.** The first scan failed the build: Starlette 0.41.3 (pulled in by FastAPI) had three HIGH vulnerabilities, including
[CVE-2025-62727](https://avd.aquasec.com/nvd/cve-2025-62727), a denial of service where a crafted `Range` header makes the server merge
ranges inefficiently and burn CPU. The nginx 1.27 Alpine base also had HIGH issues in openssl, libxml2, musl and zlib. Upgrading FastAPI
and Starlette, moving to nginx 1.30 and running `apk upgrade` in the image brought both scans to 0 HIGH and 0 CRITICAL.

**A second catch, and a cache bug.** Later, the frontend scan failed on CVE-2026-77214 in libexpat 2.8.5 even though the image runs
`apk upgrade`. The GitHub Actions build cache was replaying an old `apk upgrade` layer, so the fixed package (2.9.0) was never
installed. The workflow now passes a per-run build argument (`APK_REFRESH=<run id>`) that forces that one layer to rebuild every
time, so security fixes in the base image are always picked up while the rest of the cache still works.

Other security controls:

- Both images run as non-root (`uid 10001` for the API, `101` for nginx) and pods drop all Linux capabilities with a `RuntimeDefault` seccomp profile.
- No credentials in Git: the Grafana and staging database passwords are generated into Kubernetes Secrets by the setup scripts, and Terraform state and `*.tfvars` are ignored.
- `.dockerignore` files keep tests, virtualenvs and `.env` files out of images.

## Infrastructure with Terraform

Code: [`terraform/`](terraform/). Details in [`terraform/README.md`](terraform/README.md).

| File | Creates |
|---|---|
| `network.tf` | VPC `10.20.0.0/16` in `ap-south-1`, 2 public and 2 private subnets across 2 AZs, internet gateway, NAT gateway, route tables, EKS subnet tags |
| `eks.tf` | EKS control plane, IAM roles and a managed node group (`create_eks = true`) |
| `kind.tf` | the local 3 node kind cluster (1 control plane, 2 workers) with ports 80 and 443 mapped |

The same code runs in two modes, kept apart with Terraform workspaces so their state never mixes:

| Workspace | Target | What it builds |
|---|---|---|
| `default` | [LocalStack](https://www.localstack.cloud/) (free, nothing billed) + kind | VPC, subnets and NAT emulated locally; the cluster is kind, because LocalStack's free edition has no EKS |
| `aws` | real AWS, `ap-southeast-2` (Sydney) | VPC, subnets, NAT, EKS 1.35, managed node group, Pod Identity and the EBS CSI driver: 26 resources |

Local run:

```bash
docker compose -f terraform/localstack/docker-compose.yml -p fellow-localstack up -d
cd terraform
terraform init
terraform plan          # 15 resources
terraform apply
terraform destroy       # removes the VPC, subnets, NAT and the kind cluster
```

Real AWS run (authenticated with `aws login`, short-lived credentials, no access keys on disk):

```bash
cd terraform
terraform workspace select aws
terraform plan  -var-file=aws-sydney.tfvars    # 26 to add
terraform apply -var-file=aws-sydney.tfvars
terraform destroy -var-file=aws-sydney.tfvars
```

`aws-sydney.tfvars` (gitignored) sets `use_localstack=false`, `create_eks=true`, `create_kind_cluster=false`, region `ap-southeast-2`
with zones `2a` and `2b`, and `node_instance_types=["m7i-flex.large"]`.

## Kubernetes and Helm

Chart: [`helm/fellow/`](helm/fellow/).

| Template | Purpose |
|---|---|
| `backend.yaml` | Deployment and ClusterIP Service for FastAPI. Init containers wait for Postgres, then run migrations and the seed under an advisory lock. Startup, readiness (`/ready`) and liveness (`/health`) probes. |
| `frontend.yaml` | Deployment and ClusterIP Service for the React app on nginx |
| `postgres.yaml` | PostgreSQL StatefulSet with a PersistentVolumeClaim and a ClusterIP Service |
| `secret.yaml` | database credentials, or bring your own with `postgres.existingSecret` |
| `ingress.yaml` | routes `/` to the frontend and `/api` to the backend |
| `hpa.yaml` | autoscales the backend from 2 to 6 pods at 60% CPU |
| `servicemonitor.yaml` | tells Prometheus to scrape the backend's `/metrics` |
| `grafana-dashboard.yaml` | ships the Grafana dashboard as a ConfigMap |

Two environments run from the same chart:

| | dev | staging |
|---|---|---|
| Namespace | `fellow` | `fellow-staging` |
| URL | http://fellow.localhost | http://staging.fellow.localhost |
| Images | built locally, loaded into kind | pulled from GHCR, tagged with the commit SHA |
| Deployed by | `helm upgrade --install` | Argo CD |

### Bring the whole platform up

```bash
cd terraform && terraform apply && cd ..   # VPC on LocalStack + kind cluster
scripts/kind-up.sh                          # ingress-nginx and metrics-server
scripts/monitoring-up.sh                    # Prometheus and Grafana
scripts/deploy-kind.sh                      # build images, load into kind, helm upgrade --install (dev)
scripts/argocd-up.sh                        # Argo CD and the staging Application
```

`*.localhost` resolves to your machine in every modern browser, so no hosts file edits are needed.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl get pods,svc,ingress,hpa -n fellow
helm list -A
```

### Autoscaling demo

```bash
scripts/load-test.sh                 # in-cluster load generator for 3 minutes
kubectl get hpa -n fellow -w         # watch replicas go from 2 to 6
```

During testing, CPU reached about 350% of the target and the HPA scaled the backend from 2 to 6 pods.

## GitOps with Argo CD

[`argocd/fellow-staging.yaml`](argocd/fellow-staging.yaml) defines an Application that tracks `helm/fellow` on `main` with
`values-staging.yaml`, auto-sync, pruning and self-heal. Because CI commits each new image tag to that file, every green build on
`main` reaches staging automatically, and a manual change in the cluster is reverted to what Git says.

- UI: http://argocd.localhost (user `admin`)
- Password: `kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d`

## Real AWS deployment: VPC and EKS

Fellow was deployed to a real Amazon EKS cluster built by the Terraform above, then torn down after the evidence was captured
(an EKS control plane and a NAT gateway bill by the hour).

```text
git push ─▶ GitHub Actions ─▶ GHCR (image:<sha>) ─▶ bot commits <sha> to values-staging.yaml
                                                          │
             AWS ap-southeast-2                           ▼  (Argo CD pulls from Git)
  ┌─────────────────────────────── VPC 10.20.0.0/16 ─────────────────────────────┐
  │ public subnets 2a, 2b:  Network Load Balancer, NAT gateway                    │
  │ private subnets 2a, 2b: EKS 1.35 node group (2 x m7i-flex.large)              │
  │      ingress-nginx ─▶ frontend x2, backend x2-6 (HPA) ─▶ Postgres on EBS gp2  │
  │      Argo CD, metrics-server, EBS CSI driver (Pod Identity)                   │
  └──────────────────────────────────────────────────────────────────────────────┘
```

| Piece | How |
|---|---|
| Cluster add-ons | [`scripts/eks-up.sh`](scripts/eks-up.sh): kubeconfig, ingress-nginx (AWS provider, creates the NLB), metrics-server, Argo CD, a random database password in a Secret, then the Application |
| Application | [`argocd/fellow-eks.yaml`](argocd/fellow-eks.yaml): the same chart with `values-staging.yaml` plus [`values-eks.yaml`](helm/fellow/values-eks.yaml) (gp2 storage class, no host rule so the NLB hostname works) |
| Storage | The EBS CSI driver add-on, authorised through EKS Pod Identity, provisions a 1 GiB gp2 volume for Postgres |
| Delivery | A push to `main` reaches EKS with no manual step: CI pushes the SHA image and commits the tag, Argo CD on EKS pulls the change and rolls the pods |
| Teardown | [`scripts/eks-down.sh`](scripts/eks-down.sh) deletes the app and ingress first, which releases the NLB and EBS volume, then `terraform destroy` |

**Why Argo CD pulls instead of Actions pushing.** The AWS account belongs to an organisation whose policies deny creating IAM OIDC
providers, so GitHub Actions cannot get AWS credentials without long-lived keys. Argo CD runs inside the cluster and pulls from
Git, so CI never needs cluster or AWS credentials at all. That is the GitOps pull model, and it is the safer design anyway.

**Verified end to end.** Commit `ba69d69` ran through all five CI jobs (Trivy 0 HIGH, 0 CRITICAL), the bot promoted it, and both
EKS deployments rolled to `hrms-*:ba69d69...` with 2/2 pods ready, served at the NLB's `*.elb.ap-southeast-2.amazonaws.com` address.

| | |
|---|---|
| ![terraform plan](docs/screenshots/rubric/m7-aws-plan.png) **`terraform plan` on real AWS** | ![terraform apply](docs/screenshots/rubric/m7-aws-apply.png) **`terraform apply` complete** |
| ![VPC and subnets](docs/screenshots/rubric/m7-aws-vpc-subnets.png) **VPC and 4 subnets** | ![NAT and EKS](docs/screenshots/rubric/m7-aws-nat-eks-cluster.png) **NAT gateway and EKS cluster, ACTIVE** |
| ![Node group and EC2](docs/screenshots/rubric/m8-eks-nodegroup-ec2.png) **Node group and EC2 workers** | ![Nodes](docs/screenshots/rubric/m8-eks-nodes.png) **`kubectl get nodes` on EKS** |
| ![Workloads](docs/screenshots/rubric/m8-eks-workloads.png) **Pods, services, ingress, HPA, PVC, Argo CD Synced** | ![Load balancer](docs/screenshots/rubric/m8-eks-lb.png) **AWS Network Load Balancer** |
| ![App on EKS](docs/screenshots/rubric/m8-eks-app.png) **Fellow served from EKS** | ![Actions run](docs/screenshots/rubric/m5-actions-eks.png) **The CI run that deployed it** |

<p align="center"><img src="docs/screenshots/rubric/m7-aws-destroy.png" alt="terraform destroy" width="700"><br><b><code>terraform destroy</code>: 26 destroyed, nothing left running</b></p>

## Observability

- The backend exposes Prometheus metrics at `/metrics` (request counts by handler, method and status class, latency histograms, sizes).
- `kube-prometheus-stack` (chart `92.8.0`) installs Prometheus, Grafana, kube-state-metrics and node-exporter. Values are in [`monitoring/`](monitoring/).
- The chart's ServiceMonitor makes Prometheus scrape every backend pod every 15 seconds.
- The **Fellow / Backend API** dashboard ships inside the Helm chart and loads into Grafana automatically. Its 13 panels cover request rate, 5xx error rate, p50/p95/p99 latency, traffic per endpoint, responses by status class, slowest endpoints, HPA replicas, and CPU and memory per pod.

| URL | |
|---|---|
| http://prometheus.localhost/targets | scrape targets (backend pods should be `UP`) |
| http://grafana.localhost | Grafana, user `admin` |

Grafana password: `kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d`

## Troubleshooting labs

See [`troubleshooting/README.md`](troubleshooting/README.md).

1. **Broken image:** a Deployment pointing at a tag that does not exist. Expect `ErrImagePull` then `ImagePullBackOff`; diagnose with `kubectl describe pod` and `kubectl get events`.
2. **Broken Service:** a Service whose selector matches no pods. Expect an EndpointSlice with no endpoints; compare the selector with `kubectl get pods --show-labels` and patch it.

Problems hit and fixed while building this:

| Symptom | Cause | Fix |
|---|---|---|
| CI failed at the Trivy step | HIGH CVEs in Starlette and Alpine packages | upgraded dependencies and base image |
| A backend pod crashed on first deploy | two replicas ran migrations and the seed at once | Postgres advisory lock in `app.bootstrap`, run once in an init container |
| `fellow.localhost` returned nothing after recreating the cluster | the ingress controller was scheduled on a worker without the port 80 mapping | pin the controller to the control plane node in `kind-up.sh` |
| Staging showed old demo data | the database volume was seeded by an older image and seeding is idempotent | reset the staging database volume |
| Code review | 10 issues (null updates, half days on weekends, overnight check-out, N+1 queries and more) | fixed, each with a regression test |

## Live deployment on Render

The public demo runs on [Render](https://render.com)'s free tier, defined as code in [`render.yaml`](render.yaml) (a Render Blueprint):

| Resource | What it is |
|---|---|
| `fellow-db` | Free PostgreSQL 16 in Singapore |
| `fellow-hrms-api` | The FastAPI backend, built from `backend/Dockerfile`; migrations and demo data run on start |
| `fellow-hrms` | The React app as a static site; `/api/*` is rewritten to the API, everything else to `index.html` |

Each service only redeploys when its own folder changes, so the CI bot's staging commits do not trigger deploys.
To reproduce it: Render dashboard → **New → Blueprint** → pick this repository → **Apply**.

| URL | |
|---|---|
| https://fellow-hrms.onrender.com | the app |
| https://fellow-hrms-api.onrender.com/docs | Swagger API docs |
| https://fellow-hrms-api.onrender.com/health | liveness |

## Screenshots

| | |
|---|---|
| ![Dashboard](docs/screenshots/app-dashboard.png) **Dashboard** | ![Dark mode](docs/screenshots/app-dark.png) **Dark mode** |
| ![Employees](docs/screenshots/app-employees.png) **Employees** | ![Profile](docs/screenshots/app-profile.png) **Employee profile** |
| ![Leave approvals](docs/screenshots/app-leave.png) **Leave approvals** | ![Attendance](docs/screenshots/app-attendance.png) **Attendance board** |
| ![Grafana](docs/screenshots/grafana-dashboard.png) **Grafana dashboard** | ![Prometheus targets](docs/screenshots/prometheus-targets.png) **Prometheus targets, UP** |
| ![GitHub Actions](docs/screenshots/github-actions-run.png) **Green pipeline** | ![Swagger](docs/screenshots/api-swagger.png) **API docs** |

<p align="center"><img src="docs/screenshots/app-mobile.png" alt="Mobile view" width="260"><br><b>Phone layout</b></p>

Browser screenshots are captured live from the running stack with [`tools/screenshots`](tools/screenshots/); see [`docs/screenshots/README.md`](docs/screenshots/README.md).

## Known issues and limitations

- **Render free tier.** The API spins down after 15 minutes without traffic and takes about a minute to wake up, and the free database expires 30 days after creation (with a 14 day grace period).
- **EKS is not left running.** The real EKS deployment was applied, verified and destroyed to avoid hourly cost; the always-on public demo is the Render deployment, and day-to-day Kubernetes work uses the kind cluster.
- **AWS organisation limits.** The account's policies only allow `ap-southeast-2` and deny IAM OIDC providers, so the cluster is in Sydney and CI deploys through Argo CD rather than with AWS credentials. The account's free plan also limits node types, hence `m7i-flex.large`.
- **LocalStack is pinned to `4.14`,** the last community image that starts without an account. Newer images need a free auth token (see `terraform/localstack/docker-compose.yml`).
- **ingress-nginx is retired upstream** (maintenance ended in March 2026). It works for this demo; a production setup would move to the Gateway API or another controller such as Traefik.
- **No authentication.** The "Viewing as" switcher stands in for login, so any visitor can act as any user. Real use needs SSO or OAuth and server-side authorization.
- **In-cluster PostgreSQL.** Fine for the demo; production would use a managed database such as Amazon RDS with backups and point-in-time recovery.
- **Local Terraform state.** A team would keep state in S3 with locking.
- **Single NAT gateway** to keep cost down; production would use one per availability zone.
- **CI commits to `main`.** The staging promotion commit means a local `git pull --rebase` is needed before pushing.
- **Demo data is idempotent.** An existing database is never re-seeded, so after the seed changes the staging volume has to be reset to pick up new demo data.

## Demo

- Video: [`demo/fellow-demo.mp4`](demo/fellow-demo.mp4) with subtitles in [`demo/fellow-demo.srt`](demo/fellow-demo.srt)
- Slides: [`presentation.pptx`](presentation.pptx) and [`demo/slides.pdf`](demo/slides.pdf)
