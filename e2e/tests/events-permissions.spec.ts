import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

// The events API's permission checks (create:event, future applications per type, editing
// applications) are covered by events' own tests in events/test/api.
test.describe('events permissions', () => {
    test('the event status is shown to people who can approve the event', moveToModule('frontend', 'once the frontend has component tests'), async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'admin');
        await page.goto(`/events/${event.url}`);

        await expect(page.getByRole('rowheader', { name: 'Status', exact: true })).toBeVisible();
    });

    test('the event status is hidden from people who cannot approve the event', moveToModule('frontend', 'once the frontend has component tests'), async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        // The details table is rendered, but without the status row.
        await expect(page.getByRole('rowheader', { name: 'Event name', exact: true })).toBeVisible();
        await expect(page.getByRole('rowheader', { name: 'Status', exact: true })).toHaveCount(0);
    });
});
