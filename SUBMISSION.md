# Submission: Fellow (DevOps Capstone, Session 21)

| | |
|---|---|
| **Student** | Manasvi Sabbarwal |
| **Repository** | https://github.com/Manasvi-247/fellow-hrms |
| **Live app** | https://fellow-hrms.onrender.com (API docs: https://fellow-hrms-api.onrender.com/docs) |
| **Demo video** | [`demo/fellow-demo.mp4`](demo/fellow-demo.mp4), subtitles [`demo/fellow-demo.srt`](demo/fellow-demo.srt), also attached to [release v1.0.0](https://github.com/Manasvi-247/fellow-hrms/releases/tag/v1.0.0) |
| **Slides** | [`presentation.pptx`](presentation.pptx), PDF copy [`demo/slides.pdf`](demo/slides.pdf) |
| **Documentation** | [`README.md`](README.md) |

**Domain.** Fellow is an employee management (HR) app: employees, departments, leave with balances and approvals,
attendance with server-side check-in, and holidays. The application is my own domain; the DevOps layer follows the
TaskBoard architecture and extends it with GitOps (Argo CD), a Render deployment and scripted documentation.

Video times below are `mm:ss` in `demo/fellow-demo.mp4`.

---

## M1: Application (10)

| Criterion | Evidence |
|---|---|
| FastAPI starts and answers `/health` | [`backend/app/main.py`](backend/app/main.py); live: https://fellow-hrms-api.onrender.com/health |
| 4+ REST endpoints (GET, POST, PUT, DELETE) | 26 endpoints in [`backend/app/routers/`](backend/app/routers/); full list at `/docs`; video 02:37 |
| PostgreSQL table managed by Alembic | [`backend/alembic/versions/0001_initial_schema.py`](backend/alembic/versions/0001_initial_schema.py) (6 tables) |
| Frontend renders and calls the API | [`frontend/src/api.js`](frontend/src/api.js), pages in [`frontend/src/pages/`](frontend/src/pages/); video 00:52 |
| Responsive, usable UI | Light and dark themes, collapsible sidebar, phone layout; video 00:52 to 01:50 |

## M2: Testing (10)

| Criterion | Evidence |
|---|---|
| `pytest` runs without errors | `cd backend && pytest -v`: 35 passed; also runs in CI on every push |
| 5+ tests across 3+ endpoints | [`backend/tests/test_api.py`](backend/tests/test_api.py): 35 tests across health, employees, departments, leave, attendance, holidays and dashboard |
| Test database, not production | [`backend/tests/conftest.py`](backend/tests/conftest.py) points `DATABASE_URL` at a throwaway SQLite file and rebuilds it per test |
| `pytest.ini` / `conftest.py` | [`backend/pytest.ini`](backend/pytest.ini) and [`backend/tests/conftest.py`](backend/tests/conftest.py) |

## M3: Git and GitHub (5)

| Criterion | Evidence |
|---|---|
| Public repository | https://github.com/Manasvi-247/fellow-hrms |
| Meaningful commit messages | 60+ commits in Conventional Commits style (`feat(helm): ...`, `fix(backend): ...`); see the commit history |
| `.gitignore` covers `.env`, `__pycache__`, `node_modules`, `.venv` | [`.gitignore`](.gitignore) (also Terraform state, `*.tfvars` and kubeconfigs) |

## M4: Docker (10)

| Criterion | Evidence |
|---|---|
| `backend/Dockerfile` builds | [`backend/Dockerfile`](backend/Dockerfile) (multi-stage); built and pushed by CI |
| Frontend multi-stage (Node build, Nginx runtime) | [`frontend/Dockerfile`](frontend/Dockerfile): `node:22-alpine` build stage, `nginx-unprivileged` runtime |
| Non-root images | Backend runs as uid 10001, frontend as uid 101 (unprivileged nginx on port 8080) |
| `docker compose up --build` starts all three services | [`docker-compose.yml`](docker-compose.yml): postgres (with healthcheck), backend, frontend on http://localhost:3000 |

## M5: CI/CD (15)

| Criterion | Evidence |
|---|---|
| Workflow in `.github/workflows/` | [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) |
| Triggers on push to `main` | `on: push: branches: [main]` (plus pull requests) |
| pytest job fails the build on failure | `Backend tests (pytest)` job; images only build after it passes |
| Frontend built in the pipeline | `Frontend build` job (`npm ci`, `npm run build`) |
| Images for frontend and backend | `Image backend` / `Image frontend` matrix jobs |
| Pushed to GHCR | `ghcr.io/manasvi-247/hrms-backend` and `ghcr.io/manasvi-247/hrms-frontend` |
| Tags use the commit SHA, not `latest` | Tags are `${GITHUB_SHA}` only |
| Live run | Video 03:41 (a real push) to 04:36 (all five jobs green); runs at https://github.com/Manasvi-247/fellow-hrms/actions. Run 39146305868 deployed commit `ba69d69` through to EKS |

## M6: DevSecOps with Trivy (5)

| Criterion | Evidence |
|---|---|
| Trivy scans both images in CI | `Trivy scan` step in each image job (pinned `aquasec/trivy:0.58.1`) |
| Fails on HIGH or CRITICAL | `--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1` |
| Explain a finding | See below |

**What Trivy scanned and what it means.** Trivy scans two layers of each built image: the operating system packages of the
base image (Debian for the API, Alpine for nginx) and the language packages installed into it (Python wheels). The
pipeline fails if any HIGH or CRITICAL vulnerability with an available fix is found, so a vulnerable image is never
pushed to the registry. Current scans report 0 HIGH and 0 CRITICAL for both images. A later run caught CVE-2026-77214 in
libexpat because the build cache replayed an old `apk upgrade` layer; a per-run build argument now forces that layer to rebuild.

**A CVE it found.** The first run failed on [CVE-2025-62727](https://avd.aquasec.com/nvd/cve-2025-62727) in Starlette 0.41.3,
the web framework FastAPI is built on. A request with a crafted `Range` header made the server merge byte ranges
inefficiently, so a few requests could keep the CPU busy: a denial of service. Upgrading FastAPI and Starlette fixed it.
The same scan also flagged HIGH issues in openssl, libxml2, musl and zlib in the old nginx 1.27 Alpine image, fixed by
moving to nginx 1.30 and running `apk upgrade` in the image.

## M7: Terraform (15)

| Criterion | Evidence |
|---|---|
| Valid HCL in `terraform/` | [`terraform/`](terraform/): `network.tf`, `eks.tf`, `kind.tf`, `providers.tf`, `variables.tf`, `outputs.tf` |
| `terraform init` | Pins `hashicorp/aws ~> 6.69` and `tehcyx/kind ~> 0.11`; lock file committed |
| `terraform plan` (non-empty, no errors) | Local: 15 resources (video 05:03 and 05:31). Real AWS: 26 to add in workspace `aws` with `aws-sydney.tfvars` |
| VPC with 2+ public subnets | [`terraform/network.tf`](terraform/network.tf): VPC `10.20.0.0/16`, 2 public and 2 private subnets in 2 AZs, internet gateway, NAT gateway, route tables |
| EKS with a worker node group | [`terraform/eks.tf`](terraform/eks.tf): EKS 1.35, IAM roles, managed node group (2 x m7i-flex.large), Pod Identity and EBS CSI add-ons. Applied to real AWS in `ap-southeast-2`: cluster ACTIVE, 2 nodes Ready |
| `terraform destroy` | Local: destroy and re-apply ran cleanly (14 resources each way). Real AWS: [`scripts/eks-down.sh`](scripts/eks-down.sh) releases the load balancer and EBS volume, then `terraform destroy` removed every resource |
| `terraform.tfvars.example`, no credentials | [`terraform/terraform.tfvars.example`](terraform/terraform.tfvars.example); `*.tfvars` and state are gitignored |

**Note on AWS.** The same Terraform runs in two workspaces. `default` targets LocalStack and kind (free, shown in the video at
about 05:20). `aws` targets a real AWS account in `ap-southeast-2`: VPC, 2 public and 2 private subnets, NAT gateway, EKS and
its node group were applied, Fellow was deployed onto EKS by Argo CD and served through an AWS Network Load Balancer, and
everything was then destroyed to stop hourly billing. The organisation's policies deny IAM OIDC providers, so GitHub Actions
deploys through Argo CD's pull model instead of holding AWS credentials. Details and evidence: [README: Real AWS deployment](README.md#real-aws-deployment-vpc-and-eks).

## M8: Kubernetes and Helm (15)

| Criterion | Evidence |
|---|---|
| `k8s/namespace.yaml` | [`k8s/namespace.yaml`](k8s/namespace.yaml) |
| Helm chart with `Chart.yaml`, `values.yaml`, templates | [`helm/fellow/`](helm/fellow/) |
| `helm upgrade --install` works | [`scripts/deploy-kind.sh`](scripts/deploy-kind.sh); `helm list` in the video at 06:04 |
| 2+ replicas each for backend and frontend | Backend 2 to 6 via the HPA, frontend 2 |
| ClusterIP Services | `backend.yaml` and `frontend.yaml` templates |
| Ingress: `/` to frontend, `/api` to backend | [`helm/fellow/templates/ingress.yaml`](helm/fellow/templates/ingress.yaml) on ingress-nginx |
| All pods Running | `kubectl get pods,svc,ingress,hpa -n fellow`; video 05:53 |

Also included: an HPA that scaled the backend from 2 to 6 pods under load (video 06:32), migrations that run once under a
Postgres advisory lock, non-root pods with dropped capabilities, and a second environment (`fellow-staging`) deployed
by Argo CD from Git (video 04:37). The same chart also ran on real Amazon EKS
([`argocd/fellow-eks.yaml`](argocd/fellow-eks.yaml), [`helm/fellow/values-eks.yaml`](helm/fellow/values-eks.yaml)) with Postgres on
an EBS gp2 volume and the HPA reading metrics-server.

## M9: Observability (10)

| Criterion | Evidence |
|---|---|
| `/metrics` in Prometheus format | prometheus-fastapi-instrumentator in [`backend/app/main.py`](backend/app/main.py); video 06:50 |
| Prometheus installed and scraping | kube-prometheus-stack ([`monitoring/kube-prometheus-stack-values.yaml`](monitoring/kube-prometheus-stack-values.yaml)) and the chart's ServiceMonitor; targets UP at 07:02 |
| Grafana installed and accessible | Same stack, at http://grafana.localhost |
| A panel with live application metrics | 13-panel "Fellow / Backend API" dashboard shipped in [`helm/fellow/dashboards/`](helm/fellow/dashboards/); live during the load test at 07:06 |

## M10: Presentation and documentation (5)

| Criterion | Evidence |
|---|---|
| `README.md` with full technical docs | [`README.md`](README.md): purpose, architecture diagram, tech stack, local setup, CI/CD, Terraform, Kubernetes and Helm, observability, known issues |
| Video in the repo | [`demo/fellow-demo.mp4`](demo/fellow-demo.mp4) (8:55, 1080p, subtitles) |
| Slide deck committed (8+ slides) | [`presentation.pptx`](presentation.pptx), 12 slides |

**Video checklist coverage**

| Required in the video | Time |
|---|---|
| Slides: what was built and the architecture | 00:00 to 00:15, architecture slide before 01:51 |
| Codebase walkthrough | 01:51 |
| CI/CD: a push and the pipeline end to end | 03:31 |
| Terraform plan and the infrastructure | 04:53 |
| Argo CD synced application and GitOps flow | 04:37 |
| Kubernetes: pods, services, ingress | 05:43 |
| Prometheus targets UP | 07:02 |
| Grafana dashboard with live metrics | 07:06 |

---

## Known limitations

- EKS was applied, verified and destroyed (hourly cost), so it is not live; the always-on demo is on Render.
- ingress-nginx is retired upstream; it works for this demo.
- The live Render demo uses free instances: the API sleeps when idle and the free database expires after 30 days.

See [README: Known issues and limitations](README.md#known-issues-and-limitations) for the full list.
