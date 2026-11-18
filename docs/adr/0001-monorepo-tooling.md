# ADR-0001: Monorepo tooling

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

MyAEGEE is already an npm-workspaces monorepo for the Node packages, with other folders (dispatcher, gateways, monitor, and similar) sitting beside them. Cross-cutting changes still hurt because each service has its own scripts, CI shape, and copy-pasted helpers.

We are mostly **volunteers**. If the monorepo needs five different CLIs just to lint and test, people bounce. I propose one primary way to run tasks, see what a change affects, and share libraries without reinventing scripts in every app.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep npm workspaces + per-app scripts only | Zero new tooling | No affected graph; CI stays copy-paste heavy |
| npm workspaces + Make/shell wrappers | Familiar to some ops folks | Weak on Windows; another dialect to learn |
| pnpm + Turborepo | Strict installs, simple task cache | Lockfile migration; fewer generators/boundaries |
| **Nx + npm (for now)** | Affected builds, graph, generators, cache, tags | Learning curve; more config than Turborepo |
| Yarn Berry (PnP) | Modern Yarn features | PnP friction with native addons and Docker |
| Bazel / Pants | Hermetic builds | Far too heavy for volunteer capacity |
| Split back to polyrepo | Independent release cadence | We already felt the pain of that model |

## What I propose

I propose we adopt **Nx** on top of our existing **npm workspaces** lockfile for this phase. Keep npm so we do not ask everyone to change package managers on day one. Revisit pnpm later if install speed or dependency isolation becomes a real problem. For now I am not proposing Turborepo as the primary task runner.

## Benefits I see

- `nx affected` means volunteers wait on CI for *their* change, not the whole mesh.
- The project graph makes shared libs visible instead of tribal knowledge.
- One set of task names (`lint`, `test`, `build`, `serve`) across apps.
- Tags/boundaries help us keep `apps` / `libs` / `infra` honest.

## Consequences / tradeoffs

- People learn `nx` next to `npm`.
- CircleCI should eventually call Nx instead of duplicating per-service shell.
- Elixir mailer and Python dispatcher stay in-repo as Nx projects with custom targets, not as TypeScript apps.
- This supersedes my earlier personal lean toward Turborepo.

## Related sources

- [MyAEGEE v2](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2243854357/MyAEGEE+v2)
- Root `package.json` workspaces
- [Nx documentation](https://nx.dev)

## Open questions for the team

- Nx Cloud remote cache now, or CircleCI cache only until we feel pain?
- Keep semantic-release per package, or move toward one product version later?
