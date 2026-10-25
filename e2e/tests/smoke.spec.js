const { test, expect, loginInBrowser } = require('../support/api');

test.describe('e2e stack', () => {
    for (const service of ['core', 'events', 'summeruniversity']) {
        test(`${service} is reachable through the gateway`, async ({ api }) => {
            const { status, body } = await api.call(null, 'GET', `/api/${service}/healthcheck`);
            expect(status).toBe(200);
            expect(body.success).toBe(true);
        });
    }

    test('NetCom has the production permission set', async ({ api }) => {
        const { body } = await api.call('netcom', 'GET', '/api/core/my_permissions');
        const combined = body.data.map((permission) => permission.combined);

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

        await expect(page.getByText(event.name).first()).toBeVisible();
    });
});
