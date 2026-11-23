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
        // 1. What the API answers. Anything the page asks for that isn't answered fails the test.
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
- Files a spec uploads go in `e2e/ui/fixtures/<area>/`.

## Fixtures

Import `test` and `expect` from `ui/support/test.ts`.

| Fixture | What |
|---|---|
| `session` (option) | Who is logged in: `'member'` (default), `'board'`, `'superadmin'` or `'anonymous'`. `test.use({ session: 'board' })` |
| `me` | The logged-in member, or `null`. `member` is Alex Member (id 2), `board` is Bea Board (id 3, in the board circle of body 1), `superadmin` is Ada Admin (id 1). Change it before `page.goto()` for another profile: `me!.privacy_consent = null` |
| `myPermissions` | What `GET core /my_permissions` answers: the global permissions of the session's circles in core's seed (every permission for a superadmin). Change the array before `page.goto()` |
| `tokens` (option) | Which tokens the browser starts with: `'both'` (default), `'access'`, `'refresh'`, `'none'` |
| `api` | The API mock, see below. `GET core /members/me`, `GET core /my_permissions` and `POST core /logout` are answered already |
| `strictApi` (option) | `true`: a request nobody answered fails the test. Only the generated smoke and axe tests turn it off |
| `layout` | `'desktop'` or `'phone'`. Pass it to the helpers that need it; don't branch on it in a spec |
| `frontend` | Which app the project runs: `'vue'` |
| `allowedConsoleErrors` (option) | `console.error` messages the test expects, as regular expressions |

Two checks run in every test without being asked for:

- An uncaught error in the page fails the test.
- `console.error` in the page is recorded. Vue reports errors in render functions, watchers and
  hooks this way. In an area whose coverage gate is enforced they fail the test; before that
  they are noted on the test in the report. The browser's own "Failed to load resource" lines
  for mocked error answers don't count.

## Answering the API

Handlers are written like routes, without the `/api` prefix: `'METHOD service /path/:param'`.
The last handler that matches wins, so a test can override a default.

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
4. It has a contract check in `e2e/tests/<area>-contract.spec.ts`, added in the same pull
   request: `expectShape('<factory name>', factory(), realAnswer)`. `npm run lint` fails for a
   factory without one. Helpers that build no entity are listed in the file's `NOT_ENTITIES`.
5. An entity belongs in the file of the area that owns it. Another area builds on that factory
   with overrides instead of adding its own version.
6. A large area may split its factories into `factories/<area>-<part>.ts`.

## Dates and time

The suite runs in the time zone `Europe/Brussels` with the locale `en-GB`.

- A spec that depends on "now" (deadlines, bans, default dates, download names) calls
  `await freezeTime(page)` before `page.goto()`. That sets the clock to `FIXED_NOW`
  (2027-03-01 10:00 in Brussels, a Monday in winter time) and lets it run on from there, so
  toasts and timers work. Build its dates with `iso(n, Date.parse(FIXED_NOW))`.
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
| A dialog or modal opened from code | Its role is set for all of them (`frontend/src/app.js`). The call only adds a name: `title` for `dialog.confirm`/`prompt`, `ariaLabel` for `modal.open`, `inputAttrs: { 'aria-label': ... }` for a prompt's input |
| A paginated table | `aria-next-label="Next page"`, `aria-previous-label="Previous page"`, `aria-page-label="Page"`, `aria-current-label="Current page"` on the `b-table`; specs use `getByRole('button', { name: 'Next page' })` |
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
| `toast(page, text)` | The toast after an action. Toasts are gone after three seconds: check them right away |
| `dialog(page)` | The open confirmation, prompt or modal; narrow down with `.filter({ hasText })` |
| `openMenu(page, layout)` | The sidebar menu, opened first on a phone. Returns it |
| `openAccountMenu(page, layout)` | The top bar's account menu ("See my account", "Logout", or "Login" for a visitor), opened first. Returns it |
| `tableRows(table)` | The rows of a table that hold data |
| `cellOf(table, row, column)` | The cell of a row in the column with this header (`await` it) |
| `sortBy(table, column, layout, direction?)` | Sorts a table that isn't sorted by that column yet |
| `permissionsFor(api, kind, id, combined)` | Answers the permissions for one body, member or circle |
| `freezeTime(page, iso?)` | Sets "now" |
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

## No skipped tests, no expected failures

`test.skip`, `test.fixme`, `test.fail` and `test.only` (and their `describe` forms) are lint
errors in `e2e/ui/`. A reporter also fails the run when a test was skipped or expected to fail,
which catches a skip inside a condition or a loop.

When a spec finds a bug, the bug is fixed in the same pull request, in a commit of its own, and
the spec checks the fixed behaviour.

## The generated tests

Two files make one test per route of `frontend/src/router/routes.js`, with generic answers from
`e2e/ui/support/smoke/`:

- `ui/smoke/routes.spec.ts`: every page loads on both viewports, gets its title, throws nothing
  and shows no error toast.
- `ui/a11y/pages.spec.ts`: the axe run, see [accessibility.md](accessibility.md).

A new route is picked up by itself. If its page needs more than empty lists to load, add answers
to `smoke(api)` in its area's file. That file also has `params` (values for the route's path
parameters; the default is `1`), `redirects` (pages that send the viewer on) and
`expectedAlerts` (error toasts that are the right result of having no data). A key that is no
route of the area fails every generated test with a message that says which.
