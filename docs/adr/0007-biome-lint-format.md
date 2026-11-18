# ADR-0007: Biome for lint and format

- Status: **Proposed**
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

Each Node service carries its own ESLint (and often Prettier) setup. Configs drift, CI repeats the same job shape, and several ESLint stacks in the wild are tied to old parser/plugin majors.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep per-app ESLint/Prettier | Familiar | Drift; slow; many configs |
| Shared ESLint config package | One policy | Still ESLint+Prettier dual stack |
| **Biome** at the monorepo root | Fast; format+lint together; one config | Ecosystem differs from ESLint rules people know |

## Decision

Use **Biome** as the default linter and formatter for JavaScript/TypeScript in the monorepo. Root `biome.json` plus Nx `lint` targets. Remove per-app ESLint/Prettier as apps are touched.

## Benefits

- One tool and one config for format and lint.
- Faster CI and local feedback.
- Less dependency surface than eslint plugin trees.
- Aligns with “current packages on contact” (ADR package currency).

## Consequences

- Some ESLint-only rules need Biome equivalents or custom CI checks.
- Vue SFC linting may need a short dual period until Biome/Vue support is satisfactory.
- Contributors install/run Biome via Nx, not `eslint .` per service.

## Related sources

- [Biome documentation](https://biomejs.dev)
- ADR-0001 (Nx task runner)

## Open questions

- Strictness level on day one vs gradual rule enablement
- Vue/frontend special-case timeline
