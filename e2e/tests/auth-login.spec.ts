// Logging in through the login page against the real core: the tokens core gives, its
// messages, the renewal of an expired session and logging out.
import { test, expect, expectStatus } from '../support/api.ts';
import { freshTokens, logInThroughPage, newAccount, signUpThroughApi, storedTokens } from '../support/auth-data.ts';
import { PASSWORD } from '../support/constants.ts';
import { createCampaign } from '../support/core-data.ts';

test.describe('logging in against core', () => {
    test('with the username, and with the email, keeping both tokens', async ({ page, otherAntenna }) => {
        const { username, email } = otherAntenna.member;

        await page.goto('/login?to=/events/participating');
        await logInThroughPage(page, username);
        await expect(page).toHaveURL('/events/participating');
        const [access, refresh] = await storedTokens(page);
        expect(access).toBeTruthy();
        expect(refresh).toBeTruthy();

        await page.evaluate(() => localStorage.clear());
        await page.goto('/login');
        await logInThroughPage(page, email.toUpperCase());
        await expect(page).toHaveURL('/dashboard');
        expect((await storedTokens(page))[0]).not.toBe(access);
    });

    test('core\'s messages reach the page: one for a wrong name or password, one for an unconfirmed address', async ({ page, api, otherAntenna }) => {
        await page.goto('/login');

        await logInThroughPage(page, otherAntenna.member.username, 'not-the-password');
        await expect(page.getByRole('alert').filter({ hasText: 'Username or password is not valid.' })).toBeVisible();

        await logInThroughPage(page, 'e2e-nobody-has-this-name');
        await expect(page.getByRole('alert').filter({ hasText: 'Username or password is not valid.' })).toBeVisible();

        const [campaign, remove] = await createCampaign(api);
        try {
            const account = newAccount('unconfirmed');
            await signUpThroughApi(api, campaign.url, account);
            await logInThroughPage(page, account.username);
            await expect(page.getByRole('alert').filter({ hasText: 'Please confirm your mail first.' })).toBeVisible();
        } finally {
            await remove();
        }
        await expect(page).toHaveURL('/login');
    });

    test('a session core no longer knows ends on the login page, says so, and the progress bar finishes', async ({ page, otherAntenna }) => {
        await page.goto('/login');
        await logInThroughPage(page, otherAntenna.member.username);
        await expect(page).toHaveURL('/dashboard');

        // Tokens core doesn't know: it refuses to renew them (403), so the session is over.
        await page.evaluate(() => {
            localStorage.setItem('access-token', 'an-access-token-core-does-not-know');
            localStorage.setItem('refresh-token', 'a-refresh-token-core-does-not-know');
        });
        const menu = page.getByRole('navigation', { name: 'Main menu' });
        await menu.getByRole('button', { name: 'Events listing' }).click();
        await menu.getByRole('link', { name: 'Participating', exact: true }).click();

        await expect(page).toHaveURL('/login?to=%2Fevents%2Fparticipating');
        await expect(page.getByRole('alert').filter({ hasText: 'Your session has ended. Please log in again. Changes that were not saved are lost.' })).toBeVisible();
        await expect(page.getByRole('alert').filter({ hasText: /Could not/ })).toHaveCount(0);

        // The bar at the top counts every request; one that the app stopped must count as ended.
        await page.getByRole('link', { name: 'Forgot your password?' }).click();
        await expect(page).toHaveURL('/password_reset');
        // eslint-disable-next-line no-restricted-syntax -- the progress bar has no role or name; nprogress renders it as #nprogress
        await expect(page.locator('#nprogress')).toHaveCount(0);
    });

    test('an expired access token is renewed with core, which rotates the refresh token', async ({ page, api, otherAntenna }) => {
        const { username } = otherAntenna.member;
        const tokens = await freshTokens(api, username);
        await page.addInitScript((refreshToken) => {
            // Only once, for the first page: what the app stores afterwards has to stay.
            if (sessionStorage.getItem('e2e-tokens-set')) return;
            sessionStorage.setItem('e2e-tokens-set', '1');
            localStorage.setItem('access-token', 'an-access-token-core-does-not-know');
            localStorage.setItem('refresh-token', refreshToken);
        }, tokens.refresh_token);

        await page.goto('/events/participating');

        await expect(page).toHaveURL('/events/participating');
        await expect(page.getByRole('button', { name: `${otherAntenna.member.first_name} ${otherAntenna.member.last_name}` })).toBeVisible();
        const [access, refresh] = await storedTokens(page);
        expect(access).not.toBe('an-access-token-core-does-not-know');
        expect(refresh).not.toBe(tokens.refresh_token);
        // The stored tokens are the ones core knows now.
        const me = await api.request.get('/api/core/members/me', { headers: { 'X-Auth-Token': access! } });
        expect(me.status()).toBe(200);
    });

    test('logging out makes core forget the refresh token', async ({ page, api, otherAntenna }) => {
        await page.goto('/login');
        await logInThroughPage(page, otherAntenna.member.username, PASSWORD);
        await expect(page).toHaveURL('/dashboard');
        const [, refresh] = await storedTokens(page);

        await page.getByRole('button', { name: `${otherAntenna.member.first_name} ${otherAntenna.member.last_name}` }).click();
        await page.getByRole('button', { name: 'Logout' }).click();
        await expect(page).toHaveURL('/login');

        expect(await storedTokens(page)).toEqual([null, null]);
        expectStatus(await api.call(null, 'POST', '/api/core/renew', { refresh_token: refresh }), 403);
    });
});
