// The routes of this app and the gateway's list (frontend/src/migrated-routes.json) must agree:
// a path the gateway sends here needs a page, and a path of the Vue app must not be taken.
import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from './App';
import { isReactPath } from './lib/links';

const served = (path: string): boolean => {
    const matches = matchRoutes(routes, path) ?? [];
    return matches.some((match) => match.route.path && match.route.path !== '*');
};

describe('routes', () => {
    it.each([
        '/events', '/events/', '/events/participating', '/events/organizing',
        '/events/spring-training', '/events/12', '/events/spring-training/applications/me', '/events/12/applications/34'
    ])('%s is sent here by the gateway and has a page', (path) => {
        expect(isReactPath(path)).toBe(true);
        expect(served(path)).toBe(true);
    });

    it.each([
        '/events/new', '/events/serviceadmin', '/events/change_status', '/events/boardview',
        '/events/12/edit', '/events/12/participants', '/events/12/accepted',
        '/dashboard', '/bodies/1', '/summeruniversity', '/login'
    ])('%s stays with the Vue app', (path) => {
        expect(isReactPath(path)).toBe(false);
    });
});
