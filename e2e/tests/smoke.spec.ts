import { test, expect, loginInBrowser, type Envelope } from '../support/api.ts';
import { USERS, type Username } from '../support/constants.ts';
import { loadSeedPermissions } from '../support/core.ts';

test.describe('e2e stack', () => {
    for (const service of ['core', 'events', 'summeruniversity', 'statutory', 'network', 'discounts']) {
        test(`${service} is reachable through the gateway`, async ({ api }) => {
            const { status, body } = await api.call<Envelope<unknown>>(null, 'GET', `/api/${service}/healthcheck`);
            expect(status).toBe(200);
            expect(body.success).toBe(true);
        });
    }

    test('the gateway passes on a query that follows the service name directly', async ({ api }) => {
        // The frontend asks for the events list as `/api/events?limit=30`, without a slash.
        const { status, body } = await api.call<Envelope<unknown[]>>('member', 'GET', '/api/events?limit=1');
        expect(status).toBe(200);
        expect(body.success, 'an answer from events, not the frontend\'s index.html').toBe(true);
        expect(body.data.length).toBeLessThanOrEqual(1);
    });

    // Network and discounts ask core who the caller is and what they may do, so an answer for
    // a logged-in user and a refusal for an anonymous one show they reach core.
    const listings: [string, Username, string][] = [
        ['network', 'netcom', '/boards'],
        ['discounts', 'member', '/categories']
    ];
    for (const [service, username, path] of listings) {
        test(`${service} recognises a logged-in user through core`, async ({ api }) => {
            const loggedIn = await api.call<Envelope<unknown[]>>(username, 'GET', `/api/${service}${path}`);
            expect(loggedIn.status, JSON.stringify(loggedIn.body)).toBe(200);
            expect(Array.isArray(loggedIn.body.data)).toBe(true);

            const anonymous = await api.call(null, 'GET', `/api/${service}${path}`);
            expect(anonymous.status).toBe(401);
        });
    }

    test('NetCom has the production permission set', async ({ api }) => {
        const { body } = await api.call<Envelope<{ combined: string }[]>>('netcom', 'GET', '/api/core/my_permissions');
        const combined = body.data.map((permission) => permission.combined);

        // The seed models production: NetCom members get the Network Commission circle's
        // permissions, those of its parent (the general other board circle) and those of the
        // general members circle (through their antenna), nothing else.
        const { CIRCLE_PERMISSIONS } = loadSeedPermissions();
        const allowed = [
            ...CIRCLE_PERMISSIONS.netcomCircle,
            ...CIRCLE_PERMISSIONS.otherBoardCircle,
            ...CIRCLE_PERMISSIONS.membersCircle
        ];
        expect(combined.filter((permission) => !allowed.includes(permission))).toEqual([]);

        // The NetCom tests rely on these.
        expect(combined).toEqual(expect.arrayContaining([
            'global:approve_event:nwm',
            'global:manage_event:nwm',
            'global:search:member'
        ]));
        expect(combined).not.toContain('global:lookup:member');
    });

    // The other seeded office holders: each logs in and has the global permissions of the
    // circle the seed puts them in.
    const officeHolders: [Username, string][] = [
        [USERS.nd, 'networkDirectorCircle'],
        [USERS.fd, 'financialDirectorCircle'],
        [USERS.suct, 'suctCircle'],
        [USERS.eqac, 'eqacCircle'],
        [USERS.chair, 'chairsCircle']
    ];
    for (const [username, circle] of officeHolders) {
        test(`${username} has the permissions of the seed's ${circle}`, async ({ api }) => {
            const { status, body } = await api.call<Envelope<{ combined: string }[]>>(username, 'GET', '/api/core/my_permissions');
            expect(status).toBe(200);

            const expected = loadSeedPermissions().CIRCLE_PERMISSIONS[circle].filter((permission) => permission.startsWith('global:'));
            expect(expected.length).toBeGreaterThan(0);
            expect(body.data.map((permission) => permission.combined)).toEqual(expect.arrayContaining(expected));
        });
    }

    test('a member can open a published event in the frontend', async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        await expect(page.getByRole('rowheader', { name: 'Event name', exact: true })).toBeVisible();
        await expect(page.getByText(event.name).first()).toBeVisible();
    });
});
