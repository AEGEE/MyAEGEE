# MyAEGEE end-to-end tests

Playwright tests that run against real `core`, `events` and `summeruniversity`
services and the built frontend.

## Scope

e2e tests are slow and need the whole stack, so keep them for what the module tests can't cover:

- behaviour that crosses services, such as what core grants and what events or
  summeruniversity then allow (the per-service jest tests mock core away);
- the frontend working against the real APIs;
- a few smoke tests of the stack itself.

Anything a single service decides on its own (its permission checks, validation, the mails it
sends) belongs in that service's tests, with the other services mocked.

Some tests here still check only one module, because that module has no tests for it yet. They
are tagged `@move-to-module`, with a `move-to-module` annotation naming the module and what the
module test needs (`moveToModule()` in `support/api.ts`). List them with:

```sh
npx playwright test --list --grep @move-to-module
```

When a module gets the test, delete the e2e one. Don't add new tests with this tag unless the module
can't be tested yet.

## How the stack runs

No Docker images or traefik are involved:

- One Postgres, with a database per service (`core-e2e`, `events-e2e`, `summeruniversity-e2e`).
- `core`, `events` and `summeruniversity` run as plain Node processes with `NODE_ENV=e2e`
  (see the `e2e` block in each service's `config/index.js`).
- `support/fake-mailer.ts` replaces the mailer and records every mail, so tests can check recipients.
- `support/gateway.ts` serves the frontend build and proxies `/api/<service>/` to the services.
- Playwright starts all of these itself (`webServer` in `playwright.config.ts`).

| Process | Port |
|---|---|
| gateway (frontend + `/api`) | 18080 |
| core | 18084 |
| events | 18085 |
| summeruniversity | 18086 |
| fake mailer | 18090 |

## Data

`npm run setup` recreates the databases, runs the core seed and builds the frontend. The core seed
models the production circles and their permissions (`core/scripts/seed-permissions.js`), and its users
all use the password `5ecr3t5ecr3t`.

Everything else a test needs, it creates itself:

- Events, applications and so on through the APIs, with unique names, so tests don't depend on each other.
- Core data through fixtures in `support/api.ts`, which call the core API as admin (`support/core-data.ts`)
  and delete what they created after the test, also when it failed. For example, a test that asks for
  `otherAntenna` gets a new antenna with one member who shares no body with the seeded users.

Tests never write to the databases directly: going through the APIs keeps the data consistent with the
services' validation and hooks.

## Running locally

You need Node 26 or newer (the version CI uses; it runs the TypeScript scripts directly) and a Postgres the services can reach (user `postgres`, password `5ecr3t`).
For example, a throwaway container:

```sh
docker run -d --rm --name myaegee-e2e-pg -e POSTGRES_PASSWORD=5ecr3t -p 127.0.0.1:55432:5432 postgres:18
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

## The frontend: mocked-API suite and the React app

Frontend behaviour (what a page shows and does) doesn't need the services, so it lives in a
second suite: `playwright.ui.config.ts`, specs in `ui/`. It serves the frontend builds and
answers every `/api` call inside the browser (`ui/support/api-mock.ts`, data from the typed
factories in `ui/support/factories.ts`). It's fast and runs in parallel.

```sh
npm run setup:frontend      # builds the Vue app (twice, see below) and the React app (frontend-react/)
npm run test:mocked         # all projects; add --project=vue or --project=react
npx playwright test -c playwright.ui.config.ts --grep @a11y && node scripts/a11y-summary.ts   # axe baseline
```

The same specs run against two frontends:

- project `vue`: the Vue app as production builds it today (`.frontend-dist`);
- project `react`: the React app for the paths in `frontend/src/migrated-routes.json`, and the
  Vue app for the rest (`.frontend-coexist-dist`, built with `VUE_APP_REACT_ROUTES=true` so its
  links to those paths load them from the server). Only specs tagged `@migrated` run here.

The real-stack suite can do the same: `E2E_FRONTEND=react npm test` makes `support/gateway.ts`
route the migrated paths to the React build. `tests/fixture-contract.spec.ts` checks the
mocked suite's factories against the real responses.

Specs in `ui/` find elements by role, label and text only, so they keep working when a page moves
from Vue to React. The rules and the reasoning are in
[`docs/react-migration/04-test-strategy.md`](../docs/react-migration/04-test-strategy.md).

## TypeScript

The workspace is written in TypeScript and isn't compiled: Playwright runs the tests and the config,
and Node runs the scripts and support servers with its built-in type stripping. That's why the code
only uses syntax that can be erased (no enums, namespaces or parameter properties) and imports
local files with their `.ts` extension. `npm run lint` runs eslint and `tsc --noEmit` for type checking.

Core's seed permissions are CommonJS without types; `support/core.ts` loads them.

## Known bugs

Tests that document a bug that isn't fixed yet call `knownBug('reason', /expected error/)`, which marks
them as expected to fail. Every error of the test has to match the regex: if the test fails for another
reason (for example because its setup broke), it is reported as a real failure, with a `known-bug-mismatch`
annotation in the HTML report. When the fix lands, Playwright reports the test as unexpectedly passing:
remove the `knownBug` line in the same PR. Run `E2E_SHOW_KNOWN_BUGS=1 npm test` to run them as normal
tests and see how they fail.

## CI

The `e2e-test` CircleCI job runs the same steps in `cimg/node` with a `cimg/postgres` sidecar,
once against the Vue app and once with `E2E_FRONTEND=react`, then stores the JUnit results, the
HTML report and traces of failing tests as artifacts. The `frontend-mocked-test` job runs the
mocked-API suite and records the axe baseline (report only, stored as an artifact).
