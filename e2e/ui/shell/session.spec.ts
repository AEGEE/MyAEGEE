// The logged-in session and the page around every view: the tokens are kept in localStorage
// ('access-token', 'refresh-token') and renewed when the access token expires; the top bar
// shows who is logged in.
import { ok } from '../support/factories/base.ts';
import { openAccountMenu, openMenu } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('session', () => {
    test('an expired access token is renewed once and the requests are retried', async ({ page, api, me, layout }) => {
        let renewed = false;
        const authorised = (headers: Record<string, string>) => headers['x-auth-token'] === 'renewed-access-token';
        api.on('GET core /members/me', ({ headers }) => (authorised(headers) ? { json: ok(me) } : { status: 401, json: { success: false, message: 'Access token expired' } }));
        api.on('GET events /', ({ headers }) => (authorised(headers) || !renewed
            ? { json: ok([]) }
            : { status: 401, json: { success: false, message: 'Access token expired' } }));
        api.on('POST core /renew', ({ body }) => {
            renewed = true;
            expect(body).toEqual({ refresh_token: 'mock-refresh-token' });
            // The app only takes the new access token from the answer and keeps its refresh
            // token. (core also rotates the refresh token on renewal; the app doesn't store it.)
            return { json: { success: true, access_token: 'renewed-access-token' } };
        });

        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('button', { name: 'Alex Member' })).toBeVisible();
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        expect(await page.evaluate(() => [localStorage.getItem('access-token'), localStorage.getItem('refresh-token')]))
            .toEqual(['renewed-access-token', 'mock-refresh-token']);
    });

    test('when the session cannot be renewed, a members-only page sends to the login page', async ({ page, api }) => {
        api.on('GET core /members/me', { status: 401, json: { success: false, message: 'Access token expired' } });
        // What core answers for an unknown or expired refresh token.
        api.on('POST core /renew', { status: 403, json: { success: false, message: 'Token is not found.' } });

        await page.goto('/events/participating');

        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
        expect(await page.evaluate(() => localStorage.getItem('access-token'))).toBeNull();
    });

    test('the account menu shows who is logged in and logs out', async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('button', { name: 'Alex Member' })).toBeVisible();
        await expect(account.getByRole('link', { name: 'See my account' })).toHaveAttribute('href', '/members/me');
        await account.getByRole('button', { name: 'Logout' }).click();

        await expect(page).toHaveURL(/\/login/);
        expect(api.callsTo('POST core /logout').map((call) => call.body)).toEqual([{ refresh_token: 'mock-refresh-token' }]);
        expect(await page.evaluate(() => localStorage.getItem('access-token'))).toBeNull();
    });

    test('the sidebar menu shows the sections a member can use', async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        const menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
        await expect(menu.getByRole('link', { name: 'Login' })).toHaveCount(0);
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('the events list is public', async ({ page, api, layout }) => {
            api.json('GET events /', ok([]));

            await page.goto('/events');

            await expect(page.getByText('No events found.')).toBeVisible();
            await expect(page.getByRole('main').getByRole('link', { name: 'Create event' })).toHaveCount(0);
            const account = await openAccountMenu(page, layout);
            await expect(account.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
        });
    });
});
