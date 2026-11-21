# 04 · Test strategy: keeping behaviour the same

The migration's safety net is a set of Playwright specs that describe what a **user** sees and
does, written so they pass against the Vue app today and against the React app once a page
moves. A page moves when its specs pass on React.

## Two suites, split by concern

| | Mocked-API suite | Real-stack suite |
|---|---|---|
| Config | `e2e/playwright.ui.config.ts`, specs in `e2e/ui/` | `e2e/playwright.config.ts`, specs in `e2e/tests/` |
| Backend | none: every `/api` call is answered inside the browser (`page.route`) by the test | core, events, summeruniversity and Postgres, started by Playwright |
| Speed | parallel; both projects (194 tests) in about 2.5 min on a 3-worker laptop | serial; 23 tests in about 30 s, plus the stack start-up |
| What it's for | UI behaviour of each page: rendering, filters, forms, permissions-based UI, error states, toasts, session handling | flows that cross services; proving the frontend works with the real APIs; contract checks of the mocks |
| Frontends | project `vue` (production-like Vue build); project `react` (React for migrated paths, Vue for the rest) | `E2E_FRONTEND=react` switches the gateway the same way |
| Run | `npm run setup:frontend` then `npm run test:mocked` | `npm run setup` then `npm test` |

The real-stack README rule still holds ("keep e2e tests for what module tests can't cover").
Frontend behaviour goes to the mocked suite, which works as the frontend's module tests.

## What exists after the spike

| Spec | Tests | Runs on | Covers |
|---|---:|---|---|
| `ui/events/list.spec.ts` | 9 | vue, react | cards and their facts, search, type filter, past events, empty state, paging, permission-based "Create event", "my events", error toast |
| `ui/events/detail.spec.ts` | 12 | vue, react | facts table, dates in the local time zone, markdown, safe external links, online/free/vegetarian variants, draft/unpublished notices, organiser actions per permission, delete with confirmation, status change incl. the budget/programme check, 404, anonymous access |
| `ui/events/apply.spec.ts` | 12 | vue, react | the form built from the questions (5 types), defaults, body choice with primary body first, POST payload, native required checks, server 422 errors, editing (PUT), coming back after saving, read-only view per status, closed/no-applications/ban states, unknown event (known Vue bug) |
| `ui/events/session.spec.ts` | 5 | vue, react | token renewal and retry, failed renewal → login with `?to=`, navbar user menu and logout, sidebar, anonymous access |
| `ui/events/coexistence.spec.ts` | 3 | react | Vue → React and React → Vue navigation, session across apps, toast hand-over |
| `ui/smoke/routes.spec.ts` | 113 | vue (all), react (5 migrated) | every route loads with generic data: right title, no uncaught errors, no error toasts. 3 statutory pages are marked `fixme` (need realistic data) |
| `ui/a11y/baseline.spec.ts` | 113 | vue (all), react (5 migrated) | axe WCAG 2.2 A/AA scan per page, report only ([06](06-a11y-baseline.md)) |
| `tests/events-apply.spec.ts` | 2 | real stack, both frontends | find → apply → edit against the real services; server-side validation shown |
| `tests/fixture-contract.spec.ts` | 3 | real stack | the mock factories' fields exist in the real core/events responses with the same types |
| `frontend-react/src/**/*.test.ts(x)` | 23 | Vitest | the API client's renewal logic; React routes vs `migrated-routes.json` |

Results at the end of the spike: mocked suite **148 passed + 3 fixme** on `vue` and
**46 passed** on `react` (behaviour, coexistence and smoke; the 3 coexistence specs skip on
`vue`). Real stack **23/23** on each frontend. Unit **23/23**. The axe run covers 113 pages on
`vue` and 5 on `react`.

## Rules for writing specs that survive the swap

1. **Find things the way a user does.** `getByRole` with an accessible name, `getByLabel`,
   `getByText`. No CSS classes, no component internals, no `__vue__`. If a role-based locator
   can't find something, that's an accessibility bug: fix the markup (the spike did, in small
   separate commits), don't reach for a class.
2. **Assert outcomes, not implementation.** The request the page sent (`api.callsTo(...)`,
   method, params, body), what's on screen, the URL, the toast text. Both apps must send the
   same requests, which keeps the backend contract stable too.
3. **One mocked endpoint per thing the test cares about.** Strict mode (the default) fails a
   test when the page calls an endpoint nobody mocked, so new calls are noticed.
4. **Toasts** are found with the `toast(page, text)` helper. Buefy gives every toast
   `role="alert"`, and React uses `role="status"` for non-urgent ones; the helper accepts both.
5. **Deliberate differences are explicit.** When Vue has a bug the React app shouldn't copy,
   the spec asserts the intended behaviour and marks Vue with
   `test.fail(frontend === 'vue' && !process.env.UI_SHOW_KNOWN_BUGS, '<reason>')`. When React
   doesn't do something yet, use `test.fixme(frontend === 'react', '<reason>')`. Both show up in
   the report and can be listed.
6. **Dates and time zones**: the config fixes `timezoneId: 'Europe/Brussels'` and `locale:
   'en-GB'`. Use fixed ISO dates when asserting rendered dates, and relative dates
   (`iso(+10)`) when only "open/closed" matters.

## The mock layer

- `ui/support/api-mock.ts`: `ApiMock` routes `/api/<service>/<path>` to handlers written like
  `'GET events /single/:id'` (last registration wins), records every call, and answers
  unmocked calls with 501.
- `ui/support/factories.ts`: typed builders (`member`, `body`, `permission`, `event`,
  `eventSummary`, `eventPermissions`, `organizerPermissions`, `application`, `question`,
  envelopes). Realistic defaults, overrides per test.
- `ui/support/test.ts`: fixtures. `session` (`member` | `superadmin` | `anonymous`), `me`,
  `myPermissions` (mutable, read at request time), `api`, `strictApi`, an automatic check for
  uncaught page errors, `frontend` (`vue` | `react`).
- `ui/support/smoke-data.ts`: generic answers for every endpoint, for the smoke and a11y runs.
- **Drift protection**: `tests/fixture-contract.spec.ts` builds each factory object and checks
  every field exists with the same type in what the real services return (extra real fields
  are fine). When a service changes a response shape, this fails before the mocks lie.

## How the safety net grows during the migration

For each route group, before porting it:

1. **Write its mocked specs against Vue first** (they must pass on `vue`), tagged `@migrated`
   only once the React version exists. Start from the inventory (`data/inventory.json` lists
   each route's API calls) and the Vue template: every `v-if` on permissions or status is a
   case to cover.
2. **Add factories** for its entities, plus a contract check for each.
3. **Add one real-stack test** for the group's main cross-service flow, if it has one (e.g.
   statutory applications and core memberships).
4. Port, make the specs pass on `react`, switch the gateway.

The smoke test gives every route a minimum check from day one. The goal is behavioural specs
for every route before it moves, not for all routes up front: the roadmap budgets them per
area ([07](07-roadmap.md)).

### Estimated spec effort per area

Rough counts, based on the events slice (12 routes → 38 specs, about 1 spec per 85 lines of view
code):

| Area | View lines | Expected specs | Notes |
|---|---:|---:|---|
| statutory | 8,535 | ~100 | many forms; candidates, positions, question lines, memberslists, stats (needs chart a11y) |
| core | 7,181 | ~85 | members, bodies, circles, campaigns, permissions, join requests; heavy on tables and permissions |
| summeruniversity | 4,780 | ~55 | like events plus courses/cooperation and a two-step editor |
| events (rest) | ~2,000 | ~25 | editor, participants, board view, service admin |
| network | 1,435 | ~15 | |
| discounts | 794 | ~10 | |
| dashboard, auth, static | 2,098 | ~25 | auth needs real-stack tests (login, signup, password reset mails) |

## CI

`.circleci/config.yml`:

- **`frontend-mocked-test`**: builds both Vue variants and the React app, runs the mocked suite
  on both projects, then records the axe baseline (report only) and stores `a11y-results/` with
  a Markdown summary as artifacts.
- **`frontend-react-check`**: lint (ESLint with `jsx-a11y`), type check, Vitest, build.
- **`e2e-test`**: unchanged, plus a second run with `E2E_FRONTEND=react`.
