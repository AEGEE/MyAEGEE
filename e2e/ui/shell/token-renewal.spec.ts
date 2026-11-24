// What the app does with its tokens on every request: the access token goes along, an answer
// 401 renews the session once (`POST core /renew`) and repeats the request, and a session that
// can't be renewed ends on the login page. The renewal without a new refresh token is in
// session.spec.ts.
import type { Page } from '@playwright/test';

import { storedTokens, UNAUTHORIZED } from '../support/auth-helpers.ts';
import { tokens } from '../support/factories/auth.ts';
import { forbidden, ok } from '../support/factories/base.ts';
import { openAccountMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { ACCESS_TOKEN, REFRESH_TOKEN, test, expect } from '../support/test.ts';

// What events, statutory and summeruniversity answer a request that needs a login when the
// access token is no longer valid. (Their public lists answer it as a visitor instead.)
const NOT_AUTHENTICATED = { success: false, message: 'Error fetching data: user is not authenticated.' };

const SESSION_ENDED = 'Your session has ended. Please log in again. Changes that were not saved are lost.';

// The page has received the answer for `path` and had the chance to act on it: the browser
// records a resource once its answer has arrived in the page, and two frames later the app's
// handlers and Vue's re-render have run.
const pageHasHandled = async (page: Page, path: string): Promise<void> => {
    await page.waitForFunction((part) => performance.getEntriesByType('resource').some((entry) => entry.name.includes(part)), path);
    await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
};

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
            // Made up: core answers a failed login with 403, never with 401. The app still treats
            // a 401 on the login page specially (there is no page to go back to), and only an
            // invented answer reaches that case.
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
        api.on('GET events /mine/participating', ({ headers }) => (withRenewedToken(headers) ? { json: ok([]) } : { status: 401, json: NOT_AUTHENTICATED }));
        api.json('POST core /renew', renewed);

        await page.goto('/events/participating');

        await expect(page.getByText('No events found.')).toBeVisible();
        expect(api.callsTo('POST core /renew').map((call) => call.body)).toEqual([{ refresh_token: REFRESH_TOKEN }]);
        expect(await page.evaluate(storedTokens)).toEqual([renewed.access_token, renewed.refresh_token]);
    });

    test('several requests refused at once renew the session once, and are all repeated', async ({ page, api }) => {
        // The dashboard asks three services for the member's applications at the same time.
        api.fallback(mockEverything);
        const routes = ['GET events /mine/participating', 'GET summeruniversity /mine/participating', 'GET statutory /mine'] as const;
        for (const route of routes) {
            api.on(route, ({ headers }) => (withRenewedToken(headers) ? { json: ok([]) } : { status: 401, json: NOT_AUTHENTICATED }));
        }
        api.on('POST core /renew', { json: renewed, delayMs: 300 });

        await page.goto('/dashboard');

        await expect.poll(() => routes
            .filter((route) => api.callsTo(route).some((call) => withRenewedToken(call.headers) && call.status === 200))).toHaveLength(3);
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        await expect(toast(page, /Could not/)).toHaveCount(0);
    });

    test('a request refused again after renewing shows the page\'s error and renews no more', async ({ page, api }) => {
        api.on('GET events /mine/participating', { status: 401, json: NOT_AUTHENTICATED });
        api.json('POST core /renew', renewed);

        await page.goto('/events/participating');

        await expect(toast(page, 'Could not fetch events list: Error fetching data: user is not authenticated.')).toBeVisible();
        expect(api.callsTo('GET events /mine/participating').map((call) => call.headers['x-auth-token'])).toEqual([ACCESS_TOKEN, renewed.access_token]);
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        await expect(page).toHaveURL('/events/participating');
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
        api.on('GET events /mine/participating', { status: 401, json: NOT_AUTHENTICATED });
        api.on('POST core /renew', { status: 403, json: forbidden('Token is not found.') });

        await page.goto('/events/participating');

        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
        await expect(page.getByLabel('Email / Username')).toBeVisible();
        expect(await page.evaluate(storedTokens)).toEqual([null, null]);
        expect(api.callsTo('POST core /renew')).toHaveLength(1);
        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    });

    test('a refusal that arrives after the login page is shown shows nothing over it', async ({ page, api }) => {
        // The dashboard asks three services at once; one of them answers late.
        api.fallback(mockEverything);
        api.on('GET events /mine/participating', { status: 401, json: NOT_AUTHENTICATED });
        api.on('GET summeruniversity /mine/participating', { status: 401, json: NOT_AUTHENTICATED });
        api.on('GET statutory /mine', { status: 401, json: NOT_AUTHENTICATED, delayMs: 1500 });
        api.on('POST core /renew', { status: 403, json: forbidden('Token is not found.') });

        await page.goto('/dashboard');
        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/dashboard');
        await expect(page.getByLabel('Email / Username')).toBeVisible();
        await pageHasHandled(page, '/api/statutory/mine');

        await expect(toast(page, /Could not/)).toHaveCount(0);
        await expect(toast(page, SESSION_ENDED)).toHaveCount(1);
        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/dashboard');
    });

    test.describe('with only an access token', () => {
        test.use({ tokens: 'access' });

        test('a request refused without a refresh token ends on the login page', async ({ page, api }) => {
            api.on('GET events /mine/participating', { status: 401, json: NOT_AUTHENTICATED });

            await page.goto('/events/participating');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
            await expect(page.getByLabel('Email / Username')).toBeVisible();
            expect(api.callsTo('POST core /renew')).toEqual([]);
        });

        test('several requests refused at once go to the login page once, with one warning', async ({ page, api }) => {
            // The dashboard asks three services at once, and there is no refresh token: each
            // refusal ends the session on its own.
            api.fallback(mockEverything);
            for (const route of ['GET events /mine/participating', 'GET summeruniversity /mine/participating', 'GET statutory /mine'] as const) {
                api.on(route, { status: 401, json: NOT_AUTHENTICATED });
            }

            await page.goto('/dashboard');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/dashboard');
            await expect(page.getByLabel('Email / Username')).toBeVisible();
            await expect(toast(page, SESSION_ENDED)).toHaveCount(1);
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
            // The session was over before a page opened: nothing was lost, nothing to warn about.
            await expect(toast(page, SESSION_ENDED)).toHaveCount(0);
            // The blank page the browser starts on, the page asked for and the login page.
            expect(await page.evaluate(() => window.history.length)).toBe(3);
        });
    });
});
