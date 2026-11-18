# ADR-0001: Monorepo tooling

- Status: **Proposed**
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

MyAEGEE is already an npm-workspaces monorepo (`myaegee-monorepo`) for the Node packages, with other folders (dispatcher, gateways, monitor, and similar) outside that graph. Cross-cutting upgrades are painful when each service invents its own scripts, CI jobs, and copy-pasted `lib/` helpers.

We need install/task/cache tooling that supports many apps and shared libraries, plus affected-only CI.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep npm workspaces only | Least churn | Weak task graph; no affected builds |
| pnpm + Turborepo | Strict deps, simple cache | Lockfile migration; weaker generators/boundaries |
| **Nx** + npm (for now) | Affected graph, generators, boundaries, cache | Learning curve; more config |
| Yarn Berry (PnP) | Modern Yarn | Friction with native addons / Docker |
| Bazel | Hermetic | Too heavy for volunteer capacity |

## Decision

Adopt **Nx** on top of the existing **npm workspaces** lockfile for this phase. Revisit pnpm later if install performance or dependency isolation becomes a problem. Do not adopt Turborepo as the primary task runner.

## Benefits

- `nx affected` rebuilds/tests only what changed (faster CI, clearer ownership).
- Project graph makes shared libs and deps visible.
- Generators and tags help enforce `apps` / `libs` / `infra` boundaries.
- Local and CI can share the same task names (`lint`, `test`, `build`, `serve`).

## Consequences

- Contributors learn `nx` commands alongside `npm`.
- CircleCI jobs should call Nx rather than duplicating per-service shell.
- Elixir mailer and Python dispatcher stay in-repo as Nx projects with custom targets, not as TypeScript apps.
- ADR lean away from earlier Turborepo preference.

## Related sources

- [MyAEGEE v2](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2243854357/MyAEGEE+v2)
- Root `package.json` workspaces
- [Nx documentation](https://nx.dev)

## Open questions

- Introduce Nx Cloud remote cache now or stay on CircleCI cache only?
- Keep semantic-release per package, or one product version later?
