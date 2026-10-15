# Terraform: AWS network, EKS and the local kind cluster

Infrastructure as code for Fellow. One configuration describes:

| File | What it creates |
|---|---|
| `network.tf` | VPC `10.20.0.0/16`, 2 public and 2 private subnets across 2 AZs, internet gateway, NAT gateway, route tables. Subnets carry the tags EKS needs for load balancers. |
| `eks.tf` | EKS control plane, IAM roles and a managed node group in the private subnets (`create_eks = true`). |
| `kind.tf` | A 3 node kind cluster (1 control plane, 2 workers) with ports 80/443 mapped for the ingress controller (`create_kind_cluster = true`). |

By default AWS calls go to [LocalStack](https://www.localstack.cloud/) on `localhost:4566`, so nothing is billed.
LocalStack's free edition does not emulate EKS, so the app runs on the kind cluster instead; the EKS code is
still validated by `terraform plan -var create_eks=true`, and runs unchanged against real AWS.

## Run it locally

```bash
docker compose -f terraform/localstack/docker-compose.yml -p fellow-localstack up -d
cd terraform
cp terraform.tfvars.example terraform.tfvars   # optional
terraform init
terraform plan
terraform apply
```

Then install the cluster add-ons and the app (from the repo root):

```bash
scripts/kind-up.sh && scripts/deploy-kind.sh && scripts/monitoring-up.sh
```

Inspect the emulated network:

```bash
aws --endpoint-url http://localhost:4566 --region ap-south-1 ec2 describe-vpcs --filters Name=tag:Project,Values=fellow
aws --endpoint-url http://localhost:4566 --region ap-south-1 ec2 describe-subnets --filters Name=tag:Project,Values=fellow
```

Tear everything down (VPC, subnets, NAT and the kind cluster):

```bash
terraform destroy
```

## Real AWS

```bash
terraform apply -var use_localstack=false -var create_eks=true -var create_kind_cluster=false
aws eks update-kubeconfig --region ap-south-1 --name fellow
```

This costs money (EKS control plane, NAT gateway, two t3.medium nodes). Run `terraform destroy` as soon as you are done.
Credentials come from your normal AWS profile or environment, never from files in this repo.

## Notes

- State is local (`terraform.tfstate`, gitignored). For a team, move it to an S3 backend with locking.
- One NAT gateway keeps cost down; production would use one per AZ.
- `localstack/localstack:4.14` is the last image that runs without a LocalStack account. Newer images need a free auth token, see `localstack/docker-compose.yml`.
