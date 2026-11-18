# ADR-0003: Deployment and runtime architecture

- Status: **Working draft**
- Date: 2026-11-08 (carried forward)
- Deciders: Rewrite initiative (not confirmed)

## Context

Two topics get mixed together:

1. App / runtime shape: processes, gateways, data stores, sync vs async
2. Cloud / IaC: which cloud, how VMs or clusters are provisioned, Compose vs Kubernetes

OG production evidence points to Docker Compose on a Linux VM under Azure, Make-based backup/restore, Traefik at the edge. Older Confluence proposed Kubernetes or Swarm. Local development historically used Vagrant; that path is being replaced for contributors (see ADR-0005).

App topology (modular monolith vs many services) is ADR-0004.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Stay Azure VM + Compose | Matches current ops | Scaling and HA stay manual |
| Azure App Service / AKS first | Managed platform | Couples rewrite to Azure |
| Container images + portable IaC | Move clouds without rewriting apps | Must pick orchestrator and IaC tool |
| Serverless-first | Elastic | Awkward for membership/session workloads |

## Tentative lean

- **Container-native and cloud-agnostic**: OCI images plus declarative deploy.
- **Compose for local/dev** (ADR-0005). Prod Compose vs Kubernetes decided after sizing.
- Replace Traefik v1 with a maintained ingress over time.
- Prefer fewer Postgres instances than one-per-microservice unless isolation requires otherwise (ADR-0009).
- IaC lives under `infra/iac` when introduced (ADR-0006).

## Benefits (if adopted)

- Local and prod share container contracts.
- Cloud moves become config/IaC work, not an app rewrite.
- Clear home for ops scripts and future Terraform/OpenTofu.

## Consequences

- Team still picks prod orchestrator and secrets approach.
- Traefik upgrade is a separate migration from Docker-only local setup.

## Related sources

- [The migration checklist](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2425258007/The+migration+checklist)
- [Production Environment Architecture Proposal](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/195526657/Production+Environment+Architecture+Proposal)
- ADR-0005, ADR-0006, ADR-0009

## Open questions

- Prod orchestrator: Compose vs k3s/k8s vs managed containers
- IaC tool and secrets
- Media: disk volumes vs object storage
