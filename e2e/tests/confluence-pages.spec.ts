import type { Page, Route } from '@playwright/test';
import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

// Confluence page IDs from namesMap in frontend/src/views/static/ConfluencePage.vue.
const PAGES: Record<string, { title: string, body: string }> = {
    327057442: { title: 'Terms of service', body: 'These are the legal terms.' },
    2288287780: { title: 'Knowledge Management System', body: 'Welcome to the KMS.' }
};

// The gateway doesn't proxy Confluence in e2e, so answer its API from the test.
// `delays` holds back the response for a page ID until the returned promise is resolved.
const mockConfluence = async (page: Page, delays: Record<string, Promise<void>> = {}): Promise<void> => {
    await page.route('**/services/jira-cors/wiki/rest/api/content/**', async (route: Route) => {
        const id = new URL(route.request().url()).pathname.split('/').pop() as string;
        await delays[id];
        const content = PAGES[id];
        if (!content) {
            await route.fulfill({ status: 404, json: { message: 'Not found' } });
            return;
        }
        await route.fulfill({
            json: { title: content.title, body: { export_view: { value: `<p>${content.body}</p>` } } }
        });
    });
};

const pageTitle = (page: Page) => page.locator('.legal .title');
const pageContent = (page: Page) => page.locator('.legal .content');

test.describe('Confluence pages', () => {
    test('going from Legal info to KMS shows the KMS page', moveToModule('frontend', 'once the frontend has component tests for ConfluencePage'), async ({ api, page }) => {
        await mockConfluence(page);
        await loginInBrowser(page, api, 'member');
        await page.goto('/');

        await page.getByRole('link', { name: 'Legal info' }).click();
        await expect(page).toHaveURL(/\/pages\/terms-of-service$/);
        await expect(pageTitle(page)).toHaveText('Terms of service');
        await expect(pageContent(page)).toHaveText('These are the legal terms.');

        // Same route, other :page_id: the router reuses the component.
        await page.getByRole('link', { name: 'KMS', exact: true }).click();
        await expect(page).toHaveURL(/\/pages\/kms$/);
        await expect(pageTitle(page)).toHaveText('Knowledge Management System');
        await expect(pageContent(page)).toHaveText('Welcome to the KMS.');

        // And back again.
        await page.goBack();
        await expect(page).toHaveURL(/\/pages\/terms-of-service$/);
        await expect(pageTitle(page)).toHaveText('Terms of service');
    });

    test('a slow response for the previous page does not replace the current one', moveToModule('frontend', 'once the frontend has component tests for ConfluencePage'), async ({ api, page }) => {
        let releaseLegal = (): void => {};
        const legalHeldBack = new Promise<void>((resolve) => { releaseLegal = resolve; });
        await mockConfluence(page, { 327057442: legalHeldBack });
        await loginInBrowser(page, api, 'member');

        const legalRequest = page.waitForRequest('**/content/327057442?*');
        await page.goto('/pages/terms-of-service');
        await legalRequest;

        await page.getByRole('link', { name: 'KMS', exact: true }).click();
        await expect(pageTitle(page)).toHaveText('Knowledge Management System');

        // The Legal info response arrives after the KMS one.
        const legalResponse = page.waitForResponse('**/content/327057442?*');
        releaseLegal();
        await (await legalResponse).finished();
        // Let the page parse and render the response before checking it was ignored; without
        // this, the checks below could pass before a stale response is applied.
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
        }));

        await expect(pageTitle(page)).toHaveText('Knowledge Management System');
        await expect(pageContent(page)).toHaveText('Welcome to the KMS.');
    });
});
