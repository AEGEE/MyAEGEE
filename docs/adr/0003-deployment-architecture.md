# ADR-0003: Deployment and runtime architecture

- Status: **Working draft**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Two topics get mixed together:

1. App / runtime shape: processes, gateways, data stores
2. Cloud / IaC: where it runs and how we provision it

OG production looks like Docker Compose on a Linux VM (Azure), with Traefik at the edge. Local setup used to push people through Vagrant. Volunteers should not need a second OS and a hypervisor just to try a CSS tweak or an API fix (see ADR-0005).

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Stay Azure VM + Compose as the mental model | Matches current ops | Scaling/HA stay manual |
| Jump to AKS / App Service first | Managed platform | Couples rewrite to Azure; steeper for volunteers |
| **Containers + portable contracts (Compose local; prod TBD)** | Same images everywhere | Still must pick prod orchestrator |
| Full Kubernetes from day one for local too | Prod parity | Painful laptop story for casual contributors |
| Serverless-first | Elastic | Awkward for membership/session workloads |

## What I propose (lean, not locked)

- Stay **container-native**. Local = Compose (ADR-0005). Prod orchestrator (Compose vs k8s vs managed) decided after we size reality.
- Keep cloud **replaceable**: I propose we avoid baking Azure PaaS APIs into app code.
- Put future IaC under `infra/iac` (ADR-0006).
- Plan a Traefik v1 upgrade path separately so local Docker is not blocked on it forever.

## Benefits I see

- Volunteers use the same container story locally that we ship as images.
- Moving host/cloud becomes infra work, not an app rewrite.
- Clear home for ops scripts without mixing them into feature PRs.

## Consequences / tradeoffs

- We still owe a clear prod choice and secrets story.
- Traefik upgrade is its own migration.

## Related sources

- [The migration checklist](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2425258007/The+migration+checklist)
- ADR-0005, ADR-0006, ADR-0009

## Open questions for the team

- Prod: Compose on VM vs k3s/k8s vs managed containers?
- Secrets approach going forward?
- Media: disk volumes vs object storage?
