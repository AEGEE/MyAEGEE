# Running the frontend suites

Both Playwright suites live in `e2e/`. The mocked-API suite needs only the built frontend; the
real-stack suite also needs a Postgres. See [README.md](README.md) for what each is for.

## Setup

Node 26 or newer (the scripts and tests are TypeScript that Node runs directly).

```sh
npm ci --legacy-peer-deps            # at the repository root
cd e2e
npx playwright install chromium
```

For the real stack, a Postgres with user `postgres` and password `5ecr3t`, for example:

```sh
docker run -d --rm --name myaegee-e2e-pg -e POSTGRES_PASSWORD=5ecr3t -p 127.0.0.1:55432:5432 postgres:18
export DB_PORT=55432
```

`DB_HOST`, `DB_PORT`, `DB_USERNAME` and `PG_PASSWORD` point the services at another one.

## Running

```sh
npm run setup:frontend       # builds the frontend into e2e/.frontend-dist (all the mocked suite needs)
npm run test:mocked          # the mocked-API suite, both projects

npm run setup                # databases, core's seed and the frontend build
npm test                     # the real-stack suite
npm run lint                 # eslint, tsc and the suite's own checks
```

Rebuild (`npm run setup:frontend`) after changing anything in `frontend/`: the suites test the
build, not the source. `npm run setup:no-frontend` only does the databases.

The build the suites test is instrumented for coverage and not minified
([coverage.md](coverage.md)). `E2E_FRONTEND_BUILD=production npm run setup:frontend` makes the
production build instead, to look for a problem that only minified code has.

Parts of the mocked suite:

```sh
npx playwright test -c playwright.ui.config.ts ui/events/apply.spec.ts      # one file
npx playwright test -c playwright.ui.config.ts ui/events --project=vue      # one area, desktop only
npx playwright test -c playwright.ui.config.ts --project=vue-mobile         # the phone project (npm run test:mobile)
npx playwright test -c playwright.ui.config.ts --grep @smoke                # every route loads
npx playwright test -c playwright.ui.config.ts --grep @a11y                 # the axe run
npx playwright test -c playwright.ui.config.ts --grep-invert "@smoke|@a11y" # the behavioural specs only
```

While writing specs for an area, run its folder with `--project=vue`, then once on both projects
before pushing. Leave the full run to CI.

## Debugging

- `npx playwright test -c playwright.ui.config.ts --ui` runs tests in Playwright's UI, with the
  page, the requests and the locator picker.
- A failed test keeps a trace: `npx playwright show-trace test-results-ui/<test>/trace.zip`.
  The HTML report (`npx playwright show-report playwright-report-ui`) links them.
- "requests nobody mocked" at the end of a test lists what the page asked for that the test
  didn't answer.
- A test that passes on `vue` and fails on `vue-mobile` usually used the menu, a table header
  or an exact row name: see "Passing on a phone" in [writing-ui-specs.md](writing-ui-specs.md).

## Several checkouts on one machine

`E2E_SLOT=n` (0 to 9, default 0) moves every port of both suites by `n * 1000` and gives the
databases and media folders of the real stack a suffix (`core-e2e-s2`, `/tmp/myaegee-e2e-s2`).
Give every checkout (or agent) its own slot:

```sh
export E2E_SLOT=2
npm run setup && npm test && npm run test:mocked
```

| Slot 0 port | What |
|---|---|
| 18080 | gateway of the real stack (frontend and `/api`) |
| 18084 to 18089 | core, events, summeruniversity, statutory, network, discounts |
| 18090 | fake mailer |
| 18180 | static server of the mocked suite |

One Postgres is enough for all slots. A port that is already in use stops the run with "already
used": that is the guard against two checkouts on one slot, where one would silently test the
other's services and build. `E2E_REUSE=1` reuses running servers on purpose (to keep a stack up
between runs of one checkout).

What a run needs, measured on a 16-core machine:

| Run | Time | Memory | Cores |
|---|---:|---:|---:|
| Frontend build (instrumented; the production build takes about 25 s and 2.5 GB) | about 11 s | about 1.2 GB | 2 to 3 |
| Mocked suite, 4 workers | about 2 min | about 2.5 GB | 4 to 5 |
| Real stack, 1 worker | about 30 s | about 1 GB | 1 to 2 |

For three checkouts at once: a slot each, `--workers=3` for the mocked suite, one frontend build
at a time, and the two suites one after the other within a checkout.

## CI

CircleCI runs the workflow `frontend-tests` on every push:

| Job | What |
|---|---|
| `frontend-mocked-test` | The mocked-API suite, both projects, split over its containers with `--shard`. Each container builds the frontend itself |
| `e2e-test` | `npm run lint` for `e2e/`, then the real-stack suite with a Postgres next to it, also split with `--shard` |
| `frontend-coverage` | Runs after both. Merges the coverage of all containers, uploads it to Codecov (component `frontend`), checks the coverage gate per area and that the axe baseline is up to date |

Artifacts: the HTML reports (`playwright-report-ui`, `playwright-report`), traces of failed
tests, the axe results per page (`a11y-results`), the coverage report (`coverage-report`) and its
summary (`coverage-summary.md`).

`parallelism` of the two test jobs is the number of containers. Raise it when a shard takes
longer than about 6 minutes; nothing else has to change. Codecov waits for a fixed number of
uploads (`after_n_builds` in `codecov.yml`): the six service test jobs with four containers each
and the one upload of `frontend-coverage`. The containers of the frontend jobs don't upload, so
their number doesn't matter there.

### If CI moves to GitHub Actions

What a GitHub Actions version of these jobs needs:

- A change filter that is true when `frontend/`, `e2e/` or one of core, events,
  summeruniversity, statutory, network or discounts changes (the services the real stack runs).
- A job for the mocked suite with a `shard` matrix, one for the real stack with a `shard` matrix
  and a Postgres service container, and a coverage job that `needs` both and downloads their
  artifacts merged into one folder.
- A cache for `~/.cache/ms-playwright`, keyed on the Playwright version.
- The Codecov upload with the flag `frontend`.
- `after_n_builds` can't stay a constant once jobs only run for the paths that changed and the
  services have different numbers of shards. Use Codecov flags with carry-forward per service
  instead, and drop `after_n_builds`.
