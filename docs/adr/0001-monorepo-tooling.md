# ADR-0001: Monorepo tooling

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

MyAEGEE is already a workspaces-style monorepo for the Node packages, with other folders (dispatcher, gateways, monitor, and similar) sitting beside them. Cross-cutting changes still hurt because each service has its own scripts, CI shape, and copy-pasted helpers.

We are mostly **volunteers**. If the monorepo needs five different CLIs just to lint and test, people bounce. I propose one primary way to run tasks, see what a change affects, and share libraries without reinventing scripts in every app.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep npm workspaces + per-app scripts only | Zero new tooling | No affected graph; CI stays copy-paste heavy; slower installs |
| npm workspaces + Make/shell wrappers | Familiar to some ops folks | Weak on Windows; another dialect to learn |
| npm workspaces + Nx | Affected graph without changing package manager | Slower installs than pnpm; looser dependency isolation |
| pnpm + Turborepo | Strict installs, simple task cache | Fewer generators/boundaries than Nx |
| **Nx + pnpm** | Fast installs, strict deps, affected builds, graph, generators, cache, tags | Learning curve; one-time lockfile migration |
| Yarn Berry (PnP) | Modern Yarn features | PnP friction with native addons and Docker |
| Bazel / Pants | Hermetic builds | Far too heavy for volunteer capacity |
| Split back to polyrepo | Independent release cadence | We already felt the pain of that model |

## What I propose

I propose we adopt **Nx** with **pnpm** workspaces as the shared monorepo toolset. pnpm keeps installs faster and dependencies more honest for volunteers on limited time and bandwidth. Nx remains the task runner and affected-build layer. I am not proposing Turborepo as the primary task runner.

## Benefits I see

- Faster `pnpm install` than npm for a large workspace.
- Stricter dependency isolation catches “works because it leaked from another package” bugs earlier.
- `nx affected` means volunteers wait on CI for *their* change, not the whole mesh.
- The project graph makes shared libs visible instead of tribal knowledge.
- One set of task names (`lint`, `test`, `build`, `serve`) across apps.
- Tags/boundaries help us keep `apps` / `libs` / `infra` honest.

## Consequences / tradeoffs

- People learn `pnpm` and `nx` instead of ad-hoc per-app npm scripts.
- Contributors enable Corepack or install pnpm once (`packageManager` in root `package.json` pins the version).
- CircleCI should call pnpm at the repo root and Nx for affected work.
- Per-app Docker image builds may still use a local install path until those Dockerfiles are switched over.
- Elixir mailer and Python dispatcher stay in-repo as Nx projects with custom targets, not as TypeScript apps.
- This supersedes my earlier personal lean toward Turborepo, and the interim “Nx + npm for now” idea.

## Related sources

- [MyAEGEE v2](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2243854357/MyAEGEE+v2)
- Root `pnpm-workspace.yaml`
- [Nx documentation](https://nx.dev)
- [pnpm workspaces](https://pnpm.io/workspaces)

## Open questions for the team

- Nx Cloud remote cache now, or CircleCI cache only until we feel pain?
- Keep semantic-release per package, or move toward one product version later?
- How quickly do we convert service Dockerfiles from `npm ci` to pnpm?
