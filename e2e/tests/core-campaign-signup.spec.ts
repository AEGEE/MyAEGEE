// Signing up through a campaign, against the real core: an admin creates a campaign that adds
// new members to a body, someone signs up through it, the admin confirms them, and the campaign's
// members page and the body show them. How the pages behave in detail is in the mocked-API suite
// (ui/core/); the signup form itself is tested with the auth pages.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { PASSWORD } from '../support/constants.ts';
import { asAdmin } from '../support/core-data.ts';
import { cellOf, dialog, tableRows, toast } from '../ui/support/shell.ts';

test.describe('signing up through a campaign', () => {
    test('an admin creates a campaign, someone signs up, is confirmed and is in the body', async ({ api, page, otherAntenna }) => {
        const { body } = otherAntenna;
        // Letters only: a surname may have no digits.
        const suffix = Date.now().toString().split('').map((digit) => String.fromCharCode(97 + Number(digit)))
            .join('');
        const url = `e2e-signup-${suffix}`;
        const person = { first_name: 'Sam', last_name: `Signup ${suffix}` };
        const name = `${person.first_name} ${person.last_name}`;
        let campaignId: string | undefined;

        try {
            await loginInBrowser(page, api, 'admin');
            await page.goto('/campaigns/new');
            await page.getByLabel('Name').fill(`E2E signup ${suffix}`);
            await page.getByLabel('Description').fill('Join **us**');
            await page.getByLabel('Campaign URL').fill(url);
            await page.getByLabel('Autojoin body').fill(body.name);
            await page.getByRole('button', { name: new RegExp(`^${body.name}`) }).click();
            await expect(page.getByRole('button', { name: `${body.name} (Click to unset)` })).toBeVisible();
            await page.getByRole('button', { name: 'Save campaign' }).click();
            await expect(toast(page, 'Campaign is saved.')).toBeVisible();
            await expect(page).toHaveURL(/\/campaigns\/\d+$/);
            campaignId = new URL(page.url()).pathname.split('/').at(-1);
            await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'URL', exact: true }) })).toContainText(`/signup/${url}`);
            await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Body', exact: true }) }).getByRole('link', { name: body.name })).toBeVisible();

            const signup = await api.call<Envelope<{ id: number }>>(null, 'POST', `/api/core/signup/${url}`, {
                username: url, email: `${url}@example.com`, password: PASSWORD, ...person, privacy_consent: new Date()
            });
            expectStatus(signup, 200);

            await page.goto('/members/unconfirmed');
            await page.getByRole('textbox', { name: 'Search by name or surname' }).fill(person.last_name);
            const row = tableRows(page.getByRole('table')).filter({ hasText: name });
            await row.getByRole('button', { name: 'Confirm' }).click();
            await dialog(page, 'Confirm user').getByRole('button', { name: 'Confirm user' }).click();
            await expect(toast(page, 'User is confirmed.')).toBeVisible();
            await expect(row).toHaveCount(0);

            await page.goto(`/campaigns/${campaignId}/members`);
            const members = page.getByRole('table');
            const submission = tableRows(members).filter({ hasText: name });
            await expect(await cellOf(members, submission, 'Email confirmed?')).toHaveText('Yes');
            await expect(submission.getByRole('link', { name })).toHaveAttribute('href', `/members/${signup.body.data.id}`);

            await page.goto(`/bodies/${body.id}/members`);
            await expect(tableRows(page.getByRole('table')).filter({ hasText: name })).toBeVisible();
        } finally {
            if (campaignId) {
                // Core would keep who signed up, without their campaign.
                const signedUp = await asAdmin<{ id: number }[]>(api, 'GET', `/campaigns/${campaignId}/members`);
                for (const member of signedUp) {
                    await asAdmin(api, 'DELETE', `/members/${member.id}`);
                }
                await asAdmin(api, 'DELETE', `/campaigns/${campaignId}`);
            }
        }
    });
});
