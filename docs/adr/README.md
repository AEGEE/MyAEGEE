# Architecture Decision Records

These are **my proposals** for how we harden and evolve MyAEGEE. They are for team discussion. Nothing here is binding until we mark an ADR **Accepted**.

## Why this exists

Almost everyone contributing to MyAEGEE is a **volunteer**. People show up with different editors, Node versions, lint setups, and habits from university or day jobs. That mismatch is normal, and it is also expensive: every extra tool in the repo is another thing someone has to install, debug, or disagree about before they can ship a small fix.

I want a **small, shared toolset** so contributing stays as simple as possible: clone, install, run, change code, open a PR. These ADRs explain what I propose we standardize on, what I considered instead, and what benefits I see for volunteers.

## Status legend

| Status | Meaning |
| --- | --- |
| **Working draft** | Early idea; please challenge it |
| **Proposed** | Ready for review; not binding yet |
| **Accepted** | We agreed to follow this |
| **Rejected** | We looked at it and declined (keep for history) |
| **Superseded** | Replaced by a newer ADR |

## Index

| ID | Title | Status |
| --- | --- | --- |
| [0001](0001-monorepo-tooling.md) | Monorepo tooling | Proposed |
| [0002](0002-typescript-and-backend-framework.md) | TypeScript and backend framework | Proposed |
| [0003](0003-deployment-architecture.md) | Deployment and runtime | Working draft |
| [0004](0004-application-topology.md) | Application topology | Working draft |
| [0005](0005-docker-only-local-dev.md) | Docker-only local development | Proposed |
| [0006](0006-apps-libs-infra-layout.md) | `apps` / `libs` / `infra` layout | Proposed |
| [0007](0007-biome-lint-format.md) | Lint and format tool | Proposed |
| [0008](0008-typeorm-and-db-ownership.md) | ORM and DB ownership | Proposed |
| [0009](0009-postgresql-standard.md) | Database standard | Proposed |

## Template

```markdown
# ADR-NNNN: Title

- Status: …
- Date: YYYY-MM-DD
- Proposed by: …

## Context
## Options
## What I propose
## Benefits I see
## Consequences / tradeoffs
## Related sources
## Open questions for the team
```
