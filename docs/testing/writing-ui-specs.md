# Writing specs for the mocked-API suite

The suite runs the built frontend in a browser and answers every request the page makes. A spec
says what the API answers, goes to a page, and checks what a user sees and what the page sends.

Every spec runs twice: on a desktop viewport (project `vue`) and on a phone (project
`vue-mobile`, a Pixel 7). It must pass on both with the same steps.

A spec may only rely on what a user sees: roles, labels and text. Never on CSS classes, test ids
or the app's internals. That is what lets the same spec check a page after it has been rewritten.

## A spec, from top to bottom

```ts
// e2e/ui/events/apply.spec.ts (shortened)
import { notFound, ok, validationError } from '../support/factories/base.ts';
import { event, eventPermissions, question } from '../support/factories/events.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('applying to an event', () => {
    test('shows why the service refused the application', async ({ page, api }) => {
        // 1. What the API answers. Anything the page asks for that isn't answered fails the test,
        //    and so does an answer that the page never asks for.
        const data = event({ id: 5, url: 'spring', name: 'Spring Training', questions: [question({ type: 'string', description: 'Why?', required: true })] });
        api.json('GET events /single/:id', ok(data, { permissions: eventPermissions() }));
        api.on('GET events /single/:id/applications/:application_id', { status: 404, json: notFound('Application with id me not found') });
        api.on('POST events /single/:id/applications', { status: 422, json: validationError({ answers: ['Answer number 1 ("Why?") is too short.'] }) });

        // 2. What the member does, found the way a person finds it.
        await page.goto('/events/spring/applications/me');
        await page.getByRole('textbox', { name: /Why\?/ }).fill('x');
        await page.getByRole('checkbox', { name: /I agree with my personal data/ }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        // 3. What they see, and what was sent.
        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: 'Answer number 1 ("Why?") is too short.' })).toBeVisible();
        expect(api.callsTo('POST events /single/:id/applications').map((call) => call.body))
            .toEqual([{ body_id: 1, answers: ['x'], agreed_to_privacy_policy: true }]);
    });
});
```

## Files and names

- One file per routed view: `e2e/ui/<area>/<view>.spec.ts`, where `<view>` is the view's path
  under `frontend/src/views/<area>/` in kebab case. `views/core/members/List.vue` is tested in
  `e2e/ui/core/members-list.spec.ts`, `views/events/Single.vue` in `e2e/ui/events/single.spec.ts`.
  The file covers every route that uses the view. Modals and child components are tested in the
  spec of the page that opens them.
- A view that needs more than about 40 tests may split by topic: `members-single-modals.spec.ts`.
- Shell specs (`e2e/ui/shell/`) are named by topic.
- `test.describe('<what the page is>')`, and test titles say what a user sees or does:
  "organisers get the actions they are allowed".
- Files a spec uploads go in `e2e/ui/fixtures/<area>/` (see the README there): small, made
  for the test, never real member data.

## Fixtures

Import `test` and `expect` from `ui/support/test.ts`.

| Fixture | What |
|---|---|
| `session` (option) | Who is logged in: `'member'` (default), `'board'`, `'superadmin'` or `'anonymous'`. `test.use({ session: 'board' })` |
| `me` | The logged-in member, or `null`. `member` is Alex Member (id 2), `board` is Bea Board (id 3, in the board circle of body 1), `superadmin` is Ada Admin (id 1). Change it before `page.goto()` for another profile: `me!.privacy_consent = null` |
| `myPermissions` | What `GET core /my_permissions` answers: the global permissions of the session's circles in core's seed (every permission for a superadmin). Change the array before `page.goto()` |
| `tokens` (option) | Which tokens the browser starts with: `'both'` (default), `'access'`, `'refresh'`, `'none'` |
| `api` | The API mock, see below. `GET core /members/me`, `GET core /my_permissions` and `POST core /logout` are answered already. It is there for every test, also one that only takes `{ page }`, and for every page of the test's browser context (a second tab, a popup) |
| `strictApi` (option) | `true`: a request nobody answered fails the test. Only the generated smoke and axe tests turn it off (lint refuses it elsewhere) |
| `layout` | `'desktop'` or `'phone'`. Pass it to the helpers that need it; don't branch on it in a spec |
| `frontend` | Which app the project runs: `'vue'` |
| `allowedConsoleErrors` (option) | `console.error` messages the test expects, as regular expressions with the text of the message |
| `now` (option) | For the generated tests only: sets the clock and dates the logged-in member from one instant. A behavioural spec calls `freezeTime(page)` |

The session is in the browser from the start: the tokens are part of the context's storage
state, so a second page of the same test is logged in too, and what the app does to the tokens
(renewing them, logging out) is kept. Don't open a context of your own with `browser.newContext()`:
it would have no mock, no session and none of the checks below. For the same reason lint keeps a
spec inside the harness: it takes `test` and `expect` from `ui/support/test.ts` and from nowhere
else (types of `@playwright/test` are fine), makes no `test` of its own with `test.extend()`,
doesn't replace the harness's fixtures with `test.use({ api: … })`, and sends no requests from
the test process (`page.request`, `context.request`, the `request` fixture): those go around the
mock, straight to the suite's static server, and nothing is recorded. Let the page ask
(`page.goto()`, a click, `page.evaluate(() => fetch(…))`) and read `api.callsTo(…)`.

Four checks run in every test without being asked for:

- A request that no handler answers fails the test ("requests nobody mocked"). When the test
  failed for another reason first, the list is shown next to that failure and attached to the
  test, because a forgotten mock is the usual reason for an assertion that timed out. The same
  goes for a request to the suite's own address that is neither `/api/<service>/…`, a file of
  the frontend build nor a page navigation, such as `/apii/events`, `/api` or `/API/events`: the
  page gets a 404 for it (not the app's `index.html` with a 200), and the test fails.
- A handler that no request matched fails the test ("handlers that no request matched"): the
  route has a typo, or the page stopped asking. See "Answering the API" for the ways out, and
  "When the handlers are judged" for the moment this is decided.
- An uncaught error in a page fails the test.
- `console.error` in the page is recorded. Vue reports errors in render functions, watchers and
  hooks this way. In an area whose coverage gate is enforced they fail the test; before that
  they are noted on the test in the report. The browser's own "Failed to load resource" lines
  for mocked error answers don't count.

## Answering the API

Handlers are written like routes, without the `/api` prefix: `'METHOD service /path/:param'`,
with exactly one space between the three parts. The last handler that matches wins, so a test
can override a default.

A route that could never match is refused where it is written, in `api.on()`, `api.json()`,
`api.url()` and `api.callsTo()`: a method that isn't `GET`, `POST`, `PUT`, `PATCH`, `DELETE` or
`*` (`get`), a service that isn't one of `core`, `events`, `summeruniversity`, `statutory`,
`discounts`, `network`, `mailer` (`evnts`), a path without its leading slash, with `/api`, a
query string or a `*` in it (`GET events/`, `GET events /?search=x`). The message says what is
wrong and, for a typo, what was probably meant. Without this, `api.callsTo('POST evnts /')`
would count no calls and an assertion that nothing was sent would pass.

**Every handler has to be used.** A handler that no request matched fails the test. Three kinds
of handler are exempt:

```ts
api.json('GET events /mine/organizing', ok([]), { optional: 'only asked for when the member organises an event' });
api.json('GET events /', ok([eventSummary()]));      // replaced by the next line: same route, registered later
api.json('GET events /', ok([]));
api.fallback(mockEverything);                         // fallback answers are never required
```

`optional` takes the reason, under the same rule as a coverage exception
([coverage.md](coverage.md)): at least four words and 20 characters, no placeholder (`todo`),
and "hard to mock" is not a reason. Use it for an answer of a shared `beforeEach` that some of
its tests don't need; don't use it to quieten a test whose page stopped asking.

**When the handlers are judged.** A test ends with its last assertion, and the page may not have
sent every request by then: a request follows a render, a debounce or a timer of the page, and
under load the browser gets to it late. So a test that reached its end with a handler nobody
has used yet waits for that request, for at most five seconds (the time every assertion of the
suite gets), and fails only when it still hasn't come. What this means for a spec:

- A test whose handlers were all used ends at once. Only a test that is about to fail for an
  unused handler waits, so the wait costs nothing in a green run.
- A request the page sends shortly after the last assertion counts. You don't have to add
  `await expect.poll(() => api.callsTo(route)).toHaveLength(1)` only to keep the test from
  ending too early. Add it when the request is what the test is about.
- A handler that is really unused still fails the test, five seconds later, and a request that
  arrives late for one handler doesn't hide another one that nothing asked for.
- The wait is in real time. A test that stopped the page's clock (`freezeTime`) and never
  moves it on gets no request from a timer of the page, and fails for its handler.
- A test that failed or timed out is not judged for unused handlers: it didn't get to all its
  requests. The list is attached to it all the same.

```ts
api.json('GET events /single/:id', ok(event()));                         // 200 with this body
api.on('GET events /', { status: 500, json: { success: false, message: 'Database is down' } });
api.on('GET events /', ({ query }) => ({ json: ok(query.get('search') ? [] : [eventSummary()]) }));
api.on('GET events /', { json: ok([]), delayMs: 500 });                   // to see a loading state
api.on('GET events /', { abort: 'failed' });                              // a network error
api.on('GET events /single/:id/applications/export', {                    // a download
    body: fs.readFileSync(file), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
```

A JSON error for a request the page made as a download works as usual (`{ status: 403, json }`).

**Every request that changes something gets its body checked:**

```ts
expect(api.callsTo('PUT events /single/:id/applications/:application_id').map((call) => [call.params, call.body]))
    .toEqual([[{ id: '5', application_id: 'me' }, { answers: ['Because'] }]]);
```

A recorded call has `method`, `service`, `path`, `params`, `query`, `headers`, `body` (parsed
JSON), `status`, and for uploads `parts`: the fields of a `multipart/form-data` body, with
`name`, and `filename` and `contentType` for files or `value` for text. `raw` is the body as sent.
`api.callsTo('* * *')` is every call to a service, `api.unhandled` the ones nobody answered and
`api.unused` the routes of the handlers that nothing has matched yet.

**Requests outside `/api`**: the calendar and wiki proxies, files of the services, other hosts.

```ts
api.url('GET', '/services/calendar-cors/**', { body: ical, contentType: 'text/calendar' });
api.url('GET', 'https://api.github.com/**', { json: [] });
expect(api.callsTo('GET url /services/calendar-cors/**')).toHaveLength(1);
```

A path pattern is for the app's own origin; `**` matches anything, `*` anything but a slash.
Requests under `/services/` and `/media/` that nobody answered fail the test like API calls do.
Requests to other hosts are blocked unless the test answers them.

**A page of another area** at the end of a spec (after a redirect or a click) doesn't need its
calls listed. Generic answers step in only where the test has none:

```ts
import { mockEverything } from '../support/smoke/index.ts';
api.fallback(mockEverything);
```

**Maps**: `mockMap(api)` from `ui/support/map.ts` answers the map style request, so a map
loads without the internet.

**Permissions for one body, member or circle**: `permissionsFor(api, 'bodies', 1, ['local:update:body'])`.

## Factories

A factory builds one object the way the real service sends it:
`e2e/ui/support/factories/<area>.ts`, with shared helpers in `factories/base.ts` (`ok`, `okList`,
`validationError`, `unprocessable`, `badRequest`, `forbidden`, `notFound`, `id`, `iso`, `date`).
There is no index file: import from the file that has the factory.

1. It returns a complete object: every field the service sends that the frontend could read,
   with realistic defaults, and takes `Partial<T>` overrides.
2. Its type is an `interface` in the same file.
3. Ids come from `id()` unless the test passes one. Dates are relative to now (`iso(-5)`), so
   "open for applications" stays true whenever the tests run. A spec that checks a date on the
   page passes a fixed one.
4. It has a contract check in `e2e/tests/<area>-contract.spec.ts` (or
   `<area>-<part>-contract.spec.ts` next to `factories/<area>-<part>.ts`), added in the same pull
   request: `expectShape('<factory name>', factory(), realAnswer)`. `npm run lint` fails for a
   factory without one. Helpers that build no entity are listed in the file's `NOT_ENTITIES`.
5. An entity belongs in the file of the area that owns it. Another area builds on that factory
   with overrides instead of adding its own version.
6. A large area may split its factories into `factories/<area>-<part>.ts`, with their contract
   checks in `tests/<area>-<part>-contract.spec.ts`. `npm run lint` reads every `*-contract.spec.ts`.

## Dates and time

The suite runs in the time zone `Europe/Brussels` with the locale `en-GB`.

- A spec that depends on "now" (deadlines, bans, default dates, download names) calls
  `await freezeTime(page)` before `page.goto()`. That sets the clock to `FIXED_NOW`
  (2027-03-01 10:00 in Brussels, a Monday in winter time) and lets it run on from there, so
  toasts and timers work. Build its dates with `iso(n, Date.parse(FIXED_NOW))`.
- After `freezeTime(page)`, `await passTime(page, 3500)` lets that much time pass at once: to
  see that a toast is gone, or a timer of the page fire, without waiting for it.
- Another instant (summer time, a weekend) goes through `freezeTime(page, '2027-07-03T12:00:00+02:00')` too.
- Check both winter and summer time where a page shows times.

## Finding elements

Allowed: `getByRole` (with `name` when more than one could match), `getByLabel`, `getByText` for
text that isn't a control, `getByTitle` for icon-only elements with a title. Narrow down with
`.filter({ hasText })` and containers: `getByRole('row').filter(...)`.

Not allowed in `e2e/ui/` (ESLint stops them): `locator()`, `getByTestId`, `getByPlaceholder`,
`getByAltText`, `$`, `$$`, `waitForTimeout`, and reading the app's internals (`__vue__`, the
store).

**When a role can't find an element, the markup is wrong, not the rule.** Fix it in the view, in
a commit of its own (`fix(frontend): ...`), the same way everywhere:

| Problem | Fix |
|---|---|
| A link without `href` that only reacts to a click | `<button type="button">` |
| A `<button>` in a form that should not submit it | `type="button"` |
| A label that isn't tied to its field | `<label for>` with an `id` on the control, or `b-field :label-for`; controls per row get `aria-label="<what> of <row name>"` |
| A page title that is a `div` | `<h1 class="title">` (or `role="heading" aria-level="1"`); tile and section titles `<h2>`. Specs use `getByRole('heading', { name })` without a level |
| A dialog or modal opened from code | Its role is set for all of them (`frontend/src/app.js`). The call only adds what names it: `title` for `dialog.confirm`/`alert`/`prompt`, `ariaLabel` for `modal.open`, `inputAttrs: { 'aria-label': ... }` for a prompt's input. Buefy's dialog doesn't refer to its own title, so `app.js` ties them together when a dialog opens: it is named by its title (`aria-labelledby`) and described by its message; one without a title is named by its message. Specs: `page.getByRole('alertdialog', { name: 'Deleting an event' })` or `dialog(page, 'Deleting an event')` |
| A paginated table | `ariaNextLabel="Next page"`, `ariaPreviousLabel="Previous page"`, `ariaPageLabel="Page"`, `ariaCurrentLabel="Current page"` on the `b-table`, as camelCase props (frontend lint refuses `aria-next-label` in a template as an unknown ARIA attribute). The page buttons are named "Page 3." and "Current page, Page 2.". The arrows are "Previous page" and "Next page" when the table is first shown, but once the page has changed Buefy 0.9 names them after the page they go to ("Page 3."). So specs use `getByRole('button', { name: 'Next page' })` only on the first page shown, and find a numbered page inside its list item, with an exact name: `page.getByRole('listitem').getByRole('button', { name: 'Page 3.', exact: true })` |
| A loading state a spec needs to see | `:aria-busy` on the region around the `b-loading`. Otherwise wait for the content, never for the overlay |
| A date picker (flatpickr) | `allowInput: true` and `disableMobile: true` in its config, an `id` and a label; specs use `fillDate()` |
| A Buefy datepicker | `editable`, `:mobile-native="false"` and a label; specs `fill('1999-05-01')` and leave the field |
| Something only shown on one viewport (`is-hidden-mobile`) | Both viewports get a way to the same action, by the same role and name |

An exception to a lint rule needs its reason on the same line, or lint fails:
`// eslint-disable-next-line no-restricted-syntax -- <why>`.

## Helpers

From `ui/support/shell.ts`. They hide what differs between the two viewports.

| Helper | Use |
|---|---|
| `toast(page, text)` | The toast after an action. A toast stays three seconds, and longer for a long text (60 ms per character, ten seconds at most): check it right away |
| `dialog(page, name?)` | The open confirmation, prompt or modal, by its name (the dialog's `title`, the modal's `ariaLabel`); or narrow down with `.filter({ hasText })` |
| `openMenu(page, layout)` | The sidebar menu, opened first on a phone. Returns it |
| `openAccountMenu(page, layout)` | The top bar's account menu ("See my account", "Logout", or "Login" for a visitor), opened first. Returns it |
| `accountMenuToggle(page, layout)` | The button that opens and closes the account menu; its `aria-expanded` says whether it is open |
| `tableRows(table)` | The rows of a table that hold data. An empty table has 0: the row Buefy renders to say "Nothing here." doesn't count |
| `expectEmptyTable(table, text?)` | The table has no data and shows its row for that, with the app's "Nothing here." (or `text`; `null` for a table without such a text). Wait for the table's request first: a table that is still loading is empty too |
| `cellOf(table, row, column)` | The cell of a row in the column with this header (`await` it) |
| `sortBy(table, column, layout, direction?)` | Sorts a table that isn't sorted by that column yet |
| `permissionsFor(api, kind, id, combined)` | Answers the permissions for one body, member or circle |
| `freezeTime(page, iso?)` | Sets "now" |
| `passTime(page, ms)` | Lets time pass at once, after `freezeTime()` |
| `fillDate(input, value)` | Types a date into a flatpickr field, in the format the field shows (`'2027-03-01 10:00'`) |

Tooltips have no helper: `focus()` the "More information" button instead of hovering, which
works with touch too. A column header that holds a tooltip has "More information" in its name,
so match such headers with a regular expression (`/^Starts/`).

## Passing on a phone

Measured on both projects against the participants table of an event (`e2e/ui/harness/`):

| On a phone | What to do |
|---|---|
| The sidebar is closed when a page loads and closes again on every navigation | `openMenu(page, layout)` every time before using a menu link. Don't keep its result over a navigation, and wait for the new page before calling it again. Reach pages with `page.goto()` or links in the page unless the menu is what you test |
| The account menu is behind a button | `openAccountMenu(page, layout)` |
| Buefy shows a table as cards. The `table`, `row` and `cell` roles stay; the column headers are hidden, and the names of rows and cells gain the column labels | Find rows with `tableRows(table).filter({ hasText })` or a regular expression, never an exact name. Read a cell with `cellOf()`. Check text with `toHaveText`/`toContainText`, which don't include the added labels. No `getByRole('columnheader')` in a spec |
| The column headers can't be clicked; Buefy shows a select and a direction button above the cards | `sortBy()` |
| flatpickr would switch to the browser's own date input | `disableMobile: true` on the picker and `fillDate()`. A picker without it fails on the phone project: its labelled field is gone there |
| Dialogs and modals are full width | Nothing: `dialog(page)` is the same |
| No hover | `focus()` instead |

A table that turns off the cards (`:mobile-cards="false"`) stays a normal table on a phone.

### Opting out

A test may run on one project only:

```ts
test('sorts by clicking the column header', {
    tag: '@desktop-only',
    annotation: { type: 'desktop-only', description: 'the phone has the sort select instead (covered by the next test)' }
}, async ({ page }) => { ... });
```

- `@desktop-only` needs the annotation with a reason; lint checks that it is there, and the run
  lists every such test with its reason (`test-results-ui/desktop-only.json`). Accepted reasons:
  the phone shows another control for the same thing and a test next to it covers that, or a
  measured technical limit. Not accepted: "admin page", "table is shown as cards", "menu is
  closed", "slow". The helpers deal with those.
- `@phone-only` is for behaviour that only exists on a phone (the closed sidebar, the menu
  button). It needs no reason.
- No other tags in specs.

## No skipped tests, no expected failures, no flaky tests

`test.skip`, `test.fixme`, `test.fail` and `test.only` (and their `describe` forms) are lint
errors in `e2e/ui/`. A reporter (`e2e/ui/support/no-expected-failures.ts`) also fails the run
when a test was skipped or expected to fail, which catches a skip inside a condition or a loop.

CI retries a failed test once. That tells a test that fails now and then from one that is
broken, and keeps the trace of the failed attempt. It does not make the run green: the same
reporter fails the run for a test that passed only on its retry, and lists it as
`passed only on a retry (flaky)`. Fix the test (usually a missing wait for what the user would
see) or the page; locally there are no retries.

When a spec finds a bug, the bug is fixed in the same pull request, in a commit of its own, and
the spec checks the fixed behaviour.

## A test checks something

A green test has to mean that something was checked. `npm run lint` refuses the ways a test can
pass without that (the rules are in `e2e/lint/rules/`, each shown at work in `e2e/lint/fixtures/`):

| Not allowed | Instead |
|---|---|
| A test without an assertion | `expect(…)`, `expect.poll(…)`, or one of the suite's asserting helpers. Their names are listed in `e2e/lint/assertion-helpers.js` (`expectStatus`, `expectShape`, `expectEmptyTable`); a new helper that asserts by itself is named `expect…` and added there |
| A test whose only assertions are in a loop that may run zero times (`for (const row of await rows.all())`, `calls.forEach(…)`) | Assert the number of items before the loop (`await expect(rows).toHaveCount(3)`), or loop over a list written out in the spec |
| `return` in the body of a test, in a `describe`, or in a `test.step` before its last statement | Every test and every step runs to its end, on both projects, and a `describe` declares all its tests. A step may end with `return <its result>` |
| A condition on `layout`, `frontend`, `isMobile`, `viewport`, `page.viewportSize()` or `testInfo.project` in a spec, also when its answer is first kept in a variable (`const phone = ['phone'].includes(layout)`) or the fixture is renamed (`{ layout: l }`) | Pass `layout` to a helper of `ui/support/shell.ts` (or add one there). Behaviour of one viewport only is a `@phone-only` test, or a `@desktop-only` test with a reason |
| An assertion inside `if`, a ternary, `&&`, `switch`, `catch`, or a `try` with a `catch` | Set up the one case the test is about and assert without a condition; two cases are two tests. `try`/`finally` for cleaning up is fine |
| `expect(x)` without a matcher, an expectation about a constant, `.catch()` on an expectation | An expectation that can fail |
| A promise nobody waits for: `page.goto()`, `click()`, `expect(locator).toBeVisible()` without `await` | `await` it |
| `test.skip`, `.fixme`, `.fail`, `.only` in any form: on `describe`, `test.step`, `testInfo`, under another name, as `annotation: { type: 'skip' }`, or a test that is only declared when a condition holds. A `skip`, `only` or `fail` of something that isn't Playwright's (`paging.skip` in an answer of the mock) is fine | Fix the page or the test |
| `test.use({ strictApi: false })` in a behavioural spec | Answer the request, or `api.fallback(mockEverything)` for a page of another area |
| `allowedConsoleErrors` that allows everything (`/.*/`, `/./`, a variable) | Regular expression literals with the text of the message: `[/Network Error/]` |
| `retries`, serial mode, a time limit of 0, given to Playwright in a spec (`test.use`, `test.describe.configure`, `test.setTimeout`). Data with the same names (`{ retries: 3 }` in an answer of the mock) is fine | A test passes alone, in any order, at the first try. `test.slow()` and `test.setTimeout(n)` are fine |
| Leaving the harness: `test` or `expect` imported from `@playwright/test` or from another file than `ui/support/test.ts`, `test.extend()`, `test.use()` with a fixture of the harness (`api`, `pageErrors`, `consoleErrors`, `storageState`, `page`, `context`, `layout`), `page.request`, `context.request`, the `request` fixture | See "Fixtures": `test.use()` for the options, the page for the requests, `ui/support/` for what specs share |

An exception needs its reason on the same line (`// eslint-disable-next-line <rule> -- <why>`), in
`e2e/ui/` and in `e2e/tests/`, and a disable comment that no longer suppresses anything is an error.
The same rules, apart from the ones about viewports and the API mock, hold for the real-stack suite.

`npm run lint` checks the rules themselves too (`e2e/lint/rules.test.js`): every fixture is
linted with the real configuration and has to be reported on exactly its marked lines. CI lints
with `CI=true`, which makes typescript-eslint read files from disk in one run; the test covers
both ways, so run `CI=true npm run lint` when a change to the rules passes locally and fails in CI.

The custom rules are loaded with `--rulesdir`, which `npm run lint` passes. An editor needs to
be told too, or it reports "Definition for rule 'e2e-…' not found": in VS Code,
`"eslint.options": { "rulePaths": ["e2e/lint/rules"] }`.

## The suite checks itself

`e2e/ui/harness/` holds the suite's own tests. Besides the helpers and the API mock on real
pages, `self-check.spec.ts` runs the tests of `e2e/ui/harness/must-fail/` as a Playwright run of
its own (`e2e/playwright.selfcheck.config.ts`) and checks how each one ended: a test that takes
only `{ page }` and forgets a mock has to fail, and so do a request from a second page, a
request with a wrong address (`/apii/…`), an unused handler (also next to one that got its
request late), a test that passed only on its retry and a test that skipped itself while
running; a test whose page sends a request just after its last assertion has to pass. A change to the fixtures, the mock or the reporter that opens one of these holes turns
that spec red. Add a case there when you add a safety net.

## The generated tests

Two files make one test per route of `frontend/src/router/routes.js`, with generic answers from
`e2e/ui/support/smoke/`:

- `ui/smoke/routes.spec.ts`: every page loads on both viewports, gets its title, throws nothing
  and shows no error toast.
- `ui/a11y/pages.spec.ts`: the axe run, see [accessibility.md](accessibility.md).

A new route is picked up by itself. If its page needs more than empty lists to load, add answers
to `smoke(api)` in its area's file. That file also has `params` (values for the route's path
parameters; the default is `1`), `redirects` (pages that send every viewer on),
`expectedAlerts` (error toasts that are the right result of having no data) and `profiles`
(what to change about the logged-in member for a page that only some members get: the page
for completing a profile needs a member whose profile is incomplete). A key that is no route of
the area fails every generated test with a message that says which.

Both runs check, once the page has settled, that it is still the page of the route: a page
that sends the viewer somewhere else fails until it is listed in `redirects`, so no page is
"checked" by looking at another one. Both run on a fixed day (`test.use({ now: FIXED_NOW })`,
with the generic answers dated from the same instant), so a calendar or a deadline looks the
same on every run.
