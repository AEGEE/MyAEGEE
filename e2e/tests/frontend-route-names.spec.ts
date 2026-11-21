import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

// When an event can't be loaded, these pages send the user back to the events list.
// They used to push route names that don't exist, so the user landed on the start page instead.
test.describe('frontend redirects to the events lists', () => {
    for (const { service, list } of [
        { service: 'events', list: '/events' },
        { service: 'summeruniversity', list: '/summeruniversity' }
    ]) {
        test(`${service} participants of a missing event go back to ${list}`, moveToModule('frontend', 'once the frontend has component tests'), async ({ api, page }) => {
            await loginInBrowser(page, api, 'admin');
            await page.goto(`/${service}/e2e-does-not-exist-${Date.now()}/participants`);

            await expect(page.getByText('Event is not found')).toBeVisible();
            await expect(page).toHaveURL(new RegExp(`${list}$`));
        });
    }
});
