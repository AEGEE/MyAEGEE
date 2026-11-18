# ADR-0004: Application topology (modules vs microservices)

- Status: **Working draft**
- Date: 2026-11-08 (carried forward)
- Deciders: Rewrite initiative (not confirmed)

## Context

The OG system is a microservice mesh of Express apps behind Traefik. MyAEGEE v2 kept microservices in concept but forced a monorepo because cross-cutting changes were too expensive.

The rewrite team is mostly volunteers with mixed coding experience. Topology must stay teachable: few moving parts locally, clear places for shared code (mail, db helpers, auth), and docs that guide people step by step.

The first monorepo train keeps the existing deployable services as Nx `apps`, extracts shared `libs`, and parks platform code in `infra` (ADR-0006). A later modular-monolith cut is still on the table.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep many microservices | Familiar to OG contributors | Ops cost; many near-identical HTTP apps |
| Modular monolith + shared libs | Simpler local/prod; Nest modules fit | Needs boundary discipline |
| Micro-frontends + BFF per domain | Team autonomy | Heavy for volunteer capacity |

## Tentative lean

1. Near term: **many apps in one Nx monorepo** with shared libraries (this train).
2. Medium term: evaluate **one primary NestJS API** with domain modules, extracting workers for mail/async.
3. Split deployables only with a measured reason (isolation, scaling, failure domains).

## Benefits

- Near-term path does not block shipping Nx/TypeORM/Postgres improvements.
- Shared libs stop the worst copy-paste immediately.
- Leaves room to collapse HTTP services later without another polyrepo split.

## Consequences

- Contributors still run multiple Node processes or Compose services for a while.
- Strangler plan needed if/when modular monolith is accepted.

## Related sources

- [MyAEGEE v2](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/2243854357/MyAEGEE+v2)
- [Microservice overview](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/21566157/Microservice+overview)
- ADR-0001, ADR-0002, ADR-0006

## Open questions

- Strangler sequence: which OG service moves first into a modular API?
- Shared DB vs schema-per-module during transition
