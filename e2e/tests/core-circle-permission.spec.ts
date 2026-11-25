// A permission reaches a member through a circle: an admin creates a free circle on its page,
// attaches a permission on its edit page and adds the member; the member's menu and pages
// follow, from what core works out of the circles. Deleting the circle takes the permission
// away again. Core's own tests cover the permission rules; this checks the pages against them.
import type { Page } from '@playwright/test';

import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { asAdmin } from '../support/core-data.ts';

const unconfirmedLink = (page: Page) => page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Unconfirmed users' });

test.describe('circle permissions', () => {
    test('a member gets a permission through a circle, and loses it with the circle', async ({ api, page, browser }) => {
        const name = `E2E circle ${Date.now()}`;
        const member = await api.me('member');
        const memberContext = await browser.newContext();
        const memberPage = await memberContext.newPage();
        let circleId: number | undefined;

        try {
            await loginInBrowser(memberPage, api, 'member');
            await memberPage.goto('/dashboard');
            await expect(memberPage.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Bodies' })).toBeVisible();
            await expect(unconfirmedLink(memberPage)).toHaveCount(0);

            // The admin creates the circle and attaches the permission.
            await loginInBrowser(page, api, 'admin');
            await page.goto('/circles/new');
            await page.getByRole('textbox', { name: 'Name' }).fill(name);
            await page.getByRole('textbox', { name: 'Description' }).fill('Circle created by an e2e test');
            await page.getByRole('button', { name: 'Save circle' }).click();
            await expect(page).toHaveURL(/\/circles\/\d+$/);
            circleId = Number(new URL(page.url()).pathname.split('/').at(-1));
            await expect(page.getByRole('heading', { name })).toBeVisible();

            await page.goto(`/circles/${circleId}/edit`);
            await page.getByRole('textbox', { name: 'Add permission' }).fill('view_unconfirmed');
            await page.getByRole('button', { name: /^global:view_unconfirmed:member/ }).click();
            await expect(page.getByRole('button', { name: 'Remove permission global:view_unconfirmed:member' })).toBeVisible();

            await asAdmin(api, 'POST', `/circles/${circleId}/members`, { user_id: member.id });

            // The member now has the menu entry, and the page behind it loads.
            await memberPage.reload();
            await unconfirmedLink(memberPage).click();
            await expect(memberPage).toHaveURL('/members/unconfirmed');
            await expect(memberPage.getByRole('heading', { name: 'Unconfirmed user list' })).toBeVisible();
            await expect(memberPage.getByRole('table')).toBeVisible();
            await expect(memberPage.getByRole('alert')).toHaveCount(0);

            // The admin deletes the circle.
            await page.goto(`/circles/${circleId}`);
            await expect(page.getByRole('heading', { name })).toBeVisible();
            await page.getByRole('button', { name: 'Delete circle', exact: true }).click();
            await page.getByRole('alertdialog', { name: 'Deleting circle' }).getByRole('button', { name: 'Delete circle' }).click();
            await expect(page).toHaveURL('/circles');
            expectStatus(await api.call('admin', 'GET', `/api/core/circles/${circleId}`), 404);
            circleId = undefined;

            await memberPage.goto('/dashboard');
            await expect(memberPage.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Bodies' })).toBeVisible();
            await expect(unconfirmedLink(memberPage)).toHaveCount(0);
        } finally {
            if (circleId !== undefined) await asAdmin(api, 'DELETE', `/circles/${circleId}`);
            await memberContext.close();
        }
    });
});
