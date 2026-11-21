# MyAEGEE frontend (React)

The React version of the MyAEGEE frontend. It's being built page by page next to the Vue app in
[`frontend/`](../frontend): the gateway sends the paths listed in
[`frontend/src/migrated-routes.json`](../frontend/src/migrated-routes.json) here, and everything
else to the Vue app. Both apps share the login session (the tokens in `localStorage`), so moving
between them doesn't log anyone out.

Right now it's the proof of concept of the
[React migration spike](../docs/react-migration/00-spike-charter.md): the events list, the event
page and applying to an event.

## Stack

Vite, React 19, TypeScript, React Router (routing), TanStack Query (server data), React Aria
Components (accessible widgets such as the confirmation dialog), CSS Modules with the design
tokens in `src/styles/tokens.css`. The reasons are in
[`docs/react-migration/02-target-stack.md`](../docs/react-migration/02-target-stack.md).

## Commands

```sh
npm install          # from the repository root (npm workspaces)
cd frontend-react
npm run dev          # dev server on :8081; /api goes to MYAEGEE_GATEWAY_URL (default http://localhost)
npm run build        # type check and build into dist/ (assets under /react/)
npm run lint         # ESLint (incl. jsx-a11y strict) and the type check
npm test             # unit tests (Vitest)
```

The behaviour is tested with the Playwright suites in [`e2e/`](../e2e): the same specs run against
the Vue app and this one (`npm run test:mocked` there, project `react`).

## How it fits next to the Vue app

- **Page titles, login requirements and the sidebar menu** come from the Vue app's
  `src/router/routes.js` and `src/menu.json`, read at build time (`virtual:vue-app` in
  `vite.config.ts`), so the two apps can't drift apart.
- **Links**: `AppLink` (`src/lib/links.tsx`) navigates inside this app for migrated paths and does a
  normal page load for everything else. The Vue app does the same in the other direction when
  it's built with `VUE_APP_REACT_ROUTES=true`.
- **Toasts** shown just before such a page load are handed over through `sessionStorage`
  (`src/lib/flash.ts`, `frontend/src/methods/flash.js`).
- **The session**: `src/lib/api.ts` sends `access-token`, renews it with `refresh-token` on a 401
  and sends visitors to the Vue login page when that fails.

To move another page here: add its path to `migrated-routes.json`, its route to `src/App.tsx`
(`src/App.test.tsx` checks the two agree), and tag its Playwright specs `@migrated`.
