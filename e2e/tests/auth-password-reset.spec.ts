// Resetting a password against the real core and the fake mailer: the mail with the link, the
// new password, and the sessions that end with it.
import { test, expect, expectStatus, mailLink } from '../support/api.ts';
import { freshTokens, logInThroughPage } from '../support/auth-data.ts';
import { PASSWORD } from '../support/constants.ts';

test.describe('resetting a password against core', () => {
    test('the mailed link sets a new password, the old one stops working, and so do the sessions before', async ({ page, api, otherAntenna }) => {
        const { username, email } = otherAntenna.member;
        const before = await freshTokens(api, username);

        await page.goto('/password_reset');
        await page.getByLabel('Email').fill(email);
        await page.getByRole('button', { name: 'Reset password' }).click();
        await expect(page).toHaveURL('/password_confirm');

        const mail = await api.waitForMail({ to: email, template: 'password_reset.html' });
        await page.goto(mailLink(mail));
        await page.getByLabel('Password', { exact: true }).fill('a-new-password-1');
        await page.getByLabel('Password confirmation').fill('a-new-password-1');
        await page.getByRole('button', { name: 'Confirm password' }).click();
        await expect(page).toHaveURL('/login');

        await logInThroughPage(page, username, 'a-new-password-1');
        await expect(page).toHaveURL('/dashboard');

        expectStatus(await api.call(null, 'POST', '/api/core/login', { username, password: PASSWORD }), 403);
        expectStatus(await api.call(null, 'POST', '/api/core/renew', { refresh_token: before.refresh_token }), 403);

        // The link works once.
        await page.goto(mailLink(mail));
        await page.getByLabel('Password', { exact: true }).fill('a-new-password-2');
        await page.getByLabel('Password confirmation').fill('a-new-password-2');
        await page.getByRole('button', { name: 'Confirm password' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Could not change password: Token is invalid.' })).toBeVisible();
    });
});
