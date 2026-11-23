// The routes of the Vue app (frontend/src/router/routes.js), with example values for their
// parameters, for the smoke and accessibility runs over every page. The list is read from the
// router's own file, so a new route shows up in both runs by itself.
import { createRequire } from 'node:module';
import path from 'node:path';

import { isArea, type Area } from './areas.ts';
import type { Member } from './factories/core.ts';
import { SMOKE } from './smoke/index.ts';

interface RouteDefinition {
    name: string;
    path: string;
    component: string;
    meta: { label: string; auth?: boolean };
}

export interface AppRoute {
    name: string;
    // The route's path as the router has it ('/events/:id').
    path: string;
    // The path with its parameters filled in.
    url: string;
    label: string;
    auth: boolean;
    component: string;
    // The directory of frontend/src/views/ the route's view is in.
    area: Area;
}

const require = createRequire(import.meta.url);
// eslint-disable-next-line import/no-dynamic-require -- the path is fixed, only resolved from here
const definitions = require(path.resolve(import.meta.dirname, '../../../frontend/src/router/routes.js')) as RouteDefinition[];

// Parameter values that make sense for the generic answers (support/smoke/). An area gives
// other values for its own routes in `params` of its smoke file.
const PARAMS: Record<string, string> = {
    application_id: 'me',
    token: 'mock-token',
    year: '2027',
    type: 'antenna'
};

const areaOf = (route: RouteDefinition): Area => {
    const area = route.component.split('/')[0];
    if (!isArea(area) || area === 'shell') throw new Error(`Route ${route.name}: its component "${route.component}" is in no known area (ui/support/areas.ts)`);
    return area;
};

const fill = (route: RouteDefinition, area: Area): string => route.path
    .replace(/:(\w+)\??/g, (_, key: string) => SMOKE[area].params[route.name]?.[key] ?? PARAMS[key] ?? '1')
    .replace(/\/$/, '') || '/';

export const ROUTES: AppRoute[] = definitions.map((route) => {
    const area = areaOf(route);
    return {
        name: route.name,
        path: route.path,
        url: fill(route, area),
        label: route.meta.label,
        auth: route.meta.auth !== false,
        component: route.component,
        area
    };
});

// A key in an area's smoke file must be a route of that area. Anything else is left over from
// a route that was renamed, moved or removed, and would silently stop doing its job.
for (const [area, data] of Object.entries(SMOKE)) {
    for (const [kind, keys] of Object.entries({ params: data.params, redirects: data.redirects, expectedAlerts: data.expectedAlerts, profiles: data.profiles ?? {} })) {
        for (const name of Object.keys(keys)) {
            const route = ROUTES.find((item) => item.name === name);
            if (!route) throw new Error(`ui/support/smoke/${area}.ts: \`${kind}\` has "${name}", which is not a route in frontend/src/router/routes.js`);
            if (route.area !== area) throw new Error(`ui/support/smoke/${area}.ts: \`${kind}\` has "${name}", which is a route of the area "${route.area}"`);
        }
    }
}

export const redirectOf = (route: AppRoute): { url: string; title: string } | undefined => SMOKE[route.area].redirects[route.name];

export const expectedAlertOf = (route: AppRoute): RegExp | undefined => SMOKE[route.area].expectedAlerts[route.name];

// Changes the logged-in member into one who gets to see the route's page, where that takes more
// than being logged in.
export const prepareProfile = (route: AppRoute, me: Member | null): void => {
    const change = SMOKE[route.area].profiles?.[route.name];
    if (change && me) change(me);
};
