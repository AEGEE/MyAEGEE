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
  http-client/  # HttpClient class
  db/           # TypeORM DataSource helpers only
  mailing/      # MailerClient class
  core-client/  # CoreClient class
infra/
  compose/      # base.yml and stacks/ (optional compose-only stacks, one file each)
  gateways/     # Traefik config
  monitor/      # monitoring config
  scripts/      # ops scripts
  iac/          # future
```

Nothing else sits at the repo root except config files and `docs/`. Stacks that are only a compose file (pass-manager, survey, url-shortener, monitor-agents, dev-tools) are single files under `infra/compose/stacks/`, not folders of their own.

I propose `@myaegee/shared` holds cross-cutting primitives in **purpose folders**, with one concern per file and suffix naming (`*.type.ts`, `*.enum.ts`, `*.error.ts`). `index.ts` files only re-export and never contain code. No standalone `errors` package. Capability libs stay separate when they have a clear boundary (HTTP, DB plumbing, mailer, core client).

Clients that hold configuration (HTTP, mailer, core) are classes, so they can grow state, hooks, and retries later without changing every call site. The Node apps use them instead of their own copies. Small stateless helpers stay as plain functions, one per file.

All Node services build their image from one Dockerfile at `infra/docker/node-service/Dockerfile`, with the repo root as the build context. It builds the libs the app depends on and uses `pnpm deploy` to ship only that app and its production dependencies.

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
