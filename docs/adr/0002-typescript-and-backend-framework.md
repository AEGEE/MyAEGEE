# ADR-0002: TypeScript and backend framework

- Status: **Proposed** (TypeScript); NestJS still open
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

Most backends are untyped JavaScript Express plus Sequelize, with the same patterns copied per service. Mailer is Elixir/Phoenix; dispatcher is Python. Frontend is Vue 2 (out of scope for this ADR).

We want safer shared libraries and a path to one primary backend language for new code.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| TypeScript for new/shared code; keep Express apps during transition | Incremental; fits Nx libs | Two styles coexist for a while |
| NestJS + Fastify | Structure, DI, OpenAPI | Learning curve; larger rewrite |
| NestJS + Express | Middleware familiarity | Heavier than plain Express |
| Express + TypeScript only | Closest to today | Easy to reintroduce copy-paste |
| Elixir everywhere | Strong for mailer | Contributor pool / hiring |

## Decision

1. **TypeScript** is the language for **new shared libraries** and for new backend code as apps are touched.
2. Existing Express services may stay JavaScript temporarily; migrate on contact (especially when adopting TypeORM).
3. **NestJS** remains a candidate for a later modular API shape (see ADR-0004). It is **not** required for the first monorepo train.
4. ORM choice is **ADR-0008** (TypeORM), not Sequelize.

## Benefits

- Typed shared clients (HTTP, mail, errors) catch integration mistakes early.
- Contributors get one language for libs without forcing a Nest rewrite on day one.
- Clear separation: language decision now, framework topology later.

## Consequences

- Build/tooling must support mixed JS/TS apps until migration finishes.
- Nest adoption would be a follow-up ADR update or a new ADR, not sneaked into Nx scaffold PRs.
- Vue 2 frontend stays JS/Vue CLI for the current train.

## Related sources

- [How to start a microservice](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/637632524/How+to+start+a+microservice)
- [Standardized API](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/21635707/Standardized+API)
- ADR-0008 (TypeORM), ADR-0001 (Nx)

## Open questions

- Validation library (Zod vs class-validator) when Nest lands
- Bugsnag vs OpenTelemetry-first error pipeline
- One Nest process vs many deployables (ADR-0004)
