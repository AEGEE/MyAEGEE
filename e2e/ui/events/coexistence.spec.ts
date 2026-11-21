// Moving between the Vue and the React app (project `react` only): links across the apps load
// the page from the server, the session carries over, and so do the toasts shown just before.
// See docs/react-migration/03-coexistence.md.
import type { Page } from '@playwright/test';

import { test, expect, toast } from '../support/test.ts';
import { eventSummary, ok } from '../support/factories.ts';
import { mockEverything } from '../support/smoke-data.ts';

// Which app rendered the page: the Vue app mounts on #app, the React app on #root.
const app = (page: Page) => page.evaluate(() => (document.querySelector('#root') ? 'react' : 'vue'));

test.describe('Vue and React side by side', { tag: '@migrated' }, () => {
    test.use({ strictApi: false });
    test.beforeEach(({ frontend }) => {
        test.skip(frontend === 'vue', 'Only the React app runs next to the Vue app');
    });

    test('the Vue menu leads to the React events list, still logged in', async ({ page, api }) => {
        mockEverything(api);
        api.json('GET events /', ok([eventSummary({ name: 'Spring Training' })]));
        await page.goto('/dashboard');
        expect(await app(page)).toBe('vue');

        const sidebar = page.getByRole('complementary');
        await sidebar.getByText('Events listing').click();
        await sidebar.getByRole('link', { name: 'All events' }).click();

        await expect(page).toHaveURL('/events');
        await expect(page.getByRole('article', { name: 'Spring Training' })).toBeVisible();
        expect(await app(page)).toBe('react');
        await expect(page.getByRole('navigation').getByText('Alex Member')).toBeVisible();
    });

    test('links in the React app to pages it does not serve open them in the Vue app', async ({ page, api }) => {
        mockEverything(api);
        api.json('GET events /', ok([eventSummary({ name: 'Spring Training', organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }] })]));
        await page.goto('/events');
        expect(await app(page)).toBe('react');

        await page.getByRole('article', { name: 'Spring Training' }).getByRole('link', { name: 'AEGEE-Antenna' }).click();

        await expect(page).toHaveURL('/bodies/1');
        await expect(page).toHaveTitle('MyAEGEE | View single body');
        expect(await app(page)).toBe('vue');
    });

    test('a toast shown by the Vue app right before going to a React page is still shown there', async ({ page, api }) => {
        mockEverything(api);
        api.json('GET events /', ok([]));
        await page.goto('/dashboard');
        // The Vue router has finished its first navigation (it sets the title at the end).
        await expect(page).toHaveTitle('MyAEGEE | Dashboard');

        // What a Vue view does after saving: show a toast, then go to a page (here a React one).
        await page.evaluate(() => {
            const root = (document.querySelector('#app') as unknown as { __vue__: { $root: { showSuccess: (m: string) => void; $router: { push: (p: string) => void } } } }).__vue__.$root;
            root.showSuccess('Event is saved.');
            root.$router.push('/events');
        });

        // The URL changes before the new page has loaded.
        await expect(page.locator('#root')).toBeAttached();
        await expect(page).toHaveURL('/events');
        await expect(toast(page, 'Event is saved.')).toBeVisible();
    });
});
