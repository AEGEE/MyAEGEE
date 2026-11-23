// Generic answers for every API call, so any page can render without a backend: lists come back
// empty, and each area adds one plausible object for its "single item" endpoints. The smoke and
// accessibility runs (ui/smoke/, ui/a11y/) use these; behavioural specs mock exactly what they
// need, or pass `mockEverything` to `api.fallback()` for a page of another area they end on.
//
// One file per area, so an area's specs and smoke data change together and nobody edits a
// shared list. Each exports `smoke`, `params`, `redirects` and `expectedAlerts`; their keys are
// checked against the router's routes (ui/support/routes.ts).
import type { ApiMock } from '../api-mock.ts';
import { AREAS, type Area } from '../areas.ts';
import { okList, ok } from '../factories/base.ts';
import * as auth from './auth.ts';
import * as core from './core.ts';
import * as dashboard from './dashboard.ts';
import * as discounts from './discounts.ts';
import * as events from './events.ts';
import * as network from './network.ts';
import * as resources from './resources.ts';
import * as shell from './shell.ts';
import * as staticPages from './static.ts';
import * as statutory from './statutory.ts';
import * as summeruniversity from './summeruniversity.ts';

export interface AreaSmoke {
    smoke: (api: ApiMock) => void;
    params: Record<string, Record<string, string>>;
    redirects: Record<string, { url: string; title: string }>;
    expectedAlerts: Record<string, RegExp>;
}

export const SMOKE: Record<Area, AreaSmoke> = {
    auth, core, dashboard, discounts, events, network, resources, shell, static: staticPages, statutory, summeruniversity
};

const SERVICES = ['core', 'events', 'summeruniversity', 'statutory', 'discounts', 'network', 'mailer'];

export const mockEverything = (api: ApiMock): void => {
    // Registered first, so everything the areas add (and anything a test adds) takes precedence.
    for (const service of SERVICES) {
        api.on(`GET ${service} *`, { json: okList([], 0) });
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) api.on(`${method} ${service} *`, { json: ok({}) });
    }
    // The gateway's proxies to other sites, and the services' files.
    api.url('*', '/services/**', { json: {} });
    api.url('GET', '/media/**', { status: 404, json: { success: false, message: 'Not found' } });

    for (const area of AREAS) SMOKE[area].smoke(api);
};
