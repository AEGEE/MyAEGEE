# ADR-0007: Lint and format tool

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Each Node service carries its own ESLint setup (and often Prettier). Configs drift. CI repeats the same job shape. Volunteers arrive with different editor defaults and argue about formatting in review instead of behavior.

I propose **one** lint/format tool for JS/TS in the monorepo so “make it green” is the same command everywhere.

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

I propose **Biome** as the default linter and formatter for JavaScript/TypeScript. Root `biome.json` plus Nx `lint` targets. Drop per-app ESLint/Prettier as we touch apps.

## Vertical whitespace

I propose a readability convention on top of Biome: put a blank line between declarations, checks (`if`, `switch`), loops, and calls that do different jobs, and before `return`. Short groups of the same kind (for example several `const` lines that belong together) can stay together.

Biome does not enforce this. It keeps blank lines you write but never adds them, and the maintainers have declined an equivalent of ESLint's `padding-line-between-statements`. So today this is a review convention. Ways to enforce it later:

| Option | Upside | Downside |
| --- | --- | --- |
| Review convention only | No extra tooling | Relies on people noticing |
| ESLint with only `@stylistic/padding-line-between-statements` | Automatic fix | Brings ESLint back for one rule |
| Wait for a Biome option | Stays one tool | No timeline |

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
- Is a review convention enough for blank lines, or is the ESLint stylistic rule worth the extra tool?
- Frontend/Vue special-case timeline?
