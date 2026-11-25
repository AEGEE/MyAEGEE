# Testing MyAEGEE

Three kinds of tests, each for what the others can't do well.

| Suite | Where | What it is for | Needs |
|---|---|---|---|
| Service tests (jest) | `<service>/test/` | Everything one service decides on its own: every route with its success, unauthenticated, forbidden, validation and not-found cases, the mails it sends, its models. The other services are mocked. | Postgres |
| Mocked-API suite (Playwright) | `e2e/ui/`, config `e2e/playwright.ui.config.ts` | How the frontend behaves: every page, every state that depends on permissions or data, every request it sends. The browser runs the built frontend; the test answers each API call. Runs on a desktop and on a phone viewport. | Only the frontend build |
| Real-stack suite (Playwright) | `e2e/tests/`, config `e2e/playwright.config.ts` | What only the whole stack shows: behaviour that crosses services, the frontend against the real APIs, and the check that the mocked suite's factories still match what the services answer. | Postgres, six services, a gateway and a fake mailer, all started by Playwright |

The mailer (Elixir) and the dispatcher (Python) have their own tests in their folders.

## Where does my test go?

1. Is it about what one service answers or stores (a permission check, a validation rule, a mail)?
   A jest test in that service.
2. Is it about what a page shows or sends: a button that is only there for some members, a form,
   an error message, a table? A spec in the mocked-API suite: [writing-ui-specs.md](writing-ui-specs.md).
3. Does it only fail when two services, or the frontend and a real service, disagree? A real-stack
   test (`e2e/README.md`). Keep these few: they are slow and need everything running.
4. Did you add or change a factory in `e2e/ui/support/factories/`? It needs a contract check in
   `e2e/tests/<area>-contract.spec.ts` (or `<area>-<part>-contract.spec.ts`), so the mocked answers can't drift away from the real ones.
   Every field has to be compared with a value on both sides: a field that was null or an empty
   list in every comparison of a test fails it, unless it is listed in `gaps` with the reason.

The frontend has no unit or component tests on purpose. The Playwright specs only rely on what a
user sees (roles, labels, text), so they keep their value when a page is rewritten.

## Areas

The frontend suites are organised by area: one per directory of `frontend/src/views/`, plus
`shell` for everything else in `frontend/src/` (layout, shared components, methods, store, router).

| Area | Pages |
|---|---|
| `auth` | login, registration, password and mail confirmation |
| `core` | members, bodies, circles, permissions, campaigns |
| `dashboard` | dashboard, calendar |
| `discounts` | discounts and their integrations |
| `events` | events |
| `network` | boards, antenna criteria |
| `resources` | managing the resources page |
| `static` | about, status, bug report, resources, wiki pages |
| `statutory` | Agorae and EPMs |
| `summeruniversity` | Summer Universities |
| `shell` | navbar, sidebar, session, shared components |

Each area has its own files, so changes in one area don't touch a shared list:

| What | File |
|---|---|
| Specs | `e2e/ui/<area>/<view>.spec.ts` |
| Factories | `e2e/ui/support/factories/<area>.ts` |
| Answers for the smoke and axe runs | `e2e/ui/support/smoke/<area>.ts` |
| Axe baseline | `e2e/ui/support/a11y/<area>.json` |
| Coverage gate | `e2e/ui/support/coverage/<area>.json` |
| Real-stack flows and contract checks | `e2e/tests/<area>-<flow>.spec.ts`, `e2e/tests/<area>-contract.spec.ts` (or `<area>-<part>-contract.spec.ts`) |
| Real-stack data helpers | `e2e/support/<area>-data.ts` |
| Files that specs upload | `e2e/ui/fixtures/<area>/` |

`e2e/ui/harness/` is not an area: its specs check the suite's own helpers against real pages,
and that its safety nets still catch what they are for (a forgotten mock, an unused handler, a
flaky or skipped test).

## More

- [writing-ui-specs.md](writing-ui-specs.md): how to write a spec for the mocked-API suite.
- [coverage.md](coverage.md): what is measured, the gate per area, ignore comments.
- [accessibility.md](accessibility.md): the axe run and its baseline.
- [running.md](running.md): setup, running next to other checkouts, debugging, CI.
- [area-definition-of-done.md](area-definition-of-done.md): the checklist for a pull request
  that finishes an area.
- `e2e/README.md`: how the real stack runs, its data and helpers.
- [backend-openapi.md](backend-openapi.md): the services' OpenAPI files, the response checks
  in their jest tests and their coverage ratchet.
