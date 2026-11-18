# ADR-0006: Repository layout (`apps` / `libs` / `infra`)

- Status: **Proposed**
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

Today product services, Docker stacks, Traefik, monitors, and ops scripts sit at the repo root next to each other. That obscures what is an application versus platform plumbing, and makes Nx project boundaries harder to explain.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep flat root folders | No move churn | Unclear ownership; noisy PRs |
| `packages/` only for JS | Familiar to some monorepos | Mixes apps and libs; no home for Compose/IaC |
| **`apps/` + `libs/` + `infra/`** | Clear product vs shared vs platform | One-time path updates in CI/Docker |

## Decision

```text
apps/     # deployable products: Node APIs, frontend, e2e, mailer, dispatcher
libs/     # shared TypeScript libraries (@myaegee/*)
infra/    # compose, gateways/traefik, monitor stacks, ops scripts, future iac/
```

Non-Node products (Elixir mailer, Python dispatcher) stay under `apps/` with custom Nx targets. Third-party image stacks and edge proxies live under `infra/`.

## Benefits

- Reviewers know where to look.
- Nx tags/boundaries can forbid apps importing other apps’ internals.
- IaC and Compose have a stable home without polluting application packages.
- Matches how most Nx monorepos scale.

## Consequences

- CircleCI working directories, Docker build contexts, and semantic-release paths change once.
- Import paths and docs need a coordinated move PR.

## Related sources

- ADR-0001 (Nx), ADR-0005 (Docker-only), ADR-0008 (db ownership in apps)

## Open questions

- Exact naming for infra compose project (`infra-compose` vs `platform`)
- Whether `e2e` stays under `apps/` or `tests/`
