# 01 · The Vue frontend today

What `frontend/` consists of, and what that means for a move to React. The numbers come from
[`tools/inventory.mjs`](tools/inventory.mjs), which writes [`data/inventory.json`](data/inventory.json)
(per route: view, size, API calls including those of child components, third-party libraries,
complexity signals). Re-run it with `node docs/react-migration/tools/inventory.mjs` from the
repository root.

## Summary

- **A large, flat app.** 113 routes, 120 view files with 28,000 lines in total, and only 15 shared
  components. Most views talk to the APIs, Buefy and Bulma directly, so there's little to reuse
  and a lot to rewrite. The upside: views hardly depend on each other, so they can move one by one.
- **Almost no app state.** Vuex holds the logged-in user, their permissions, the service URLs and
  the sidebar/navbar state. 61 views read `services` and 60 read `user`. No view dispatches an
  action or writes to the store. Everything else is local `data()` filled by `axios` calls in
  `mounted()`. **There's no Vuex to port**: in React this is a session context plus TanStack
  Query for server data.
- **230 distinct API calls** (87 to core, 64 statutory, 23 summeruniversity, 22 events, 15
  network, 12 discounts, 7 to computed URLs). They're all made inline in the views: there's no API
  layer and there are no types. Every call has to be found and typed during the port. The
  inventory lists them per route.
- **A consistent page lifecycle** that ports mechanically: fetch in `mounted()`, `isLoading`
  flags, `this.$root.showError(...)` toasts, `this.$router.push(...)` after saving.
- **Four large areas carry most of the risk**: statutory (XL), core (XL), summeruniversity (L)
  and events (L) together hold 84 % of the lines and every heavy third-party widget.
- **Accessibility is behind by default**, not by accident: see the [design system
  inventory](05-design-system-inventory.md) and the measured [a11y baseline](06-a11y-baseline.md).

## Technology

| Concern | Today | Notes for the port |
|---|---|---|
| Framework | Vue 2.6 (`vue-template-compiler` 2.7), Options API | Vue 2 has been end-of-life since 31 Dec 2023 |
| Build | Vue CLI 5 (webpack 5), Babel | Vite on the React side |
| Routing | vue-router 3, routes defined as data in `src/router/routes.js` with `meta.label` (page title) and `meta.auth` | The React app reads the same table at build time ([03](03-coexistence.md)) |
| State | Vuex 3: `login` (user, permissions, validation), `services`, `app` (sidebar/device), `menu` | Session context + TanStack Query |
| HTTP | axios with a global `X-Auth-Token` interceptor and token renewal on 401 (`app.js`) | `fetch` wrapper with the same renewal (`frontend-react/src/lib/api.ts`) |
| UI | Buefy 0.9 (16 component types, 493 uses) + raw Bulma 0.9 classes (2,329 uses) | Replaced by the new component library ([05](05-design-system-inventory.md)) |
| Icons | Font Awesome 5 via `vue-fontawesome` | Needs a React equivalent; icon-only buttons need names |
| Dates | moment (24 files) | `Intl` / `@internationalized/date` |
| Markdown | marked + DOMPurify (`filters/index.js`, `methods/sanitize-html.js`) | Ported as is (`lib/markdown.ts`) |
| Widgets | FullCalendar 6, mapbox-gl 0.53 (`vue-mapbox`), Chart.js 2 (`vue-chartjs`), flatpickr, vue-multiselect, vue-input-tag | See the widget plan in [05](05-design-system-inventory.md#third-party-widget-plan) |
| Tests | None in `frontend/`. The e2e suite (`e2e/`) had 5 spec files; 4 of them drive the browser | Now the mocked-API suite plus real-stack tests ([04](04-test-strategy.md)) |
| Lint | ESLint 8, airbnb, `eslint-plugin-vuejs-accessibility` | ESLint 9 flat config with `jsx-a11y` strict |

## Areas

Per `views/` directory, sorted by the size score (see [07-roadmap.md](07-roadmap.md#how-the-sizes-were-made)).

| Area | Routes | Views | Lines | API calls | Form fields | Tables | `v-html` | Buefy dialogs/modals/toasts | Third-party | Size |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|:-:|
| statutory | 31 | 35 | 8,535 | 71 | 132 | 161 | 27 | 18 | Chart.js, Mapbox, flatpickr, input-tag, multiselect, moment | **XL** |
| core (members, bodies, circles, campaigns, permissions) | 35 | 37 | 7,181 | 80 | 109 | 89 | 10 | 34 | flatpickr, multiselect, lodash, moment | **XL** |
| summeruniversity | 11 | 11 | 4,780 | 28 | 105 | 49 | 3 | 10 | Mapbox, flatpickr, moment | **L** |
| events | 12 | 11 | 3,181 | 26 | 45 | 36 | 4 | 5 | Mapbox, flatpickr, input-tag, moment | **L** |
| network | 2 | 6 | 1,435 | 19 | 36 | 24 | 2 | 4 | multiselect, moment | **M** |
| discounts | 9 | 7 | 794 | 13 | 15 | 17 | 5 | 1 | none | **M** |
| dashboard (+ calendar) | 2 | 2 | 430 | 8 | 0 | 0 | 0 | 2 | FullCalendar, ical, moment | **S** |
| auth (login, signup, password reset…) | 6 | 6 | 770 | 6 (+ `$auth`) | 17 | 0 | 1 | 0 | lodash, moment | **M** (borderline S) |
| static (about, status, bug report, Confluence pages) | 5 | 5 | 898 | 2 | 5 | 4 | 2 | 0 | DOMPurify | **S** |

The largest single pages (lines, including the components they import):

| Route | Lines | File |
|---|---:|---|
| `oms.network.ac_check` | 1,228 | `views/network/AntennaCriteriaCheck.vue` |
| `oms.summeruniversity.edit` / `.create` | 1,215 | `views/summeruniversity/Edit.vue` |
| `oms.bodies.view` | 1,145 | `views/core/bodies/Single.vue` |
| `oms.events.edit` / `.create` | 1,031 | `views/events/Edit.vue` |
| `oms.summeruniversity.view` | 878 | `views/summeruniversity/Single.vue` |
| `oms.statutory.edit` / `.create` | 860 | `views/statutory/Edit.vue` |
| `oms.members.view` | 848 | `views/core/members/Single.vue` |

These are the long forms (event and SU editors with dynamic question builders, organisers, dates
and locations) and the data-heavy detail pages. Each is a project in its own right.

## Cross-cutting behaviour the React app has to reproduce

These live outside the views, so they're easy to miss. The React proof of concept implements
each one, and the mocked-API suite tests most of them on both apps.

| Behaviour | Where in Vue | In React | Tested by |
|---|---|---|---|
| Tokens in `localStorage` (`access-token`, `refresh-token`), sent as `X-Auth-Token` | `app.js` interceptors, `auth.js` | `lib/api.ts` | `ui/events/session.spec.ts`, `src/lib/api.test.ts` |
| On 401: one shared `POST /renew`, retry; on failure clear the tokens and go to `/login?to=…` | `app.js` | `lib/api.ts` | same |
| Route guard: members-only pages need a session; invalid profiles go to `/profile/update` (`validate-user.js`) | `app.js` `beforeEach` | `App.tsx` `<Page>`, `lib/session.tsx` | session spec |
| Page title `MyAEGEE \| <meta.label>` | `app.js` `beforeEach` | `App.tsx` | all specs, smoke |
| Sidebar menu filtered by login state and permissions (`menu.json`) | `components/layout/Sidebar.vue` | `components/AppShell.tsx` | session spec |
| Toasts (`$root.showSuccess/showError/...`), messages escaped, `"<msg>: <server message>"` on errors | `methods/index.js` | `lib/toast.tsx`, `errorMessage()` | many specs |
| Markdown rendering with sanitising | `filters/index.js`, `methods/sanitize-html.js` | `lib/markdown.ts` | `tests/frontend-html-injection.spec.ts` |
| Only http(s) links from user input are clickable | `methods/safe-url.js` | `lib/safe-url.ts` | event page spec, injection test |
| Dates as `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` in the local time zone | `filters/index.js` (moment) | `lib/format.ts` | event page spec |
| Query strings with `type[]=a&type[]=b` (qs, brackets) | `app.js` | `lib/api.ts` | list spec |

## Bugs and quirks found while writing the tests

Writing specs that pin down today's behaviour turned these up. They're documented in the specs
rather than "fixed" in Vue, so the React port can decide.

| Finding | Where | What the specs do |
|---|---|---|
| When an event isn't found, `Apply.vue` redirects to the route name `oms.events.list`, which doesn't exist. The browser ends up on `/` | `views/events/Apply.vue` | `ui/events/apply.spec.ts` expects the intended `/events`; marked as a known failure for Vue (`UI_SHOW_KNOWN_BUGS=1` shows it) |
| For visitors who aren't logged in, public pages keep the default title (the router's `catch()` path skips setting it) | `app.js` | the smoke test accepts any `MyAEGEE \| …` title for anonymous visits; React sets the right one |
| If `POST /renew` itself answered 401, the interceptor would wait on its own renewal and hang. core answers 403, so it doesn't happen today | `app.js` | React's renewal bypasses the retry logic |
| Many views' `catch()` read `err.response.status`. When the error is a plain JS error (a crash inside `then()`), that throws again and the page stays half-loaded | e.g. `views/statutory/Stats.vue`, `views/events/Edit.vue` | the smoke test has 3 statutory pages marked as needing realistic data |
| The e2e gateway answered `/api/events?limit=…` (the events list call, no slash before `?`) with the frontend's `index.html` | `e2e/support/gateway.ts` | fixed in this branch |
| The Buefy confirmation dialogs had no `role`, no accessible name, and render their message as HTML | `views/events/Single.vue` and others | fixed for the events views (`ariaRole: 'alertdialog'`) |

## Small Vue changes made in this spike

To let role- and label-based tests find things (and as genuine accessibility fixes), the spike
changed the events views and the layout slightly, in separate commits:

- labelled the events search box, the application's body select and every question field (`for`/`id`);
- turned click-only `<a class="button">` elements in the events views into `<button type="button">`;
- marked the event and application titles as headings (`role="heading" aria-level="1"`, which
  keeps the Bulma styling) and the event cards as `<article>`s named by their title;
- gave the delete/status confirmations `role="alertdialog"` and `aria-modal`;
- made the page content a `<main>` landmark (`components/layout/AppMain.vue`).

The coexistence change (`VUE_APP_REACT_ROUTES`, the toast hand-over) is described in
[03-coexistence.md](03-coexistence.md). It's off unless the app is built with that variable.
