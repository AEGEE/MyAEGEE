# MyAEGEE end-to-end tests

Playwright tests that run against real `core`, `events` and `summeruniversity`
services and the built frontend. Use them to check behaviour that crosses
services, such as permissions that depend on core, which the per-service jest
tests mock away.

## How the stack runs

No Docker images or traefik are involved:

- One Postgres, with a database per service (`core-e2e`, `events-e2e`, `summeruniversity-e2e`).
- `core`, `events` and `summeruniversity` run as plain Node processes with `NODE_ENV=e2e`
  (see the `e2e` block in each service's `config/index.js`).
- `support/fake-mailer.js` replaces the mailer and records every mail, so tests can check recipients.
- `support/gateway.js` serves the frontend build and proxies `/api/<service>/` to the services.
- Playwright starts all of these itself (`webServer` in `playwright.config.js`).

| Process | Port |
|---|---|
| gateway (frontend + `/api`) | 18080 |
| core | 18084 |
| events | 18085 |
| summeruniversity | 18086 |
| fake mailer | 18090 |

## Data

`npm run setup` recreates the databases, runs the core seed and then `scripts/core-fixtures.js`, which:

- sets the permissions of the `Network Commission` and `General members circle` circles to
  exactly what production has (`PROD_CIRCLE_PERMISSIONS` in `support/constants.js`);
- adds a second antenna with a member `organizer-b` who shares no body with NetCom.

All seeded users use the password `5ecr3t5ecr3t`.

## Running locally

You need Node 22 and a Postgres the services can reach (user `postgres`, password `5ecr3t`).
For example, a throwaway container:

```sh
docker run -d --rm --name myaegee-e2e-pg -e POSTGRES_PASSWORD=5ecr3t -p 127.0.0.1:55432:5432 postgres:17
```

Then, from the repository root:

```sh
npm install
cd e2e
npx playwright install chromium
DB_PORT=55432 npm run setup        # databases, fixtures and frontend build
DB_PORT=55432 npm test             # or: npm run test:ui
```

`DB_HOST`, `DB_PORT`, `DB_USERNAME` and `PG_PASSWORD` point the services at another Postgres.
Run `npm run setup:no-frontend` to skip the frontend build when only the backend changed.
Tests create their own events with unique names, so you can rerun them without running setup again.

## Known bugs

Tests that document a bug that isn't fixed yet call `knownBug('...')`, which marks them as
expected to fail. When the fix lands, Playwright reports the test as unexpectedly passing:
remove the `knownBug` line in the same PR. Run `E2E_SHOW_KNOWN_BUGS=1 npm test` to run them
as normal tests and see how they fail.

## CI

The `e2e-test` CircleCI job runs the same steps in `cimg/node` with a `cimg/postgres` sidecar,
then stores the JUnit results, the HTML report and traces of failing tests as artifacts.
