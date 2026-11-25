# Frontend coverage

The two Playwright suites measure which frontend code they run. The build they test is
instrumented for that, the numbers of all runs are merged, reported to Codecov (component
`frontend`) and checked per area against a gate.

## What is measured

A `.vue` file has two halves, and they are measured separately:

| What | From | In the report |
|---|---|---|
| Script | `<script>` blocks and `.js` files, mapped back to their source lines | The file itself: `frontend/src/views/events/Single.vue` |
| Template | The render function vue-loader compiles a `<template>` into. Every `v-if`, `v-else-if`, `v-else`, `v-show` and `? :` in a template is a branch there | A generated file per template: `render/views/events/Single.vue.template.js` |

The template half has no source map back to the template, so the report shows generated code. It
reads well enough to find the `v-if` it came from:

```js
_vm.can.edit_event ? _c('div', { staticClass: 'field is-grouped' }, [ ... ]) : _vm._e()
```

Code that Vue generates is left out, because nobody wrote it and no test can reach both sides
of it: for `v-model` (`if ($event.target.composing) return`, the `"_value" in o ? …` of a
select, the `Array.isArray(…) ? …` of a checkbox) and for event modifiers. A ternary you write
in a template is counted, also when it looks similar. `frontend/build/coverage-loader.test.js`
shows both.

Not measured, so check it with assertions where it matters: attribute bindings (`:disabled`,
`:class`), slot fallbacks and what happens inside Buefy.

## The gate

Per area (see [README.md](README.md#areas)), three numbers:

| Metric | Minimum |
|---|---:|
| Script lines | 90 % |
| Script branches | 85 % |
| Template branches (`v-if`, `v-show`, ternaries) | 85 % |

The minimums are in `e2e/ui/support/coverage/thresholds.json`.

`e2e/ui/support/coverage/<area>.json` says whether the gate holds for the area yet:

```json
{
  "gate": "pending",
  "templateExceptions": []
}
```

- `"pending"`: the numbers are reported, nothing fails. Every area starts here.
- `"enforced"`: CI fails when one of the three numbers is below its minimum, or when a route of
  the area is never opened by a behavioural spec. From then on `console.error` in the area's
  pages fails its tests too. The pull request that finishes an area's specs switches it over.

Coverage from both suites counts, the real-stack flows included.

## Exceptions need a reason

**In `<script>` and `.js`**: the usual istanbul comments, with a reason after ` -- `:

```js
/* istanbul ignore next -- the print dialog of the browser is outside the page, a test can't see it */
/* istanbul ignore if -- the API never sends an event without organisers */
/* istanbul ignore else -- ... */
```

`npm run lint` in `e2e/` fails for an ignore comment without a reason (see below for what
counts as one), for one written as a `//` comment or outside `<script>`, and for
`istanbul ignore file`, `c8 ignore` and `v8 ignore`. The coverage summary lists every
ignore comment with its place, so a reviewer sees them all.

**In templates** comments can't be used. Add the condition to the area's file instead:

```json
{
  "gate": "enforced",
  "templateExceptions": [
    { "file": "views/events/Single.vue", "condition": "_vm.event.status === 'cancelled'", "reason": "events have no such status" }
  ]
}
```

`condition` is the exact text of the condition in the generated render file (open it in the HTML
report). An exception that matches nothing fails the gate, so none are left behind when the
template changes.

A reason has at least four words and 20 characters of its own (repeating the condition doesn't
count) and is not a placeholder: `todo`, `tbd`, `n/a`, "hard to test", "see above" and the like
are refused, for ignore comments (`npm run lint`), template exceptions and accepted downgrades
(the gate), and for the `optional` of a handler of the API mock (when the test runs). That only
stops entries nobody meant to be read. A good reason says why no test
can reach the code: a browser feature the test browser lacks, a defensive branch for something
the API can't answer.

## Every route is opened

For an enforced area, each of its routes in `frontend/src/router/routes.js` must be opened by at
least one behavioural spec. The generated smoke and axe tests don't count. This is recorded from
the pages a test visits; nothing has to be annotated.

## The gate can't get weaker unnoticed

`node scripts/coverage.ts gate` (and `gate-config`, which needs no coverage data and is part of
`npm run lint`) compares the gate's own files with a base: in CI the merge base with
`origin/stable`, on `stable` the commit before, or `--base <commit>`. It fails when

- an area that was `enforced` is `pending` again or lost its file,
- a template exception or an `istanbul ignore` comment was added in an area that was enforced
  at the base,
- the ignore comments of a file in such an area take more lines of code out of the numbers
  than before, also when there are as many of them: a comment moved from one statement to the
  function around it is a downgrade,
- a threshold was lowered.

For that, the gate works out what each comment covers, in the file as it is now and at the base:
the statement, function or expression that starts after the comment (what istanbul attaches it
to), or the side of the `if` or `?:` that `ignore if` and `ignore else` name. It adds up the
lines per file. Moving ignored code, or changing it without making it longer, is not a
downgrade; an ignored function that grows is one, and is accepted like the others.

To accept one, add `e2e/ui/support/coverage/downgrades.json` in the same pull request:

```json
[
  { "change": "pending", "area": "events", "reason": "…" },
  { "change": "exception", "file": "views/events/Single.vue", "condition": "_vm.event.status === 'cancelled'", "reason": "…" },
  { "change": "ignore", "file": "frontend/src/views/events/Single.vue", "reason": "…" },
  { "change": "threshold", "metric": "templateBranches", "reason": "…" }
]
```

Every downgrade is printed as `COVERAGE-DOWNGRADE: …`, accepted or not, so `grep ^COVERAGE-` on
the job's output shows them all. An entry only counts in the change that adds it: one that
matches no downgrade fails, and one left over from a merged change accepts nothing and is
reported until it is removed. Exceptions and ignore comments added while an area becomes
enforced are part of that review: they are printed as `COVERAGE-EXCEPTION-ADDED: …` and need no
entry. Without `origin/stable` the comparison is skipped locally and fails in CI.

## Codecov

`frontend-coverage` uploads the script half of the numbers to Codecov (flag and component
`frontend`). `codecov.yml` keeps frontend code out of the two statuses that gate a pull request:

| Status | Covers | Can fail |
|---|---|---|
| `codecov/project`, `codecov/patch` | the six services (`paths` of the `default` statuses) | yes |
| `codecov/project/frontend`, `codecov/patch/frontend` | `frontend/**` | no: `informational: true` |

The two are about different things. The services have unit tests and are near 99 %; adding the
frontend's numbers to the same status would drop it to about 74 % and fail every pull request
that touches a view without covering each new line. The frontend's own gate is the one per
area above, in the `frontend-tests` workflow, and it is the stricter one for every area that is
enforced (it also counts template branches, which Codecov never sees).

The frontend statuses stop being informational when the last area's gate is enforced, in the
pull request that enforces `shell` ([area-definition-of-done.md](area-definition-of-done.md)):
remove the two `informational: true` lines under `frontend` in `codecov.yml`. From then on
`codecov/project/frontend` fails when the frontend's script coverage drops, and
`codecov/patch/frontend` when the changed lines of a pull request are covered less than the
project is. Until then they are shown on every pull request and block nothing. The components
in the same file (`component_management`) have no statuses of their own; they only split the
numbers per service in Codecov's comment.

### The frontend upload is carried forward

Codecov reports on a commit once its report has `after_n_builds` sessions (`codecov.yml`). Every
upload is a session: one per container of the six service test jobs (core and statutory run
four, the other four services one), one each from `mailer-test` and `dispatcher-test`, and one
from `frontend-coverage`: 15.

`frontend-coverage` only runs when `frontend-mocked-test` and `e2e-test` passed. The flag
`frontend` is therefore carried forward (`flag_management` in `codecov.yml`): when the first
upload of a commit arrives, Codecov copies the frontend's coverage of the parent commit into the
new report as a session of its own, and when the frontend's upload arrives it replaces that
copy. The report has one frontend session from the start, whether `frontend-coverage` runs or
not, so the fifteenth session is always the last upload of the services, mailer or dispatcher:

| `frontend-tests` | Sessions | Codecov posts |
|---|---|---|
| green | 14 uploads and the frontend's, which replaced the copy | all statuses once all 14 are in. When the frontend's upload comes last, Codecov has reported with the copy and reports again with the commit's own numbers |
| red, cancelled | 14 uploads and the copy | all statuses once all 14 are in; the two frontend statuses show the parent's numbers. They are informational, and the red workflow is what says the frontend is not fine |

The two ways that were not chosen:

- Waiting for 15 uploads without carrying the frontend forward: a single failing frontend test
  would leave Codecov waiting for an upload that never comes, and it would post no status at
  all, also no `codecov/project` for the services on a pull request that may not have touched
  them.
- Waiting for 14 and not counting the frontend (the setup before): when the frontend's upload
  arrived before the last service container, it took that container's place, and Codecov
  reported `codecov/project` with one container missing, a failing status for a minute or so.

Limits: Codecov copies from the nearest parent commit with a finished report, at most ten
commits back. A commit without such a parent and without a frontend upload of its own has 14
sessions, and Codecov posts nothing for it until `frontend-coverage` runs (rerun it, or push
again). A rerun of any job with an upload adds a session, so the commit can be reported before a
later upload; the next upload reports again.

`node packages/backend-test-utils/check-codecov-builds.js` (the `openapi` job) keeps the number
honest. It counts the uploads of the jobs that run on every push and of the jobs that `requires`
others, and fails when either `after_n_builds` differs, when the upload of a job that
`requires` others has a flag that is not carried forward, or when an upload that runs on every
push is carried forward (its copy would count before it arrives).

After changing `codecov.yml`, check it: `curl --data-binary @codecov.yml https://codecov.io/validate`
(it sends the file and nothing else), and `node packages/backend-test-utils/check-codecov-builds.js`
for `after_n_builds`.

## Running it yourself

```sh
cd e2e
npm run setup:frontend                              # the instrumented build
E2E_COVERAGE=1 npm run test:mocked
E2E_COVERAGE=1 npm test                             # optional: the real stack counts too
npm run coverage                                    # merge and report
npm run coverage:gate
npm run coverage:gate-config                        # the gate's own files only, no coverage data needed
```

- `e2e/.coverage/summary.md`: the table per area that the commands also print.
- `e2e/.coverage/report/index.html`: every file line by line, the render files included.
- `e2e/.coverage/report/lcov.info`: what goes to Codecov. It has the script half only, because
  the render files are not in the repository.

Without `E2E_COVERAGE=1` nothing is collected. With it, a run first removes what an earlier
run of the same suite wrote (and says so), so the report is about the last mocked run and the
last real-stack run, never about a sum of runs nobody remembers. To add up several partial
runs on purpose (one area at a time, say), set `E2E_COVERAGE_KEEP=1` on all but the first.
`npm run setup:frontend` removes everything: data of another build can't be merged anyway.

A test that fails or runs into its timeout still hands over what it covered: the counters are
read from its pages when the test is torn down. What is lost is the data of a worker that
crashes or is killed, because a worker writes its sum when it stops. A run in which that
happens is red anyway; don't read coverage numbers from a red run.

For one area while writing its specs:

```sh
E2E_COVERAGE=1 npx playwright test -c playwright.ui.config.ts ui/events --project=vue
npm run coverage
```

## How it works

- `FRONTEND_COVERAGE=1` switches `frontend/vue.config.js` to a build without minification, with
  source maps, and with `frontend/build/coverage-loader.js` as the last webpack loader for the
  code in `src/`. The loader instruments scripts with their source map and render functions as
  files of their own. The production build doesn't load it.
- `e2e/support/coverage.ts` collects `window.__coverage__` from the pages of every test, per
  worker, into `e2e/.coverage/raw/`. A full page load would lose it, so it is handed over
  through `sessionStorage`.
- `e2e/scripts/coverage.ts merge` starts from the empty coverage of every file (written at build
  time, so files no test loads count as 0 %), adds the raw files and maps the scripts back to
  their sources. It refuses to merge data from different builds.
- `report` writes the reports; `gate` checks the areas, and first the gate's own files against
  their base (`e2e/scripts/coverage-gate.ts`).
- CI builds in every container and merges in the `frontend-coverage` job.

## Limits

- The suites test the instrumented, unminified build. A bug that only minified code has would
  not show up; `E2E_FRONTEND_BUILD=production` builds the production one to look for it.
- Template coverage is shown on generated code, not on template lines.
- All containers of a CI run must check the repository out at the same path: the build
  identifies a file by its path, and data of different builds is not merged.
