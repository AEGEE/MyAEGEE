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
npm run lint                 # eslint (with the suite's own rules), tsc, and the suite's own checks
npm run teardown             # drops the databases and the media folder of this E2E_SLOT
```

`npm run lint` also runs the tests of the lint rules (`lint/rules.test.js`) and of the tools
(`npm run test:tools`: the coverage loader, the gate, the contract comparison), and checks the
coverage gate's own files against `origin/stable` (`npm run coverage:gate-config`).

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
- "requests nobody mocked" lists what the page asked for that the test didn't answer. It is
  shown for every failed test too, next to the assertion that failed, and attached to the test
  in the report: look there first when an assertion timed out.
- "handlers that no request matched" lists the routes a test answers although the page never
  asked: a typo in the path, or a page that stopped asking. A test with such a handler takes
  five seconds longer to fail: it waits for a request the page may still send.
- A `GET http://127.0.0.1:…/apii/events` among the "requests nobody mocked" is a request with a
  wrong address: neither `/api/<service>/…`, a file of the build nor a page.
- CI sets `CI=true`, which changes the run: one retry, four workers, and ESLint reading files
  from disk in one go. Run a failing command the same way (`CI=true npm run lint`,
  `CI=true npx playwright test -c playwright.ui.config.ts`) before looking further.
- A run that is red although every test is green: the reporter's lines at the end name the test
  that was skipped, or passed only on its retry (`flaky`).
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
| 18091 | fake currency conversion rates, which statutory asks for when a members list is saved |
| 18180 | static server of the mocked suite |

One Postgres is enough for all slots. A checkout that is done with its slot runs
`E2E_SLOT=2 npm run teardown`, which drops the slot's six databases and its media folder. A port that is already in use stops the run with "already
used": that is the guard against two checkouts on one slot, where one would silently test the
other's services and build. `E2E_REUSE=1` reuses running servers on purpose (to keep a stack up
between runs of one checkout).

What a run needs, measured on a 16-core machine:

| Run | Time | Memory | Cores |
|---|---:|---:|---:|
| Frontend build (instrumented; the production build takes about 25 s and 2.5 GB) | about 11 s | about 1.2 GB | 2 to 3 |
| Mocked suite, 4 workers | about 2 min 15 s | about 2.5 GB | 4 to 5 |
| Real stack, 1 worker | about 25 s | about 1 GB | 1 to 2 |

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

The reporter of the mocked suite fails a run in which a test was skipped or passed only on its
retry, so a green `frontend-mocked-test` means every test passed at the first try.

Measured on the first run of this workflow (484 mocked tests, 57 real-stack tests):

| Job | Containers | Time | Of which |
|---|---:|---:|---|
| `frontend-mocked-test` | 2 | 4 min 21 s | browser download 25 to 57 s (cached afterwards), build 27 to 31 s, tests 2 min 0 s and 2 min 31 s per container |
| `e2e-test` | 1 | 2 min 34 s | lint 5 s, databases and build 43 s, tests 48 s |
| `frontend-coverage` | 1 | 37 s | merge and report 2 s, Codecov upload 3 s |

The CI browser has WebGL (`WebGL 1.0 (OpenGL ES 2.0 Chromium)`, in software), so pages with a
map can be tested there without launch flags; `e2e/ui/harness/api-mock.spec.ts` asserts it.

### Growing with the suite

The numbers are small because the suite is. When the areas are filled, the plan is 8 containers
for the mocked suite and 3 for the real stack. An area pull request changes exactly this, and
only when a container of the job takes longer than about six minutes:

| What | Where | Now | End state |
|---|---|---:|---:|
| `parallelism` of `frontend-mocked-test` | `.circleci/config.yml` | 4 | 8 |
| `parallelism` of `e2e-test` | `.circleci/config.yml` | 1 | 3 |

Nothing else follows from it. The tests are split with `--shard`, which reads the number of
containers from CircleCI; `frontend-coverage` merges however many containers there were (it
takes the build's own files from container 0 of the mocked job, and fails when the containers
tested different builds).

`after_n_builds` in `codecov.yml` does **not** change with these numbers. Codecov waits for a
fixed number of uploads before it reports: every container of the six service test jobs uploads
(six jobs with four containers each, 24). The frontend adds one upload, from
`frontend-coverage`, whatever the `parallelism` of the two frontend test jobs is, and Codecov
does not wait for that one: the job only runs when the frontend tests passed
([coverage.md](coverage.md#the-frontend-upload-is-not-one-codecov-waits-for)). The number only
changes when a service test job gets more or fewer containers.
`node packages/backend-test-utils/check-codecov-builds.js` (the `openapi` job) counts the
uploads in the CircleCI config and fails when `after_n_builds` disagrees.

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

#2262 is the pull request that moves the checks to GitHub Actions; it predates this workflow,
so these jobs still have to be added there.
