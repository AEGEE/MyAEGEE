// The top bar and the footer around every page: logging out, the logo, and the links at the
// bottom of the page.
import { storedTokens } from '../support/auth-helpers.ts';
import { ok } from '../support/factories/base.ts';
import { openAccountMenu, openMenu } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { REFRESH_TOKEN, test, expect } from '../support/test.ts';

test.describe('top bar and footer', () => {
    test.beforeEach(async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();
    });

    test('logging out works on this side when core can\'t be reached', async ({ page, api, layout }) => {
        api.on('POST core /logout', { status: 500, json: { success: false, message: 'Database is down' } });

        let account = await openAccountMenu(page, layout);
        await account.getByRole('button', { name: 'Logout' }).click();

        await expect(page).toHaveURL('/login');
        expect(api.callsTo('POST core /logout').map((call) => call.body)).toEqual([{ refresh_token: REFRESH_TOKEN }]);
        expect(await page.evaluate(storedTokens)).toEqual([null, null]);
        account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    });

    test('the logo leads to the dashboard', async ({ page, api, layout }) => {
        api.fallback(mockEverything);

        const account = await openAccountMenu(page, layout);
        await account.getByRole('link', { name: 'MyAEGEE home' }).click();

        await expect(page).toHaveURL('/dashboard');
        await expect(page).toHaveTitle('MyAEGEE | Dashboard');
    });

    test('the footer links to the legal info, the about page and the bug report, and to AEGEE in a new tab', async ({ page }) => {
        const footer = page.getByRole('contentinfo');

        await expect(footer.getByRole('link', { name: 'Legal info' })).toHaveAttribute('href', '/pages/terms-of-service');
        await expect(footer.getByRole('link', { name: 'About MyAEGEE' })).toHaveAttribute('href', '/about');
        await expect(footer.getByRole('link', { name: 'Report a bug!' })).toHaveAttribute('href', '/bug_report');
        for (const name of ['AEGEE-Europe', 'Online Membership System']) {
            const link = footer.getByRole('link', { name });
            await expect(link).toHaveAttribute('target', '_blank');
            await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
        await expect(footer.getByRole('link', { name: 'AEGEE-Europe' })).toHaveAttribute('href', '//aegee.org');
    });

    test.describe('as a superadmin', () => {
        test.use({ session: 'superadmin' });

        test('after logging out the menu offers nothing that needed the member\'s permissions', async ({ page, layout }) => {
            let menu = await openMenu(page, layout);
            await menu.getByRole('button', { name: 'SU listing' }).click();
            await expect(menu.getByRole('link', { name: 'Create SU' })).toBeVisible();

            const account = await openAccountMenu(page, layout);
            await account.getByRole('button', { name: 'Logout' }).click();
            await expect(page).toHaveURL('/login');

            menu = await openMenu(page, layout);
            // The group stays open over the navigation.
            await expect(menu.getByRole('button', { name: 'SU listing' })).toHaveAttribute('aria-expanded', 'true');
            await expect(menu.getByRole('link', { name: 'All Summer Universities' })).toBeVisible();
            await expect(menu.getByRole('link', { name: 'Create SU' })).toHaveCount(0);
        });
    });
});
