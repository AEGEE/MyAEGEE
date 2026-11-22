# 02 · Target stack (decision record)

**Status:** recommended by the spike, to be confirmed by the team.
**Proven in:** [`frontend-react/`](../../frontend-react), the proof of concept (events list, event
page, applying), which passes the same 38 behavioural Playwright specs as the Vue app.

## Context

- The Vue app is a client-side single page app served as static files by nginx behind traefik,
  talking to the services through `/api/<service>`. There's no server rendering and nothing
  needs it: almost every page is behind a login and no page needs to be indexed.
- App state is tiny (see [01](01-current-state.md#summary)): the session plus server data.
- The migration is gradual, route by route, next to the Vue app ([03](03-coexistence.md)).
  The stack has to work as a second static app on the same origin.
- The new component library has to meet WCAG 2.2 AA ([05](05-design-system-inventory.md)).
- The volunteers who maintain MyAEGEE change often, so mainstream, well-documented choices are
  worth more than the last bit of elegance.

## Decision

| Concern | Choice | Version in the PoC |
|---|---|---|
| Language | TypeScript, `strict` | 6.0 |
| Build / dev server | Vite | 8.3 |
| UI | React | 19.3 |
| Routing | React Router, data router in library mode (`createBrowserRouter`), no framework mode | 8.5 |
| Server data | TanStack Query | 5.107 |
| App state | React context for the session; nothing else needed yet (Zustand if that changes) | — |
| HTTP | a small `fetch` wrapper (`src/lib/api.ts`), no axios | — |
| Accessible primitives | React Aria Components (dialogs now; the base of the component library) | 1.22 |
| Styling | CSS Modules + CSS custom properties (design tokens) | — |
| Forms | plain controlled components in the PoC; **React Hook Form + a schema library (Zod)** for the big editors, to be confirmed when porting `events/Edit.vue` | — |
| Dates | `Intl` and plain `Date` for display; `@internationalized/date` with the React Aria date pickers | — |
| Markdown | marked + DOMPurify, same configuration as Vue | 18 / 3.4 |
| Unit/component tests | Vitest (+ Testing Library when components arrive) | 5.1 |
| Behaviour tests | Playwright: the mocked-API suite and the real-stack suite ([04](04-test-strategy.md)) | 1.64 |
| Lint | ESLint 9 flat config: `typescript-eslint`, `react-hooks`, `jsx-a11y` (strict) | 9.39 |

## Reasons, and the alternatives

### React Router (library mode) rather than TanStack Router or a framework

- It's the most widely known React router. The PoC needed nothing unusual from it: nested
  layout, params, `matchRoutes` for the "is this ours?" check.
- The Vue routes are data (`routes.js`), and the React app reads that table at build time for
  titles and auth flags. React Router's route objects fit that naturally.
- **TanStack Router** is the strong alternative: fully typed paths and search parameters would
  help the many list pages with filters. It's the better pick if the team values type-safe
  links over familiarity. Switching later is moderate work, because pages only use
  `useParams`/`useNavigate`/`<Link>` through a few helpers (`lib/links.tsx`, `lib/routes.ts`).
- **Framework mode / Next.js / Remix**: no. They bring server rendering, a server runtime and a
  different deployment, which this app doesn't need. They'd also make running next to the Vue
  app harder.

### TanStack Query, and no global store

Every Vue view fetches in `mounted()` and keeps its own `isLoading` flags. TanStack Query
replaces that pattern one-to-one, and adds caching, request cancellation (the list search
cancels the previous request, like Vue's axios `CancelToken`), retries and invalidation after
mutations. Vuex has nothing to port (no view writes to the store). The session (user plus
permissions) is a query exposed through context (`lib/session.tsx`).

*Lesson from the PoC:* caching needs care. The real-stack test caught the application form
starting empty after a save: it showed the cached "no application yet" result. The fix was
`invalidateQueries` after the mutation, plus keying the form on the application. The pattern
to follow is **invalidate what a mutation changes, and key forms on the record they edit**.

### React Aria Components as the accessibility foundation

Chosen in the [design system inventory](05-design-system-inventory.md#headless-foundation-evaluation):
it's the only headless library that covers date pickers, combobox, tag group, table and file
upload with WAI-ARIA keyboard behaviour, and it's backed by Adobe. The PoC uses its
`Modal`/`Dialog` for the confirmation dialog (focus trap, Escape, focus return, `alertdialog`).

The PoC deliberately uses **native `<select>`, checkboxes and inputs** for the application form:
they're the most accessible option for simple choices. React Aria's `Select` (a button plus a
listbox) is for cases that need more than a native select can do.

### CSS Modules + tokens rather than Tailwind or keeping Bulma

Also argued in [05](05-design-system-inventory.md#styling-approach). In practice in the PoC:
`src/styles/tokens.css` holds the AA-checked tokens, there's a small global sheet for base
elements and form controls, and CSS Modules hold component styles. Total CSS is 3 KB gzipped
(Vue: 55 KB). Bulma isn't carried over: its colour logic is the root of most contrast failures.

### `fetch` rather than axios

A 150-line wrapper does what the Vue axios setup does (token header, shared renewal on 401,
redirect to login) and fixes the renewal deadlock risk ([01](01-current-state.md#bugs-and-quirks-found-while-writing-the-tests)).
It's covered by unit tests (`src/lib/api.test.ts`).

### Types for the APIs

There are no OpenAPI specs for the services. The PoC types what it uses by hand
(`src/lib/types.ts`). The Playwright factories have their own types, and
`e2e/tests/fixture-contract.spec.ts` checks those against the real services. Recommendation:
keep hand-written types per area while porting, and generate them later if the services get
OpenAPI specs (see the [roadmap](07-roadmap.md#open-questions)).

## Measurements from the PoC

| | Vue app (today) | React PoC |
|---|---|---|
| JS loaded for the events list | 251 KB gzipped (vendors 227 + app 24, plus the route chunk) | 171 KB gzipped (all three pages, not yet split) |
| CSS | 55 KB gzipped | 3 KB gzipped |
| axe WCAG 2.2 AA violations on the 5 events pages | 4 rules each, 9–19 elements per page | 0 |
| Behavioural specs passing | 38 (one was a known bug, since fixed on stable) | 38 |
| Build time | ~60 s (Vue CLI, with zopfli/brotli compression) | < 1 s (Vite) |

The React bundle isn't code-split yet. Route-level `lazy()` and separating React Aria
Components should come before the second area moves over, so pages that don't need a widget
don't load it.

## Consequences

- Two toolchains in the repo until the Vue app is gone (`frontend/`, `frontend-react/`).
  `frontend-react/` reads `frontend/src/routes.js`, `menu.json` and `migrated-routes.json` at
  build time, so the React Docker build needs the repository root as context (see
  [03](03-coexistence.md#production)).
- Contributors need React and TypeScript. The PoC shows the shape a page takes: `useQuery` for
  loading, `useMutation` for actions, `useToast` for messages and `AppLink` for links.
- Accessibility is a lint error from day one (`jsx-a11y` strict), not a later clean-up.
