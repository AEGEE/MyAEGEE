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

Code that Vue generates for `v-model` and event modifiers (`if ($event.target.composing) return`)
is left out: no test can reach both sides of it.

Not measured, so check it with assertions where it matters: attribute bindings (`:disabled`,
`:class`), slot fallbacks and what happens inside Buefy.

## The gate

Per area (see [README.md](README.md#areas)), three numbers:

| Metric | Minimum |
|---|---:|
| Script lines | 90 % |
| Script branches | 85 % |
| Template branches (`v-if`, `v-show`, ternaries) | 85 % |

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
/* istanbul ignore next -- needs WebGL, which the CI browser lacks */
/* istanbul ignore if -- the API never sends an event without organisers */
/* istanbul ignore else -- ... */
```

`npm run lint` in `e2e/` fails for an ignore comment without a reason of at least three words,
for one written as a `//` comment or outside `<script>`, and for `istanbul ignore file`,
`c8 ignore` and `v8 ignore`. The coverage summary lists every
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

A good reason says why no test can reach the code: a browser feature the test browser lacks, a
defensive branch for something the API can't answer. "Hard to test" is not one.

## Every route is opened

For an enforced area, each of its routes in `frontend/src/router/routes.js` must be opened by at
least one behavioural spec. The generated smoke and axe tests don't count. This is recorded from
the pages a test visits; nothing has to be annotated.

## Running it yourself

```sh
cd e2e
npm run setup:frontend                              # the instrumented build
E2E_COVERAGE=1 npm run test:mocked
E2E_COVERAGE=1 npm test                             # optional: the real stack counts too
npm run coverage                                    # merge and report
npm run coverage:gate
```

- `e2e/.coverage/summary.md`: the table per area that the commands also print.
- `e2e/.coverage/report/index.html`: every file line by line, the render files included.
- `e2e/.coverage/report/lcov.info`: what goes to Codecov. It has the script half only, because
  the render files are not in the repository.

Without `E2E_COVERAGE=1` nothing is collected. What runs collect adds up in `e2e/.coverage/`
until the next `npm run setup:frontend`, which starts clean (data of another build can't be
merged anyway).

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
- `report` writes the reports; `gate` checks the areas.
- CI builds in every container and merges in the `frontend-coverage` job.

## Limits

- The suites test the instrumented, unminified build. A bug that only minified code has would
  not show up; `E2E_FRONTEND_BUILD=production` builds the production one to look for it.
- Template coverage is shown on generated code, not on template lines.
- A checkbox with `v-model` compiles to a check whether its value is an array
  (`Array.isArray(_vm.x) ? ... : _vm.x`). For a checkbox bound to a boolean one side can never
  run; that is what a template exception is for.
- All containers of a CI run must check the repository out at the same path: the build
  identifies a file by its path, and data of different builds is not merged.
