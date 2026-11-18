# ADR-0009: Database standard (PostgreSQL)

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

First-party APIs already use PostgreSQL, but images were stuck on **10.x**. Two infra stacks still used **MariaDB/MySQL**: pass-manager and url-shortener. A second RDBMS means a second backup story, second set of failure modes, and fewer people who can help when something breaks at midnight.

For a volunteer org, **one relational database product** (with a current major) is simpler to teach and operate. Postgres also gives us room for extensions later without inventing a new data platform.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep mixed Postgres + MariaDB | No infra migration now | Two ops stories; old Postgres majors |
| Standardize on MySQL/MariaDB | Unifies Bitwarden/YOURLS | Moves first-party off Postgres; weaker fit for our direction |
| **PostgreSQL only, modern major** | One skillset; transactions; extensions | Migrate or replace MariaDB-backed apps |
| Managed DB (RDS/Cloud SQL) immediately | Less babysitting | Couples cloud choice early; cost/skills |
| “Polyglot persistence” (Postgres + Mongo + …) | Niche fits | Far too much for volunteer ops |

## What I propose

1. **PostgreSQL is the only RDBMS** for first-party apps and for infra we actively maintain.
2. Standardize service images on **Postgres 16** as stacks are touched (same major across apps).
3. Migrate **pass-manager** to Postgres (Vaultwarden supports it). Done in the monorepo train.
4. **url-shortener / YOURLS**: keep as a **temporary exception**, and keep it **out of the default Compose stack** until we replace it or find a Postgres-friendly shortener.
5. I propose we do not add new MySQL/MariaDB services under `infra/`.

## Benefits I see

- Stronger transactional story for membership and events.
- Room for extensions later (PostGIS, `pgvector`, etc.) without a second database product.
- Simpler backups, monitoring, and onboarding (“we use Postgres”).
- Aligns with TypeORM + `pg` (ADR-0008).

## Consequences / tradeoffs

- Image major bumps need smoke tests; local volumes may need recreate.
- YOURLS remains available under `infra/url-shortener` but is not a default contributor dependency.
- Short-term infra PR churn.

## Related sources

- Per-service Postgres compose services (`postgres:16`)
- `infra/pass-manager` (Postgres)
- `infra/url-shortener/README.md` (exception)
- ADR-0008

## Open questions for the team

- Stick with Postgres 16, or move to 17 next?
- YOURLS: replace with what, and on what timeline?
