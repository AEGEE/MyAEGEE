# ADR-0009: PostgreSQL as the standard RDBMS

- Status: **Proposed**
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

First-party APIs already use PostgreSQL, but images are stuck on **10.x**. Two infra stacks still use **MariaDB/MySQL**: pass-manager (Bitwarden/Vaultwarden) and url-shortener (YOURLS). A second RDBMS adds backup/ops complexity and blocks Postgres-only extensions later.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep mixed Postgres + MariaDB | No infra migration | Two backup/ops stories; old Postgres majors |
| MySQL everywhere | Unifies on MariaDB stacks | Moves first-party off Postgres; weaker fit for our direction |
| **PostgreSQL only** (modern major) | One skillset; transactions; extensions | Migrate or replace MariaDB-backed apps |

## Decision

1. **PostgreSQL is the only RDBMS** for first-party apps and for infra we actively maintain.
2. Bump service images from `postgres:10.x` to a **current supported major** as stacks are touched (same major across apps).
3. Migrate **pass-manager** to Postgres (Vaultwarden supports it).
4. **url-shortener / YOURLS**: migrate if feasible; otherwise document a temporary exception or remove from the default stack.
5. No new MySQL/MariaDB services under `infra/`.

## Benefits

- Strong transactional behavior for membership and event workflows.
- Room for extensions later (PostGIS, `pgvector`, etc.) without a second database product.
- Simpler backups, monitoring, and contributor mental model.
- Aligns with TypeORM + `pg` (ADR-0008).

## Consequences

- Image bumps need smoke tests per service.
- YOURLS may force a product decision (keep exception vs replace).
- Existing local volumes on Postgres 10 may need recreate/migrate when majors jump.

## Related sources

- `*/docker/docker-compose.yml` Postgres services
- `pass-manager/docker/docker-compose.yml`, `url-shortener/docker/docker-compose.yml`
- ADR-0008 (TypeORM)

## Open questions

- Exact Postgres major to standardize on (e.g. 16 vs 17)
- YOURLS: exception timeline vs replacement
