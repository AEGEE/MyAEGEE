import type { Page } from '@playwright/test';
import { test, expect, loginInBrowser, expectStatus, type Api, type Envelope } from '../support/api.ts';

// Permission checks and validation are covered by core's tests.

interface Category {
    id: number;
    name: string;
    links: { id: number }[];
}

const PREFIX = 'e2e resources';

const cleanUp = async (api: Api): Promise<void> => {
    const res = await api.call<Envelope<Category[]>>('admin', 'GET', '/api/core/resources');
    expectStatus(res, 200);

    for (const category of res.body.data.filter(({ name }) => name.startsWith(PREFIX))) {
        for (const link of category.links) {
            expectStatus(await api.call('admin', 'DELETE', `/api/core/resources/links/${link.id}`), 200);
        }
        expectStatus(await api.call('admin', 'DELETE', `/api/core/resources/categories/${category.id}`), 200);
    }
};

const addLink = async (page: Page, section: string, link: { title: string; description: string; url: string }): Promise<void> => {
    await page.getByRole('link', { name: `Add link to ${section}` }).click();
    await expect(page.getByRole('heading', { name: 'Add link' })).toBeVisible();
    await expect(page.getByLabel('Section')).toHaveValue(/\d+/);
    await page.getByLabel('Title').fill(link.title);
    await page.getByLabel('Description').fill(link.description);
    await page.getByLabel('URL').fill(link.url);
    await page.getByRole('button', { name: 'Save link' }).click();
    await expect(page).toHaveURL(/\/resources\/manage$/);
};

const deleteWithDialog = async (page: Page, buttonName: string, confirmText: string): Promise<void> => {
    await page.getByRole('button', { name: buttonName }).click();
    await page.getByRole('button', { name: confirmText, exact: true }).click();
};

test.describe('Managing the Resources page', () => {
    test.afterEach(async ({ api }) => {
        await cleanUp(api);
    });

    test('members without the permission get no manage button', async ({ api, page }) => {
        await loginInBrowser(page, api, 'member');
        await page.goto('/resources');
        await expect(page.getByRole('heading', { level: 2, name: 'Stay informed' })).toBeVisible();

        await expect(page.getByRole('link', { name: 'Manage resources' })).toHaveCount(0);
    });

    test('admins add, reorder and delete a section and its links', async ({ api, page }) => {
        const section = `${PREFIX} ${Date.now()}`;
        const internal = { title: 'E2E internal page', description: 'A MyAEGEE page', url: '/pages/mailing-lists' };
        const external = { title: 'E2E external site', description: 'Another site', url: 'https://example.org/e2e' };

        await loginInBrowser(page, api, 'admin');
        await page.goto('/resources');
        await page.getByRole('link', { name: 'Manage resources' }).click();
        await expect(page).toHaveURL(/\/resources\/manage$/);

        await page.getByRole('link', { name: 'Add section' }).click();
        await page.getByLabel('Name').fill(section);
        await page.getByLabel('Red').check();
        await page.getByRole('button', { name: 'Save section' }).click();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('heading', { level: 2 }).last()).toHaveText(section);

        await addLink(page, section, internal);
        await addLink(page, section, external);

        const region = page.getByRole('region', { name: section, exact: true });
        await expect(region.getByRole('listitem')).toHaveCount(2);
        await region.getByRole('button', { name: `Move link ${external.title} up` }).click();
        await expect(region.getByRole('listitem').first()).toContainText(external.title);

        await expect(region.getByRole('button', { name: `Delete section ${section}` })).toBeDisabled();

        await page.goto('/resources');
        const publicRegion = page.getByRole('region', { name: section, exact: true });
        await expect(publicRegion.getByRole('link')).toHaveCount(2);
        await expect(publicRegion.getByRole('link').first()).toHaveAttribute('href', external.url);
        await expect(publicRegion.getByRole('link').first()).toHaveAttribute('target', '_blank');
        await expect(publicRegion.getByRole('link').nth(1)).toHaveAttribute('href', internal.url);
        await expect(publicRegion.getByRole('link').nth(1)).not.toHaveAttribute('target');

        await page.goto('/resources/manage');
        await deleteWithDialog(page, `Delete link ${external.title}`, 'Delete link');
        await expect(region.getByRole('listitem')).toHaveCount(1);
        await deleteWithDialog(page, `Delete link ${internal.title}`, 'Delete link');
        await expect(region.getByText('This section has no links yet.')).toBeVisible();
        await deleteWithDialog(page, `Delete section ${section}`, 'Delete section');
        await expect(page.getByRole('heading', { level: 2, name: section })).toHaveCount(0);
    });
});
