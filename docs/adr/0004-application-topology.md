# ADR-0004: Application topology (modules vs microservices)

- Status: **Working draft**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

OG MyAEGEE is a microservice mesh behind Traefik. That helped ownership historically, but cross-cutting changes and many near-identical Express apps are hard on a **volunteer** team: many databases, images, healthchecks, and “which repo/folder do I touch?” questions.

I am not asking us to collapse everything into one process on day one. I am asking that the monorepo and shared libs make the *current* mesh maintainable, while we keep a modular-monolith option open.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep many microservices forever, no shared libs | Familiar | Ops and copy-paste stay expensive |
| **Many apps in one Nx monorepo + shared libs (near term)** | Incremental; fits volunteer time | Still multiple processes to run |
| Modular monolith (e.g. Nest modules) soon | Simpler local/prod | Bigger conceptual jump; strangler plan needed |
| Micro-frontends + BFF per domain | Team autonomy | Too heavy for our capacity |
| Event-sourced distributed redesign | Strong audit story | Far beyond current needs |

## What I propose

1. **Near term:** keep deployable services as Nx `apps`, extract shared `libs`, park platform code in `infra` (ADR-0006).
2. **Medium term:** evaluate one primary Nest/TS API with domain modules; extract workers for mail/async.
3. Split deployables further only with a measured reason (isolation, scaling, failure domains).

## Benefits I see

- We can ship Nx/TypeORM/Postgres improvements without freezing feature work for a topology rewrite.
- Shared libs stop the worst copy-paste immediately.
- Volunteers learn one repo layout instead of many special cases.

## Consequences / tradeoffs

- People still run multiple services for a while.
- If we later accept a modular monolith, we need an explicit strangler sequence.

## Related sources

- [MyAEGEE v2](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2243854357/MyAEGEE+v2)
- ADR-0001, ADR-0002, ADR-0006

## Open questions for the team

- Which OG service would move first into a modular API, if we go that way?
- Shared DB vs schema-per-module during any collapse?
