# AWS Cloud Engineering Capstone — Phase 2

![Architecture diagram](./Phase2-Capstone.png)

A multi-service AWS system built as the capstone for Phase 2 of my cloud engineering roadmap. Every piece was built by hand, in the console, with the theory behind each decision understood before it was implemented.

## What this is

A containerized Express + MySQL application running on a custom-built network, backed by automated database backups, monitored infrastructure, and a CDN-fronted static portfolio — all secured with least-privilege IAM roles and security groups.

## Architecture

```
Users
  │
  ├──> CloudFront (HTTPS, global edge cache) ──> S3 bucket (portfolio site)
  │
  └──> EC2 (public subnet, Docker container running Express)
           │
           └──> RDS MySQL (private subnet, no internet access)
                    │
                    └──> Lambda (daily scheduled trigger)
                              │
                              └──> VPC Gateway Endpoint ──> S3 bucket (RDS backups)

CloudWatch watches EC2 (CPU) and RDS (free storage) ──> SNS ──> email alert
```

## Why it's built this way

**Public/private subnet split.** EC2 sits in a public subnet because it needs to serve HTTP/HTTPS traffic to the internet. RDS sits in a private subnet with no route to the internet at all — not firewalled off, but structurally unreachable from outside the VPC. The only way in is through a security group rule that explicitly trusts EC2 and Lambda's security groups, nothing else.

**Two Availability Zones.** Every subnet is duplicated across `ap-south-1a` and `ap-south-1b`, even though only one AZ is actively used right now. This is required for RDS's subnet group regardless of whether Multi-AZ is enabled, and it means the network is already ready for high availability later without any redesign.

**No NAT Gateway.** A NAT Gateway would give the private subnet full outbound internet access, but costs roughly $30/month whether it's used or not. Since the only outbound need was Lambda reaching S3, a VPC Gateway Endpoint was used instead — free, and scoped to exactly that one service.

**Docker instead of a manually configured server.** The Express app is built from a Dockerfile and run as a container, so the exact same environment can be reproduced on any machine with Docker installed, rather than depending on manually-run setup scripts.

**IAM roles scoped per service.** `gujju-admin` is the human operator's IAM user. `gujju-lambda-backup-role` is scoped to exactly what the backup function needs: basic execution, VPC access, and S3 write access — nothing more.

**Security groups reference each other, not IP addresses.** RDS's security group allows inbound MySQL traffic only from `gujju-ec2-sg` and `gujju-lambda-sg` as security group sources, not from specific IPs. This means the rule keeps working correctly even if EC2 or Lambda's underlying IP changes, since AWS resolves the rule against group membership, not a fixed address.

## Components

| Component | Purpose |
|---|---|
| VPC (`gujju-main-vpc`) | Custom network, `10.0.0.0/16`, 4 subnets across 2 AZs |
| EC2 (`gujju-web-server`) | Runs the Express app inside a Docker container |
| RDS (`gujju-db`) | MySQL database, private subnet only |
| S3 — portfolio bucket | Static site, fronted by CloudFront |
| S3 — backups bucket | Daily JSON backups of the `users` table |
| Lambda (`gujju-rds-backup`) | Queries RDS and uploads a backup to S3 on a schedule |
| CloudFront | HTTPS CDN in front of the portfolio bucket |
| CloudWatch + SNS | CPU alarm on EC2, low-storage alarm on RDS, both emailing on alert |
| GitHub Actions | Builds and redeploys the Docker container to EC2 on every push to `main` |

## What I'd do differently at scale

- Add an Elastic IP so `EC2_HOST` doesn't need manual updates in CI/CD every time the instance restarts
- Enable RDS Multi-AZ for automatic failover, given the subnet groundwork already supports it
- Move from a single `SELECT *` backup to incremental, table-specific backups as the schema grows
- Add a WAF in front of CloudFront once the site carries real traffic worth defending

## Cost notes

Everything here stays within AWS free tier except RDS/EC2 compute time while running, and the ~$0.50/month it would cost to add a Route53 hosted zone (skipped for now — using CloudFront's default domain instead of a custom one).
