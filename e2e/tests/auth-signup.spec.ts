// Signing up through the signup page against the real core and the fake mailer: the mail with
// the confirmation link, confirming, logging in, and what the campaign decides.
import { test, expect, mailLink } from '../support/api.ts';
import { logInThroughPage, newAccount, removeAccount, signUpThroughPage } from '../support/auth-data.ts';
import { asAdmin, createCampaign } from '../support/core-data.ts';

test.describe('signing up against core', () => {
    test('through a campaign of an antenna: the mail, confirming, and the antenna on the dashboard', async ({ page, api, otherAntenna }) => {
        const [campaign, remove] = await createCampaign(api, { autojoinBody: otherAntenna.body.id });
        try {
            const account = newAccount('signup');
            await page.goto(`/signup/${campaign.url}`);
            await expect(page.getByRole('heading', { name: `Register on MyAEGEE for ${otherAntenna.body.name}` })).toBeVisible();

            await signUpThroughPage(page, account);
            await expect(page).toHaveURL('/confirm_signup');

            const mail = await api.waitForMail({ to: account.email, template: 'confirm_email.html' });
            expect(mail.parameters).toMatchObject({ name: 'Nora', surname: 'Newcomer' });
            await page.goto(mailLink(mail));
            await page.getByRole('button', { name: 'Confirm your email' }).click();
            await expect(page).toHaveURL('/login');

            await logInThroughPage(page, account.username);
            await expect(page).toHaveURL('/dashboard');
            await expect(page.getByRole('main').getByText(otherAntenna.body.name).first()).toBeVisible();
        } finally {
            await remove();
        }
    });

    test('through the default campaign: confirmed, but sent to join a local first', async ({ page, api }) => {
        const account = newAccount('default');
        try {
            await page.goto('/signup/default');
            await signUpThroughPage(page, account);
            await expect(page).toHaveURL('/confirm_signup');

            const mail = await api.waitForMail({ to: account.email, template: 'confirm_email.html' });
            await page.goto(mailLink(mail));
            await page.getByRole('button', { name: 'Confirm your email' }).click();
            await expect(page).toHaveURL('/login');

            await logInThroughPage(page, account.email);
            await expect(page).toHaveURL('/profile/update');
            await expect(page.getByRole('listitem').filter({ hasText: 'You should be a member of at least 1 local.' })).toBeVisible();
        } finally {
            await removeAccount(api, account.username)();
        }
    });

    test('a confirmation link works once', async ({ page, api }) => {
        const [campaign, remove] = await createCampaign(api);
        try {
            const account = newAccount('once');
            await page.goto(`/signup/${campaign.url}`);
            await signUpThroughPage(page, account);
            const link = mailLink(await api.waitForMail({ to: account.email, template: 'confirm_email.html' }));

            await page.goto(link);
            await page.getByRole('button', { name: 'Confirm your email' }).click();
            await expect(page).toHaveURL('/login');

            await page.goto(link);
            await page.getByRole('button', { name: 'Confirm your email' }).click();
            await expect(page.getByRole('alert').filter({ hasText: 'The token is invalid.' })).toBeVisible();
        } finally {
            await remove();
        }
    });

    test('a campaign that is no longer active says it is closed', async ({ page, api }) => {
        const [campaign, remove] = await createCampaign(api);
        try {
            await asAdmin(api, 'PUT', `/campaigns/${campaign.id}`, { active: false });

            await page.goto(`/signup/${campaign.url}`);

            await expect(page.getByText('This registration campaign is closed.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
        } finally {
            await remove();
        }
    });
});
