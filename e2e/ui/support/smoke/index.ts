// Generic answers for every API call, so any page can render without a backend: lists come back
// empty, and each area adds one plausible object for its "single item" endpoints. The smoke and
// accessibility runs (ui/smoke/, ui/a11y/) use these; behavioural specs mock exactly what they
// need, or pass `mockEverything` to `api.fallback()` for a page of another area they end on.
//
// One file per area, so an area's specs and smoke data change together and nobody edits a
// shared list. Each exports `smoke`, `params`, `redirects` and `expectedAlerts`; their keys are
// checked against the router's routes (ui/support/routes.ts).
import { SERVICES, type ApiMock } from '../api-mock.ts';
import { AREAS, type Area } from '../areas.ts';
import { NOW, okList, ok, withNow } from '../factories/base.ts';
import type { Member } from '../factories/core.ts';
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
    // Route name -> what to change about the logged-in member before the page loads, for a
    // page that only some members get to see.
    profiles?: Record<string, (me: Member) => void>;
}

export const SMOKE: Record<Area, AreaSmoke> = {
    auth, core, dashboard, discounts, events, network, resources, shell, static: staticPages, statutory, summeruniversity
};

// Registered as fallback answers (`api.fallback`): they step in only where the test and the
// fixtures have no answer of their own, so the logged-in member and their permissions stay
// what the session says, and nothing has to call them. Their dates are relative to `now`: the
// generated tests pass the instant they freeze the clock at.
export const mockEverything = (api: ApiMock, now: number = NOW): void => {
    api.fallback(() => withNow(now, () => {
        // Registered first, so everything the areas add takes precedence.
        for (const service of SERVICES) {
            api.on(`GET ${service} *`, { json: okList([], 0) });
            for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) api.on(`${method} ${service} *`, { json: ok({}) });
        }
        // The gateway's proxies to other sites, and the services' files.
        api.url('*', '/services/**', { json: {} });
        api.url('GET', '/media/**', { status: 404, json: { success: false, message: 'Not found' } });

        for (const area of AREAS) SMOKE[area].smoke(api);
    }));
};
