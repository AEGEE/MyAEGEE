// What the app does with its tokens on every request: the access token goes along, an answer
// 401 renews the session once (`POST core /renew`) and repeats the request, and a session that
// can't be renewed ends on the login page. The renewal without a new refresh token is in
// session.spec.ts.
import { storedTokens, UNAUTHORIZED } from '../support/auth-helpers.ts';
import { tokens } from '../support/factories/auth.ts';
import { forbidden, ok } from '../support/factories/base.ts';
import { openAccountMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { ACCESS_TOKEN, REFRESH_TOKEN, test, expect } from '../support/test.ts';

const renewed = tokens({ access_token: 'renewed-access-token', refresh_token: 'renewed-refresh-token' });
const withRenewedToken = (headers: Record<string, string>): boolean => headers['x-auth-token'] === renewed.access_token;

test.describe('tokens and their renewal', () => {
    test('every request carries the stored access token', async ({ page, api }) => {
        api.json('GET events /', ok([]));

        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        expect(api.callsTo('GET events /').map((call) => call.headers['x-auth-token'])).toEqual([ACCESS_TOKEN]);
        expect(api.callsTo('GET core /members/me').map((call) => call.headers['x-auth-token'])).toEqual([ACCESS_TOKEN]);
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('a visitor\'s requests carry no token', async ({ page, api }) => {
            api.json('GET events /', ok([]));

            await page.goto('/events');

            await expect(page.getByText('No events found.')).toBeVisible();
            expect(api.callsTo('GET events /').map((call) => call.headers['x-auth-token'])).toEqual([undefined]);
        });

        test('an answer 401 on the login page stays there, without a page to go back to', async ({ page, api }) => {
            api.on('POST core /login', { status: 401, json: UNAUTHORIZED });
            await page.goto('/login');

            await page.getByLabel('Email / Username').fill('member');
            await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
            await page.getByRole('button', { name: 'Login', exact: true }).click();

            await expect(page.getByRole('alert').filter({ hasText: 'You are not authorized.' })).toBeVisible();
            await expect(page).toHaveURL('/login');
            expect(api.callsTo('POST core /renew')).toEqual([]);
        });
    });

    test('a renewal that brings a new refresh token keeps it', async ({ page, api }) => {
        api.on('GET events /', ({ headers }) => (withRenewedToken(headers) ? { json: ok([]) } : { status: 401, json: UNAUTHORIZED }));
        api.json('POST core /renew', renewed);

        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        expect(api.callsTo('POST core /renew').map((call) => call.body)).toEqual([{ refresh_token: REFRESH_TOKEN }]);
        expect(await page.evaluate(storedTokens)).toEqual([renewed.access_token, renewed.refresh_token]);
    });

    test('several requests refused at once renew the session once, and are all repeated', async ({ page, api }) => {
        // The calendar asks three services at the same time.
        api.fallback(mockEverything);
        for (const route of ['GET events /', 'GET summeruniversity /', 'GET statutory /'] as const) {
            api.on(route, ({ headers }) => (withRenewedToken(headers) ? { json: ok([]) } : { status: 401, json: UNAUTHORIZED }));
        }
        api.on('POST core /renew', { json: renewed, delayMs: 300 });

        await page.goto('/calendar');

        await expect.poll(() => ['GET events /', 'GET summeruniversity /', 'GET statutory /']
            .filter((route) => api.callsTo(route).some((call) => withRenewedToken(call.headers) && call.status === 200))).toHaveLength(3);
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        await expect(toast(page, /Could not load/)).toHaveCount(0);
    });

    test('a request refused again after renewing shows the page\'s error and renews no more', async ({ page, api }) => {
        api.on('GET events /', { status: 401, json: UNAUTHORIZED });
        api.json('POST core /renew', renewed);

        await page.goto('/events');

        await expect(toast(page, 'Could not fetch events list: You are not authorized.')).toBeVisible();
        expect(api.callsTo('GET events /').map((call) => call.headers['x-auth-token'])).toEqual([ACCESS_TOKEN, renewed.access_token]);
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        await expect(page).toHaveURL('/events');
    });

    test('a server error is no reason to renew the session', async ({ page, api }) => {
        api.on('GET events /', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/events');

        await expect(toast(page, 'Could not fetch events list: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/events');
        expect(api.callsTo('POST core /renew')).toEqual([]);
    });

    test('a network error is no reason to renew the session', async ({ page, api }) => {
        api.on('GET events /', { abort: 'failed' });

        await page.goto('/events');

        await expect(toast(page, 'Could not fetch events list: Network Error')).toBeVisible();
        await expect(page).toHaveURL('/events');
        expect(api.callsTo('POST core /renew')).toEqual([]);
    });

    test('a session that can\'t be renewed any more ends on the login page and forgets the member', async ({ page, api, layout }) => {
        api.on('GET events /', { status: 401, json: UNAUTHORIZED });
        api.on('POST core /renew', { status: 403, json: forbidden('Token is not found.') });

        await page.goto('/events');

        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events');
        await expect(page.getByLabel('Email / Username')).toBeVisible();
        expect(await page.evaluate(storedTokens)).toEqual([null, null]);
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    });

    test.describe('with only an access token', () => {
        test.use({ tokens: 'access' });

        test('a request refused on a public page ends on the login page', async ({ page, api }) => {
            api.on('GET events /', { status: 401, json: UNAUTHORIZED });

            await page.goto('/events');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events');
            await expect(page.getByLabel('Email / Username')).toBeVisible();
            expect(api.callsTo('POST core /renew')).toEqual([]);
        });

        test('a members-only page that finds the session gone sends to the login page once', async ({ page, api }) => {
            api.on('GET core /members/me', { status: 401, json: UNAUTHORIZED });
            // The events list behind the login page would be a second, wrong way there.
            api.fallback(mockEverything);

            await page.goto('/events/participating');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
            await expect(page).toHaveTitle('MyAEGEE | Login');
            expect(api.callsTo('POST core /renew')).toEqual([]);
            // The blank page the browser starts on, the page asked for and the login page.
            expect(await page.evaluate(() => window.history.length)).toBe(3);
        });
    });
});
