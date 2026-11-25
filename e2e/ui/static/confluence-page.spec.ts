// A page of the wiki (/pages/:page_id): Legal info, KMS and the other pages MyAEGEE shows from
// Confluence, through the gateway's proxy. Public.
import type { Page } from '@playwright/test';

import { confluencePage } from '../support/factories/static.ts';
import type { MockResponse } from '../support/api-mock.ts';
import { openMenu } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// The Confluence ids of the pages MyAEGEE has a name for.
const TERMS = '327057442';
const KMS = '2288287780';

const content = (id: string) => `/services/jira-cors/wiki/rest/api/content/${id}`;
const answer = (id: string, title: string, text: string): MockResponse => ({ json: confluencePage({ id, title, html: `<p>${text}</p>` }) });

const title = (page: Page) => page.getByRole('main').getByRole('heading', { level: 1 });
// The page has received the answer for `path` and had the chance to act on it: the browser
// records a resource once its answer has arrived in the page, and two frames later the app's
// handler and Vue's re-render have run. Only then can a test see that the answer was ignored.
const pageHasHandled = async (page: Page, path: string): Promise<void> => {
    await page.waitForFunction((part) => performance.getEntriesByType('resource').some((entry) => entry.name.includes(part)), path);
    await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
};
const notFoundText = 'The page you\'ve requested cannot be found. Maybe you\'ve mistyped the URL?...';

test.describe('wiki pages', () => {
    test('the KMS entry of the menu shows the KMS page', async ({ page, api, layout }) => {
        api.url('GET', content(KMS), answer(KMS, 'Knowledge Management System', 'Welcome to the KMS.'));
        await page.goto('/about');

        await (await openMenu(page, layout)).getByRole('link', { name: 'KMS', exact: true }).click();

        await expect(page).toHaveURL(/\/pages\/kms$/);
        await expect(title(page)).toHaveText('Knowledge Management System');
        await expect(page.getByRole('main').getByText('Welcome to the KMS.')).toBeVisible();
        expect(api.callsTo(`GET url ${content(KMS)}`).map((call) => new URL(call.path).searchParams.get('expand'))).toEqual(['body.export_view.webresource.tags.all']);
    });

    test.describe('for a visitor', () => {
        test.use({ session: 'anonymous' });

        test('a page without a name is asked for by its Confluence id', async ({ page, api }) => {
            api.url('GET', content('123456'), answer('123456', 'Statutes', 'The statutes of AEGEE.'));

            await page.goto('/pages/123456');

            await expect(title(page)).toHaveText('Statutes');
            await expect(page.getByRole('main').getByText('The statutes of AEGEE.')).toBeVisible();
            expect(api.callsTo(`GET url ${content('123456')}`)).toHaveLength(1);
        });
    });

    test('runs nothing the page\'s HTML contains', async ({ page, api }) => {
        api.url('GET', content(KMS), {
            json: confluencePage({
                id: KMS,
                title: 'Knowledge Management System',
                html: '<p>Read the <strong>guides</strong>.</p><script>window.__injected = true</script><img src="data:image/png;base64,AAAA" onerror="window.__injected = true">'
            })
        });

        await page.goto('/pages/kms');

        await expect(page.getByRole('main').getByRole('strong').filter({ hasText: 'guides' })).toBeVisible();
        expect(await page.evaluate(() => (window as { __injected?: boolean }).__injected)).toBeUndefined();
    });

    test('says so when Confluence has no such page', async ({ page, api }) => {
        api.url('GET', content('999'), { status: 404, json: { statusCode: 404, message: 'No content found with id: ContentId{id=999}' } });

        await page.goto('/pages/999');

        await expect(title(page)).toHaveText('The page is not found');
        await expect(page.getByText(notFoundText)).toBeVisible();
    });

    test('says so when Confluence cannot be reached', async ({ page, api }) => {
        api.url('GET', content(TERMS), { abort: 'failed' });

        await page.goto('/pages/terms-of-service');

        await expect(title(page)).toHaveText('The page is not found');
        await expect(page.getByText(notFoundText)).toBeVisible();
    });

    test('going from Legal info to KMS and back shows each page', async ({ page, api, layout }) => {
        api.url('GET', content(TERMS), answer(TERMS, 'Terms of service', 'These are the legal terms.'));
        api.url('GET', content(KMS), answer(KMS, 'Knowledge Management System', 'Welcome to the KMS.'));
        await page.goto('/about');

        await page.getByRole('link', { name: 'Legal info' }).click();
        await expect(page).toHaveURL(/\/pages\/terms-of-service$/);
        await expect(title(page)).toHaveText('Terms of service');
        await expect(page.getByRole('main').getByText('These are the legal terms.')).toBeVisible();

        // The same page with another :page_id: the app keeps the component and loads the new page.
        await (await openMenu(page, layout)).getByRole('link', { name: 'KMS', exact: true }).click();
        await expect(page).toHaveURL(/\/pages\/kms$/);
        await expect(title(page)).toHaveText('Knowledge Management System');
        await expect(page.getByRole('main').getByText('Welcome to the KMS.')).toBeVisible();
        await expect(page.getByRole('main').getByText('These are the legal terms.')).toHaveCount(0);

        await page.goBack();
        await expect(page).toHaveURL(/\/pages\/terms-of-service$/);
        await expect(title(page)).toHaveText('Terms of service');
        expect(api.callsTo(`GET url ${content(TERMS)}`)).toHaveLength(2);
    });

    test('a late answer for the previous page does not replace the current one', async ({ page, api, layout }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.url('GET', content(TERMS), async () => { await held; return answer(TERMS, 'Terms of service', 'These are the legal terms.'); });
        api.url('GET', content(KMS), answer(KMS, 'Knowledge Management System', 'Welcome to the KMS.'));

        const asked = page.waitForRequest((request) => request.url().includes(content(TERMS)));
        await page.goto('/pages/terms-of-service');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'KMS', exact: true }).click();
        await expect(title(page)).toHaveText('Knowledge Management System');

        // The answer for Legal info arrives after the one for KMS.
        const late = page.waitForResponse((response) => response.url().includes(content(TERMS)));
        release();
        await (await late).finished();
        await pageHasHandled(page, content(TERMS));

        await expect(title(page)).toHaveText('Knowledge Management System');
        await expect(page.getByRole('main').getByText('Welcome to the KMS.')).toBeVisible();
        await expect(page.getByRole('main').getByText('These are the legal terms.')).toHaveCount(0);
    });

    test('a late failure for the previous page does not replace the current one', async ({ page, api, layout }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.url('GET', content(TERMS), async () => { await held; return { status: 502, body: '<html>Bad gateway</html>', contentType: 'text/html' }; });
        api.url('GET', content(KMS), answer(KMS, 'Knowledge Management System', 'Welcome to the KMS.'));

        const asked = page.waitForRequest((request) => request.url().includes(content(TERMS)));
        await page.goto('/pages/terms-of-service');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'KMS', exact: true }).click();
        await expect(title(page)).toHaveText('Knowledge Management System');

        const late = page.waitForResponse((response) => response.url().includes(content(TERMS)));
        release();
        await (await late).finished();
        await pageHasHandled(page, content(TERMS));

        await expect(title(page)).toHaveText('Knowledge Management System');
        await expect(page.getByText(notFoundText)).toHaveCount(0);
    });
});
