# ADR-0007: Lint and format tool

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Each Node service carries its own ESLint setup (and often Prettier). Configs drift. CI repeats the same job shape. Volunteers arrive with different editor defaults and argue about formatting in review instead of behavior.

I want **one** lint/format tool for JS/TS in the monorepo so “make it green” is the same command everywhere.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep per-app ESLint + Prettier | Familiar | Drift; slow; many configs |
| Shared ESLint config package + Prettier | One policy | Still two tools and plugin trees |
| dprint + ESLint | Fast format | Still ESLint complexity |
| **Biome** (lint + format) | Fast; one config; fewer deps | Rule set differs from classic ESLint |
| Oxlint + separate formatter | Very fast lint | Younger ecosystem; still split format |
| “No standard; editor whatever” | Max freedom | Inconsistent PRs; painful for reviewers |

## What I propose

Use **Biome** as the default linter and formatter for JavaScript/TypeScript. Root `biome.json` plus Nx `lint` targets. Remove per-app ESLint/Prettier as we touch apps.

## Benefits I see

- One mental model for format and lint.
- Faster local/CI feedback for people with limited volunteer time.
- Less dependency surface than eslint plugin stacks that bit-rot.
- Fewer bikeshedding comments in PR review.

## Consequences / tradeoffs

- Some ESLint-only rules need Biome equivalents or explicit exceptions.
- Vue SFC linting may need a short dual period.
- Contributors run Biome via Nx/root scripts, not `eslint .` per service.

## Related sources

- [Biome documentation](https://biomejs.dev)
- ADR-0001

## Open questions for the team

- How strict on day one vs enable rules gradually?
- Frontend/Vue special-case timeline?
