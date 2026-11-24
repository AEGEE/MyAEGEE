// Changing the login email against the real core and the fake mailer: the mail to the new
// address, confirming it through its link, and the profile with the new address.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, loginInBrowser, mailLink } from '../support/api.ts';
import { newAccount } from '../support/auth-data.ts';

test.describe('changing the login email against core', () => {
    test('the link mailed to the new address changes it, once', async ({ page, api, otherAntenna }) => {
        const { member } = otherAntenna;
        const newEmail = newAccount('changed').email;
        expectStatus(await api.call(member.username, 'PUT', `/api/core/members/${member.id}/email`, { new_email: newEmail }), 200);
        const mail = await api.waitForMail({ to: newEmail, template: 'mail_change.html' });

        await loginInBrowser(page, api, member.username);
        await page.goto(mailLink(mail));
        await page.getByRole('button', { name: 'Confirm email change' }).click();

        await expect(page.getByRole('alert').filter({ hasText: 'Mail was changed successfully.' })).toBeVisible();
        await expect(page).toHaveURL('/members/me');
        const me = await api.call<Envelope<{ email: string }>>(member.username, 'GET', '/api/core/members/me');
        expect(me.body.data.email).toBe(newEmail);

        await page.goto(mailLink(mail));
        await page.getByRole('button', { name: 'Confirm email change' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'The token is invalid or expired.' })).toBeVisible();
    });
});
