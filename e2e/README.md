# MyAEGEE end-to-end tests

Two Playwright suites live here:

- the **mocked-API suite** (`ui/`, `playwright.ui.config.ts`): the built frontend in a browser,
  with every API call answered by the test. It is where the frontend's behaviour is tested.
- the **real-stack suite** (`tests/`, `playwright.config.ts`): the built frontend against real
  `core`, `events`, `summeruniversity`, `statutory`, `network` and `discounts` services.

What each is for, how to write specs for the mocked suite, coverage, the accessibility baseline
and how to run everything (also next to other checkouts) are in
[docs/testing/](../docs/testing/README.md). The rest of this file is about the real-stack suite.

## Scope

e2e tests are slow and need the whole stack, so keep them for what the module tests can't cover:

- behaviour that crosses services, such as what core grants and what events,
  summeruniversity or statutory then allow (the per-service jest tests mock core away);
- the frontend working against the real APIs (how a page behaves in detail is for the
  mocked-API suite);
- the contract checks of the mocked suite's factories (`tests/<area>-contract.spec.ts`): every
  field a factory builds must exist in the real answer, with the same type. A field can only be
  compared when both sides have a value, so a test fills them (`fillAntenna`, overrides of the
  factory); a field that was null or an empty list in every comparison of a test fails it,
  unless the test lists it in `gaps` with the reason nobody can fill it;
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

- One Postgres, with a database per service (`core-e2e`, `events-e2e`, `summeruniversity-e2e`,
  `statutory-e2e`, `network-e2e`, `discounts-e2e`).
- `core`, `events`, `summeruniversity`, `statutory`, `network` and `discounts` run as plain Node
  processes with `NODE_ENV=e2e` (see the `e2e` block in each service's `config/index.js`).
- `support/fake-mailer.ts` replaces the mailer and records every mail, so tests can check recipients.
- `support/gateway.ts` serves the frontend build and proxies `/api/<service>/` to the services.
- Playwright starts all of these itself (`webServer` in `playwright.config.ts`).

| Process | Port |
|---|---|
| gateway (frontend + `/api`) | 18080 |
| core | 18084 |
| events | 18085 |
| summeruniversity | 18086 |
| statutory | 18087 |
| network | 18088 |
| discounts | 18089 |
| fake mailer | 18090 |
| fake currency conversion rates (for statutory) | 18091 |

`E2E_SLOT=n` (0 to 9) moves all ports by `n * 1000` and gives the databases and media folders a
suffix, so several checkouts can run at once: see [docs/testing/running.md](../docs/testing/running.md).
A port that is already taken stops the run instead of reusing whatever listens there;
`E2E_REUSE=1` reuses running servers on purpose.

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

Shared helpers, so a test file rarely needs its own setup code:

| Helper | Where | What |
|---|---|---|
| `USERS` | `support/constants.ts` | The seeded users the tests log in as |
| `asAdmin`, `createAntenna`, `createCircle`, `createCampaign`, `grantPermission` | `support/core-data.ts` | Core data made through the API as admin, each with a cleanup. `grantPermission(api, username, 'global:create:summeruniversity')` gives a user a permission through a new circle |
| `fillAntenna`, `uploadPicture` | `support/core-data.ts` | Give the antenna of `createAntenna` and its member a value for every optional field (details, a picture, a primary body, a join request, an application ban), and upload a picture to a service, so a contract check has something to compare |
| `api.waitForMail({ to, template })`, `mailLink(mail)` | `support/api.ts` | The mail the fake mailer received, and the frontend path its link leads to. Filter by your own address; never clear the mails of other tests |
| `expectShape(name, factoryObject, realAnswer, { gaps, ignore })` | `support/contract.ts` | The contract check of a factory. `gaps` and `ignore` map a path (`$.email`) to the reason it stays uncompared |

Helpers for one area go in `support/<area>-data.ts`, so `api.ts` and `constants.ts` stay as they are.

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
npm run test:mocked                # the mocked-API suite (needs no database)
```

`DB_HOST`, `DB_PORT`, `DB_USERNAME` and `PG_PASSWORD` point the services at another Postgres.
Run `npm run setup:no-frontend` to skip the frontend build when only the backend changed.
Tests create their own events with unique names, so you can rerun them without running setup again.

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

The `e2e-test` CircleCI job (workflow `frontend-tests`) runs the same steps in `cimg/node` with a
`cimg/postgres` sidecar, then stores the JUnit results, the HTML report and traces of failing
tests as artifacts. The other jobs of the workflow are described in
[docs/testing/running.md](../docs/testing/running.md#ci).
