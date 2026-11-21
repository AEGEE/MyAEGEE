# Research spike: Vue 2 → React migration — charter

Agreed in the kick-off interview on 2026-11-21. This fixes what the spike delivers and what it
leaves out, so the result can be checked against it.

## Goal

Find out what moving `frontend/` (Vue 2.6, Buefy/Bulma, Vuex 3, vue-router 3, Vue CLI) to React
involves, and set up the things that make the move safe:

1. a Playwright safety net that doesn't care which framework renders the page;
2. a working way for React and Vue to run side by side, so routes can move one at a time;
3. an inventory to start the WCAG AA design system and component library from.

React is already decided; the spike doesn't revisit it (no Vue 3 comparison).

## Decisions

| Topic | Decision |
|---|---|
| Test harness | **Both, split by concern.** A new mocked-API Playwright suite for UI behaviour that runs against both the Vue and the React build. The existing real-stack `e2e/` suite gets tests for the critical cross-service flows only, which keeps its README scope rule. |
| Mock data | **Typed TypeScript fixture factories** per entity/endpoint with per-test overrides, plus a few real-stack contract tests that check the factory shapes still match live responses. |
| Coverage in the spike | **Every route gets a smoke test** (renders, key heading/actions present, no console errors), and the **events browse + apply** slice gets deep behavioural tests. The report lists and sizes what's left. |
| Selectors | **Role/label locators first** (`getByRole`, `getByLabel`). Small a11y fixes in Vue to add missing accessible names are fine, kept in separate commits so they can become their own PR. |
| Proof-of-concept slice | **Events browse + apply**: event list and filters, event detail, application form (dynamic questions). |
| PoC auth | **Share the Vue session.** React reads the token/refresh state Vue's login stores on the same origin. No React login page. |
| Coexistence | **Separate app, routed by path**: `frontend-react/` (Vite + React + TS) on the same origin, with the gateway sending migrated paths to it. The report also covers the "React islands inside Vue" option. |
| Target stack | **The spike recommends one**: router, server state (vs porting Vuex), forms, styling. |
| a11y (axe) | **Report only, for both** Vue and React. Measure WCAG 2.2 AA violations; enforce nothing yet. |
| CI | **Yes**: a CircleCI job for the mocked suite plus the React app's build/lint/typecheck. axe results are stored as an artifact. Real-stack additions run in the existing e2e job. |
| Estimates | **T-shirt sizes per route group** (S/M/L/XL with what drives each size), grouped into a phased roadmap. No dates. |
| Delivery | Docs in `docs/react-migration/`, code in its usual places, on this branch, as a **draft PR** from `wikirik-agent` against `stable`. |

## Deliverables

### Docs (`docs/react-migration/`)

- `00-spike-charter.md`: this file.
- `01-current-state.md`: inventory of routes, views, store, API calls, third-party libraries and their coupling.
- `02-target-stack.md`: the recommended React stack, with reasons (ADR style).
- `03-coexistence.md`: how the strangler setup works (gateway routing, shared session, layout shell, navigation between apps); separate app vs islands.
- `04-test-strategy.md`: the two suites, fixtures, contract checks, selector rules, how to add tests.
- `05-design-system-inventory.md`: components in use with counts, variants and views; the proposed component list with an a11y checklist per component; tokens and contrast audit; headless library comparison (React Aria Components / Radix / Base UI) and the styling decision; plan for third-party widgets (FullCalendar, Mapbox, Chart.js, flatpickr, vue-multiselect, tag input).
- `06-a11y-baseline.md`: summary of the axe results per route, Vue vs React PoC.
- `07-roadmap.md`: phases, sizes per route group, risks, open questions.

### Code

- Inventory scripts that scan the Vue source and write the data the docs use.
- A mocked-API Playwright suite (layout to be settled during the spike, likely a second config in `e2e/` sharing `support/`) with fixture factories and a `TARGET=vue|react` switch.
- Real-stack e2e tests for the critical flows, plus fixture contract checks.
- `frontend-react/`: a Vite + React + TS app implementing the events browse + apply PoC, sharing the Vue session.
- Gateway routing for coexistence (the e2e gateway, plus a sketch for the production gateway config).
- axe baseline runner and report output.
- A CircleCI job.
- Small a11y fixes to the Vue code where tests needed them (separate commits).

## Out of scope

- Migrating anything beyond the events browse + apply PoC.
- Building the design system or component library itself (the spike produces only the inventory and recommendations).
- Comparing against a Vue 3 upgrade.
- Making axe violations fail CI.
- Production deployment changes beyond a documented sketch.
