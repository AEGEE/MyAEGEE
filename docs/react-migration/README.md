# Vue 2 → React migration: research spike

What it takes to move `frontend/` (Vue 2.6, Buefy/Bulma) to React, a test suite that keeps the
behaviour the same while doing so, and the inventory for the WCAG 2.2 AA design system and
component library that comes next. The scope was agreed in the [charter](00-spike-charter.md).

## Findings in short

- **It's feasible route group by route group, without a big-bang rewrite.** A separate React app
  (`frontend-react/`) serves the migrated paths on the same origin, shares the Vue app's login
  session, route table and sidebar menu, and hands toasts over across the page load
  ([03](03-coexistence.md)). The proof of concept covers the events list, the event page and
  applying.
- **The same tests run against both apps.** A new mocked-API Playwright suite (38 behavioural
  specs for the events slice, a smoke test of all 113 routes, an axe baseline) passes on Vue and,
  for the migrated pages, on React. A real-stack test checks the flow against the services, and
  a contract test keeps the mocks honest ([04](04-test-strategy.md)). Running the real stack
  against React already caught a caching bug the mocks missed.
- **There's little to port besides the views.** Vuex only holds the session, and 230 API calls
  are made inline in 120 views. The work is in the views themselves, 28,000 lines, more than half
  of them in statutory and core ([01](01-current-state.md)). Sizes and phases are in
  [07](07-roadmap.md).
- **Stack**: Vite, React 19, TypeScript, React Router, TanStack Query, React Aria Components,
  CSS Modules with design tokens ([02](02-target-stack.md)).
- **Accessibility**: axe finds violations on all 113 Vue pages (1,713 elements, mostly
  contrast, unlabelled fields and missing names). The React pages have none. Four problems are on
  every page because they come from the shell, and they're cheap to fix in Vue now
  ([06](06-a11y-baseline.md)). The component library needs about 40 components, 27 of them for
  the first slice ([05](05-design-system-inventory.md)).

## Reports

| | |
|---|---|
| [00 · Charter](00-spike-charter.md) | Agreed scope and decisions |
| [01 · Current state](01-current-state.md) | Inventory of the Vue app: areas, sizes, API calls, cross-cutting behaviour, bugs found |
| [02 · Target stack](02-target-stack.md) | The recommended React stack and why (decision record) |
| [03 · Coexistence](03-coexistence.md) | How React and Vue run side by side, in e2e and in production |
| [04 · Test strategy](04-test-strategy.md) | The two Playwright suites, the mock layer, rules for specs, CI |
| [05 · Design system inventory](05-design-system-inventory.md) | Components in use, proposed library with a11y checklists, tokens and contrast, headless library and styling choice, widget plan |
| [06 · Accessibility baseline](06-a11y-baseline.md) | axe results for every page, Vue vs React |
| [07 · Roadmap](07-roadmap.md) | Phases, sizes per area, risks, open questions |

## Data and tools

Everything in `data/` is generated. Re-run from the repository root:

| Tool | Output |
|---|---|
| `node docs/react-migration/tools/inventory.mjs` | `data/inventory.json`: routes, views, API calls, sizes |
| `node docs/react-migration/tools/component-usage.mjs` | `data/component-usage.json`: Buefy, Bulma, local and third-party component usage |
| `node docs/react-migration/tools/contrast-audit.mjs` | `data/contrast-audit.json`: colour pairs in use and their WCAG contrast |
| `cd e2e && npx playwright test -c playwright.ui.config.ts --grep @a11y && node scripts/a11y-summary.ts` | `data/a11y-baseline.json`: axe results |

## Code from the spike

| Where | What |
|---|---|
| [`frontend-react/`](../../frontend-react) | The React app with the events proof of concept |
| [`e2e/playwright.ui.config.ts`](../../e2e/playwright.ui.config.ts), [`e2e/ui/`](../../e2e/ui) | The mocked-API suite: specs, mock layer, factories, smoke and axe runs |
| [`e2e/tests/events-apply.spec.ts`](../../e2e/tests/events-apply.spec.ts), [`e2e/tests/fixture-contract.spec.ts`](../../e2e/tests/fixture-contract.spec.ts) | Real-stack flow and mock contract checks |
| [`e2e/support/frontend-routing.ts`](../../e2e/support/frontend-routing.ts), [`frontend/src/migrated-routes.json`](../../frontend/src/migrated-routes.json) | Path routing between the apps |
| `frontend/src/app.js`, `frontend/src/methods/flash.js` | Vue's side of the coexistence (off unless built with `VUE_APP_REACT_ROUTES=true`) |
| `frontend/src/views/events/*.vue`, `components/layout/AppMain.vue` | Small accessibility fixes the tests needed |
| `.circleci/config.yml` | `frontend-mocked-test`, `frontend-react-check`, and the React run in `e2e-test` |
