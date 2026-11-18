# ADR-0006: Repository layout (`apps` / `libs` / `infra`)

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Product services, Traefik, monitors, and ops scripts currently sit at the repo root as peers. For a volunteer opening the repo for the first time, it is unclear what is “the app I change” versus “platform plumbing I should not casually edit.”

I propose a layout that matches how we talk about the work: products, shared code, platform.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep flat root folders | No move churn | Noisy PRs; unclear ownership |
| `packages/` for everything JS | Familiar in some monorepos | Mixes apps and libs; no home for Compose/IaC |
| `services/` + `packages/` only | Clearer for APIs | Still awkward for Traefik/monitor/IaC |
| **`apps/` + `libs/` + `infra/`** | Clear product vs shared vs platform | One-time path updates in CI/Docker |
| Separate infra git repo | Hard boundary | Worse for volunteers (two clones, two PRs) |

## What I propose

```text
apps/     # deployable products: Node APIs, frontend, e2e, mailer, dispatcher
libs/     # TypeScript libraries (@myaegee/*)
  shared/       # purpose folders: errors/, pagination/, http/, ...
  http-client/  # small HTTP helper
  db/           # TypeORM DataSource helpers only
  mailing/      # mailer HTTP client
  core-client/  # core API client
  observability/
infra/    # compose, gateways/traefik, monitor stacks, ops scripts, future iac/
```

I propose `@myaegee/shared` holds cross-cutting primitives in **purpose folders**, with one concern per file and suffix naming (`*.type.ts`, `*.enum.ts`, `*.error.ts`). `index.ts` files only re-export. No standalone `errors` package. Capability libraries stay separate when they have a clear boundary (HTTP, DB plumbing, mailer, core client).

Lint/format for JS/TS is **Biome** only (ADR-0007). I propose we do not keep per-app ESLint/Prettier configs.

Non-Node products stay under `apps/` with custom Nx targets. Third-party image stacks and edge proxies live under `infra/`. Build output lives only under each package’s `dist/` and is gitignored.

## Benefits I see

- Faster orientation for new contributors.
- Nx tags can forbid apps importing other apps’ internals.
- IaC and Compose have a stable home without polluting feature packages.
- Reviews can stay focused (“this PR is libs only”).

## Consequences / tradeoffs

- CircleCI paths, Docker contexts, and release config need a coordinated update.
- Short-term churn in import/docs paths.

## Related sources

- ADR-0001, ADR-0005, ADR-0008

## Open questions for the team

- Exact Nx project name for compose (`infra-compose` vs `platform`)?
- Should `e2e` live under `apps/` or a top-level `tests/`?
