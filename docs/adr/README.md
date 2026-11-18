# Architecture Decision Records

Proposed direction for the MyAEGEE platform rewrite and monorepo hardening. These are for team review. They are not binding until marked **Accepted**.

## Status legend

| Status | Meaning |
| --- | --- |
| **Working draft** | Early proposal; open to change |
| **Proposed** | Written up for review; not binding yet |
| **Accepted** | Adopted for the rewrite direction |
| **Rejected** | Considered and declined (keep for history) |
| **Superseded** | Replaced by a newer ADR (link it) |

## Index

| ID | Title | Status |
| --- | --- | --- |
| [0001](0001-monorepo-tooling.md) | Monorepo tooling (Nx) | Proposed |
| [0002](0002-typescript-and-backend-framework.md) | TypeScript (+ NestJS still open) | Proposed |
| [0003](0003-deployment-architecture.md) | Deployment and runtime architecture | Working draft |
| [0004](0004-application-topology.md) | Application topology | Working draft |
| [0005](0005-docker-only-local-dev.md) | Docker-only local development | Proposed |
| [0006](0006-apps-libs-infra-layout.md) | `apps` / `libs` / `infra` layout | Proposed |
| [0007](0007-biome-lint-format.md) | Biome for lint and format | Proposed |
| [0008](0008-typeorm-and-db-ownership.md) | TypeORM and DB ownership | Proposed |
| [0009](0009-postgresql-standard.md) | PostgreSQL as sole RDBMS | Proposed |

## Template

```markdown
# ADR-NNNN: Title

- Status: Working draft | Proposed | Accepted | Rejected | Superseded
- Date: YYYY-MM-DD
- Deciders: …

## Context
## Options
## Decision
## Benefits
## Consequences
## Related sources
## Open questions
```
