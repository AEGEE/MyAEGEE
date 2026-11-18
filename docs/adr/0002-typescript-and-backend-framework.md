# ADR-0002: TypeScript and backend framework

- Status: **Proposed** (TypeScript now; NestJS still open)
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Most backends are untyped JavaScript Express plus Sequelize, with the same patterns copied per service. Mailer is Elixir; dispatcher is Python; frontend is Vue 2.

Volunteers arrive with different language comfort levels. Untyped shared copy-paste makes that worse: a small helper change can break three services in ways CI only catches late. I want **TypeScript for shared and new code** so we can extract libraries safely, without forcing a Nest rewrite on everyone in the same breath.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Stay JS everywhere | No migration | Keeps the copy-paste tax; weak shared libs |
| **TypeScript for libs + new code; Express apps migrate on contact** | Incremental; fits volunteers' time | Mixed JS/TS for a while |
| TypeScript big-bang rewrite of all APIs | Clean end state | Unrealistic for volunteer bandwidth |
| NestJS + Fastify now | Structure, DI, OpenAPI | Steep for first contribution; large rewrite |
| NestJS + Express adapter | More middleware familiarity | Heavier than plain Express |
| Fastify + plugins only | Lightweight | We rebuild module/DI/OpenAPI glue ourselves |
| Elixir (Phoenix) for all backends | Strong runtime | Smaller contributor pool for this org |
| Go / .NET / Java | Strong platforms | Far from current skill base |

## What I propose

1. **TypeScript** is the language for **new shared libraries** and for backend code as we touch apps.
2. Existing Express services may stay JavaScript temporarily; migrate on contact (especially with the ORM move).
3. **NestJS** stays a candidate for a later modular API (see ADR-0004). I am **not** asking us to adopt Nest in the first monorepo train.
4. ORM choice lives in **ADR-0008** (TypeORM), not Sequelize forever.

## Benefits I see

- Typed shared clients (HTTP, mail, errors) catch integration mistakes earlier.
- Volunteers can contribute to one lib instead of patching six copies.
- We separate “language for safety” from “framework for topology,” so reviews stay smaller.

## Consequences / tradeoffs

- Tooling must support mixed JS/TS until migration finishes.
- Nest, if we want it, needs its own explicit decision later.
- Vue 2 frontend stays on its current stack for this train.

## Related sources

- [How to start a microservice](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/637632524/How+to+start+a+microservice)
- [Standardized API](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/21635707/Standardized+API)
- ADR-0008, ADR-0001

## Open questions for the team

- Validation library when/if Nest lands (Zod vs class-validator)?
- Bugsnag vs OpenTelemetry-first errors?
- Comfort level with gradual TS vs waiting for a Nest-shaped rewrite?
