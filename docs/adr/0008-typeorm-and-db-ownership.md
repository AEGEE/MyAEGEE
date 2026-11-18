# ADR-0008: TypeORM and database ownership

- Status: **Proposed**
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

Seven Node APIs share near-identical Sequelize bootstrap (`lib/sequelize.js`, `config/database.js`, `.sequelizerc`) and diverge on models. Sequelize majors in use are dated. Copy-pasting models into a “shared entities” package would create a fake shared domain and tight coupling.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep Sequelize; extract shared bootstrap | Small diff | Still on a stack we want to leave |
| Prisma | Strong DX | Different migration model; large rewrite |
| Drizzle | Lightweight SQL-first | Less familiar; smaller ecosystem here |
| **TypeORM** | TS entities, active ecosystem, fits Nest later | Decorator style; migration rewrite effort |

## Decision

1. Replace Sequelize with **TypeORM** + `pg` for first-party Node apps.
2. Shared library `@myaegee/db` holds **only** connection/DataSource helpers and migration CLI plumbing.
3. **Entities, view mappings, repositories, and migrations live in the owning app.**
4. Cross-service data access goes through **HTTP / `@myaegee/core-client`**, not by importing another app’s entities.

## Benefits

- Clear ownership: the app that writes the table owns the model.
- Shared helpers stop bootstrap drift without a junk-drawer entity package.
- TypeScript entities improve refactor safety.
- Leaves a clean path if Nest modules appear later (ADR-0002/0004).

## Consequences

- Migrations are rewritten per app (no blind Sequelize→TypeORM translate).
- Pilot apps first (e.g. knowledge, then discounts), then roll.
- Contributors must not add `libs/entities` grab-bags.

## Related sources

- Per-service `lib/sequelize.js` and `models/`
- ADR-0002 (TypeScript), ADR-0009 (PostgreSQL)

## Open questions

- Soft-delete / naming conventions shared via `@myaegee/db` defaults?
- Migration generator UX under Nx
