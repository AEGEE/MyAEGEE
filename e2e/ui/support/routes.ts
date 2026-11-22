// The routes of the Vue app (frontend/src/router/routes.js), with example values for their
// parameters, for the smoke and accessibility runs over every page.
import { createRequire } from 'node:module';
import path from 'node:path';

import { frontendFor } from '../../support/frontend-routing.ts';

interface RouteDefinition {
    name: string;
    path: string;
    component: string;
    meta: { label: string; auth?: boolean };
}

export interface AppRoute {
    name: string;
    // The route's path with its parameters filled in.
    url: string;
    label: string;
    auth: boolean;
    component: string;
    // Served by the React app when it runs next to the Vue app.
    migrated: boolean;
}

const require = createRequire(import.meta.url);
// eslint-disable-next-line import/no-dynamic-require -- the path is fixed, only resolved from here
const definitions = require(path.resolve(import.meta.dirname, '../../../frontend/src/router/routes.js')) as RouteDefinition[];

// Parameter values that make sense for the mocked data (support/smoke-data.ts).
const PARAMS: Record<string, string> = {
    application_id: 'me',
    token: 'mock-token',
    prefix: 'agora-spring',
    year: '2027',
    type: 'antenna'
};

const fill = (routePath: string): string => routePath
    .replace(/:(\w+)\??/g, (_, key: string) => PARAMS[key] ?? '1')
    .replace(/\/$/, '') || '/';

export const ROUTES: AppRoute[] = definitions.map((route) => {
    const url = fill(route.path);
    return {
        name: route.name,
        url,
        label: route.meta.label,
        auth: route.meta.auth !== false,
        component: route.component,
        migrated: frontendFor(url, { react: true }) === 'react'
    };
});
