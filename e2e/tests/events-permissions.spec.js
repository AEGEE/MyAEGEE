const { test, expect, expectStatus, knownBug, loginInBrowser } = require('../support/api');

test.describe('events permissions', () => {
    test('creating an event requires create:event', async ({ api }) => {
        knownBug('Known bug: addEvent does not check create:event', /Received: 201/);

        // not-member is in no body and so has no create:event.
        const payload = await api.eventPayload('not-member', { type: 'training' });
        const res = await api.call('not-member', 'POST', '/api/events/', payload);
        expectStatus(res, 403);
    });

    test('manage_event for one type only shows future applications for that type', async ({ api }) => {
        knownBug('Known bug: any manage_event permission lists future applications for all event types', /Received: "training"/);

        const member = await api.me('member');
        for (const type of ['training', 'nwm']) {
            const event = await api.createEvent('admin', { type });
            await api.publishAsAdmin(event.id);
            await api.apply('member', event.id);
        }

        const res = await api.call('netcom', 'GET', `/api/events/applications/future/${member.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        for (const application of res.body.data) {
            expect(application.event_type).toBe('nwm');
        }
    });

    test('editing someone else\'s application keeps the applicant', async ({ api }) => {
        knownBug('Known bug: updateApplication overwrites user_id and name with the editor\'s', /applicant user_id/);

        const member = await api.me('member');
        const event = await api.createEvent('admin');
        await api.publishAsAdmin(event.id);
        const application = await api.apply('member', event.id);

        const edit = await api.call('netcom', 'PUT', `/api/events/single/${event.id}/applications/${application.id}`, {
            answers: []
        });
        expectStatus(edit, 200);

        const res = await api.call('admin', 'GET', `/api/events/single/${event.id}/applications/${application.id}`);
        expect(res.body.data.user_id, 'applicant user_id').toBe(member.id);
        expect(res.body.data.first_name).toBe(member.first_name);
    });

    test('the event status is shown to people who can approve the event', async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'admin');
        await page.goto(`/events/${event.url}`);

        await expect(page.getByRole('rowheader', { name: 'Status', exact: true })).toBeVisible();
    });

    test('the event status is hidden from people who cannot approve the event', async ({ api, page }) => {
        knownBug('Known bug: Single.vue checks can.approve_event, which is an object and always truthy', /toHaveCount/);

        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        await expect(page.getByText(event.name).first()).toBeVisible();
        await expect(page.getByRole('rowheader', { name: 'Status', exact: true })).toHaveCount(0);
    });
});
