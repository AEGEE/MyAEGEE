import { test, expect, loginInBrowser, type Envelope } from '../support/api.ts';
import type { Username } from '../support/constants.ts';
import { loadSeedPermissions } from '../support/core.ts';

test.describe('e2e stack', () => {
    for (const service of ['core', 'events', 'summeruniversity', 'statutory', 'network', 'discounts']) {
        test(`${service} is reachable through the gateway`, async ({ api }) => {
            const { status, body } = await api.call<Envelope<unknown>>(null, 'GET', `/api/${service}/healthcheck`);
            expect(status).toBe(200);
            expect(body.success).toBe(true);
        });
    }

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

    test('a member can open a published event in the frontend', async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        await expect(page.getByRole('rowheader', { name: 'Event name', exact: true })).toBeVisible();
        await expect(page.getByText(event.name).first()).toBeVisible();
    });
});
