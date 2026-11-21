// The logged-in session and the page around the migrated views: both apps keep the tokens in
// localStorage ('access-token', 'refresh-token') and renew them the same way, so moving
// between the Vue and the React pages never logs anyone out.
// Runs against Vue and React (@migrated).
import { test, expect } from '../support/test.ts';
import { ok } from '../support/factories.ts';

test.describe('session', { tag: '@migrated' }, () => {
    test('an expired access token is renewed once and the requests are retried', async ({ page, api, me }) => {
        let renewed = false;
        const authorised = (headers: Record<string, string>) => headers['x-auth-token'] === 'renewed-access-token';
        api.on('GET core /members/me', ({ headers }) => (authorised(headers) ? { json: ok(me) } : { status: 401, json: { success: false, message: 'Access token expired' } }));
        api.on('GET events /', ({ headers }) => (authorised(headers) || !renewed
            ? { json: ok([]) }
            : { status: 401, json: { success: false, message: 'Access token expired' } }));
        api.on('POST core /renew', ({ body }) => {
            renewed = true;
            expect(body).toEqual({ refresh_token: 'mock-refresh-token' });
            // core only sends a new access token (core/middlewares/login.js).
            return { json: { success: true, access_token: 'renewed-access-token' } };
        });

        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(page.getByRole('navigation').getByText('Alex Member')).toBeVisible();
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

    test('the navbar shows who is logged in and logs out', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        const navigation = page.getByRole('navigation');
        await navigation.getByText('Alex Member').hover();
        await expect(navigation.getByRole('link', { name: 'See my account' })).toHaveAttribute('href', '/members/me');
        await navigation.getByText('Logout').click();

        await expect(page).toHaveURL(/\/login/);
        expect(api.callsTo('POST core /logout').map((call) => call.body)).toEqual([{ refresh_token: 'mock-refresh-token' }]);
        expect(await page.evaluate(() => localStorage.getItem('access-token'))).toBeNull();
    });

    test('the sidebar menu shows the sections a member can use', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        const sidebar = page.getByRole('complementary');
        await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
        await expect(sidebar.getByRole('link', { name: 'Login' })).toHaveCount(0);
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('the events list is public', async ({ page, api }) => {
            api.json('GET events /', ok([]));

            await page.goto('/events');

            await expect(page.getByText('No events found.')).toBeVisible();
            await expect(page.getByRole('navigation').getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
            await expect(page.getByRole('link', { name: 'Create event' })).toHaveCount(0);
        });
    });
});
