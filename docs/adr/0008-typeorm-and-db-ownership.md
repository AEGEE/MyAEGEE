# ADR-0008: ORM and database ownership

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Seven Node APIs share near-identical Sequelize bootstrap files and diverge on models. The majors we pin are dated. If we extract a “shared entities” package, we create a fake shared domain and couple services that should talk over APIs.

Volunteers should know: **the app that owns the table owns the model.** Shared code should be connection/migration plumbing, not everyone else’s schema.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep Sequelize; extract shared bootstrap only | Smallest diff | Stays on a stack we want to leave |
| Sequelize upgrade in place | Less rewrite | Still Sequelize; still copy-paste models |
| Prisma | Strong DX, migrations | Different model; large rewrite |
| Drizzle | Lightweight SQL-first | Less familiar here |
| Knex / raw SQL only | Full control | More boilerplate; easy inconsistency |
| **TypeORM** | TS entities; active ecosystem; Nest-friendly later | Decorator style; migration rewrite |
| Shared `libs/entities` for all services | Appears DRY | Ownership nightmare; tight coupling |

## What I propose

1. Replace Sequelize with **TypeORM** + `pg` for first-party Node apps.
2. Shared `@myaegee/db` holds **only** DataSource/connection helpers and migration CLI plumbing.
3. **Entities, views, repositories, and migrations live in the owning app.**
4. Cross-service data goes through **HTTP / a core client**, not by importing another app’s entities.

## Benefits I see

- Clear ownership for volunteers (“change pages in knowledge, not in a global bag”).
- Shared helpers stop bootstrap drift without a junk-drawer domain lib.
- TypeScript entities improve refactor safety.
- Leaves a clean path if we later adopt Nest modules (ADR-0002/0004).

## Consequences / tradeoffs

- Migrations are rewritten per app (no blind auto-translate).
- Pilot apps first, then roll (I suggest knowledge, then discounts).
- We must actively reject `libs/entities` grab-bags in review.

## Related sources

- Per-service `lib/sequelize.js` and `models/`
- ADR-0002, ADR-0009

## Open questions for the team

- Which naming/soft-delete defaults belong in `@myaegee/db`?
- Migration generator UX under Nx?
