// Where the app lets a visitor or a member go: members-only pages send visitors to the login
// page and back, unknown paths go to the dashboard, and a member whose profile is incomplete is
// sent to complete it first. Who is logged in is asked for (`GET core /members/me` with
// `X-For-Auth`) on the first page load, and again only where it matters.
import type { Page } from '@playwright/test';

import { answerLogin, UNAUTHORIZED } from '../support/auth-helpers.ts';
import { ok } from '../support/factories/base.ts';
import { body, circle } from '../support/factories/core.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { openAccountMenu } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// The requests with which the app asks who is logged in (not those of a page that shows the
// member's profile).
const userFetches = (api: ApiMock) => api.callsTo('GET core /members/me').filter((call) => call.headers['x-for-auth'] === 'true');

const toParameter = (page: Page): string | null => new URL(page.url()).searchParams.get('to');

const logIn = async (page: Page): Promise<void> => {
    await page.getByLabel('Email / Username').fill('member');
    await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
};

test.describe('where the app lets visitors and members go', () => {
    test.beforeEach(({ api }) => {
        // The pages the tests end on belong to other areas.
        api.fallback(mockEverything);
    });

    test('an unknown path sends a member to the dashboard', async ({ page, api }) => {
        await page.goto('/no-such-page');

        await expect(page).toHaveURL('/dashboard');
        await expect(page).toHaveTitle('MyAEGEE | Dashboard');
        expect(userFetches(api)).toHaveLength(1);
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(1);
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('an unknown path sends a visitor to log in, and on to the dashboard', async ({ page, api }) => {
            await page.goto('/no-such-page');

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/dashboard');
            await expect(page).toHaveTitle('MyAEGEE | Login');
            // Without a token nobody is asked who is logged in.
            expect(api.callsTo('GET core /members/me')).toEqual([]);
        });

        test('a members-only page sends a visitor to log in and back there afterwards', async ({ page, api }) => {
            answerLogin(api);
            await page.goto('/events/participating');
            await expect(page).toHaveURL((url) => url.pathname === '/login');
            expect(toParameter(page)).toBe('/events/participating');

            await logIn(page);

            await expect(page).toHaveURL('/events/participating');
            await expect(page).toHaveTitle('MyAEGEE | List events I\'m participating at');
            expect(userFetches(api)).toHaveLength(1);
        });

        test('the page a visitor is sent back to keeps its own query string', async ({ page, api }) => {
            answerLogin(api);
            await page.goto('/events/participating?a=1&b=2');
            await expect(page).toHaveURL((url) => url.pathname === '/login');
            expect(toParameter(page)).toBe('/events/participating?a=1&b=2');

            await logIn(page);

            await expect(page).toHaveURL('/events/participating?a=1&b=2');
        });

        test('a login link that names the page to go back to twice goes on to the dashboard', async ({ page, api }) => {
            answerLogin(api);
            await page.goto('/login?to=/events&to=/calendar');

            await logIn(page);

            await expect(page).toHaveURL('/dashboard');
            await expect(page).toHaveTitle('MyAEGEE | Dashboard');
        });

        test('a public page opens without asking who is logged in', async ({ page, api }) => {
            await page.goto('/events');

            await expect(page).toHaveTitle('MyAEGEE | List all events');
            await expect(page.getByRole('heading', { name: 'Events list' })).toBeVisible();
            expect(api.callsTo('GET core /members/me')).toEqual([]);
        });

        test('logging in from a link elsewhere asks who is logged in once, after the login', async ({ page, api, layout }) => {
            answerLogin(api);
            await page.goto('/events');
            const account = await openAccountMenu(page, layout);
            await account.getByRole('link', { name: 'Login', exact: true }).click();
            await expect(page).toHaveURL('/login');
            expect(api.callsTo('GET core /members/me')).toEqual([]);

            await logIn(page);

            await expect(page).toHaveURL('/dashboard');
            expect(userFetches(api)).toHaveLength(1);
        });
    });

    test.describe('with a session core no longer knows', () => {
        // Only an access token, which core answers with 401: there is nothing to renew it with.
        test.use({ tokens: 'access' });

        test.beforeEach(({ api }) => {
            api.on('GET core /members/me', { status: 401, json: UNAUTHORIZED });
        });

        test('a public page opens anonymously', async ({ page, api, layout }) => {
            await page.goto('/events');

            await expect(page).toHaveURL('/events');
            await expect(page.getByRole('heading', { name: 'Events list' })).toBeVisible();
            const account = await openAccountMenu(page, layout);
            await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
            expect(userFetches(api)).toHaveLength(1);
        });

        test('going on to another public page doesn\'t ask again', async ({ page, api }) => {
            await page.goto('/events');
            await expect(page.getByRole('heading', { name: 'Events list' })).toBeVisible();

            await page.getByRole('link', { name: 'About MyAEGEE' }).click();

            await expect(page).toHaveURL('/about');
            await expect(page).toHaveTitle('MyAEGEE | About MyAEGEE');
            expect(userFetches(api)).toHaveLength(1);
        });

        test('going on to a members-only page asks again, and sends to log in', async ({ page, api }) => {
            api.json('GET core /bodies/:id', ok({ ...body({ id: 1, name: 'AEGEE-Antenna' }), circles: [circle({ id: 7, name: 'Local board', body_id: 1 })] }));
            await page.goto('/bodies/1');
            await expect(page.getByRole('link', { name: 'Local board' })).toBeVisible();
            expect(userFetches(api)).toHaveLength(1);

            await page.getByRole('link', { name: 'Local board' }).click();

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/circles/7');
            expect(userFetches(api)).toHaveLength(2);
        });
    });

    test('opening the login page with a session goes on to the page asked for, or to the dashboard', async ({ page }) => {
        await page.goto('/login?to=/events');
        await expect(page).toHaveURL('/events');
        await expect(page).toHaveTitle('MyAEGEE | List all events');

        await page.goto('/login');
        await expect(page).toHaveURL('/dashboard');
    });

    test('opening the login page with a session and two pages to go back to goes to the dashboard', async ({ page }) => {
        await page.goto('/login?to=/events&to=/calendar');

        await expect(page).toHaveURL('/dashboard');
        await expect(page).toHaveTitle('MyAEGEE | Dashboard');
    });

    test('a target outside the app is never followed', async ({ page }) => {
        for (const target of ['//example.org', '/\\example.org', 'https://example.org']) {
            await page.goto(`/login?to=${encodeURIComponent(target)}`);
            await expect(page).toHaveURL('/dashboard');
        }
    });

    test.describe('a member whose profile is incomplete', () => {
        const reasons = [
            { what: 'an address of AEGEE itself', change: { email: 'made-up-alex@aegee.org' }, reason: 'Your email can not be in one of the following domains: aegee.org, aegee.eu.' },
            { what: 'an address on a subdomain of AEGEE', change: { email: 'made-up-alex@lists.aegee.eu' }, reason: 'Your email can not be in one of the following domains: aegee.org, aegee.eu.' },
            { what: 'no local', change: { bodies: [body({ type: 'working group' })] }, reason: 'You should be a member of at least 1 local.' },
            { what: 'no consent to the privacy policy', change: { privacy_consent: null }, reason: 'You should agree to the Privacy Policy.' },
            { what: 'a username of numbers only', change: { username: '12345' }, reason: 'Your username cannot consist of numbers only.' }
        ];

        for (const { what, change, reason } of reasons) {
            test(`is sent to complete it first, with ${what}`, async ({ page, me }) => {
                Object.assign(me!, change);

                await page.goto('/events/participating');

                await expect(page).toHaveURL('/profile/update');
                await expect(page.getByRole('listitem').filter({ hasText: reason })).toBeVisible();
            });
        }

        test('with an address on another domain that ends like AEGEE\'s is not', async ({ page, me }) => {
            me!.email = 'made-up-alex@notaegee.org';

            await page.goto('/events/participating');

            await expect(page).toHaveURL('/events/participating');
        });

        test('may open public pages and the page to complete it, also from a link', async ({ page, me, layout }) => {
            me!.privacy_consent = null;

            await page.goto('/calendar');
            await expect(page).toHaveURL('/calendar');
            await expect(page).toHaveTitle('MyAEGEE | Events calendar');

            await page.getByRole('link', { name: 'About MyAEGEE' }).click();
            await expect(page).toHaveURL('/about');

            await page.goto('/profile/update');
            await expect(page).toHaveURL('/profile/update');
            await expect(page.getByRole('listitem').filter({ hasText: 'You should agree to the Privacy Policy.' })).toBeVisible();

            // A members-only page from a link of the app, on a public page, still sends it there.
            await page.getByRole('link', { name: 'About MyAEGEE' }).click();
            await expect(page).toHaveURL('/about');
            const account = await openAccountMenu(page, layout);
            await account.getByRole('link', { name: 'See my account' }).click();
            await expect(page).toHaveURL('/profile/update');
            await expect(page.getByRole('listitem').filter({ hasText: 'You should agree to the Privacy Policy.' })).toBeVisible();
        });

        test.describe('as a superadmin', () => {
            test.use({ session: 'superadmin' });

            test('is let through', async ({ page, me }) => {
                Object.assign(me!, { privacy_consent: null, email: 'made-up-admin@aegee.org', username: '1' });

                await page.goto('/events/participating');

                await expect(page).toHaveURL('/events/participating');
            });
        });
    });

    test('`/members/me` answering without success counts as logged out', async ({ page, api }) => {
        api.json('GET core /members/me', { success: false, message: 'Something is off' });

        await page.goto('/events/participating');

        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
    });

    test('permissions answered without success count as logged out', async ({ page, api }) => {
        api.json('GET core /my_permissions', { success: false, message: 'Something is off' });

        await page.goto('/events/participating');

        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
    });

    test('permissions that can\'t be fetched count as logged out', async ({ page, api, layout }) => {
        api.on('GET core /my_permissions', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/events/participating');

        await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/events/participating');
        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    });

    test('the title of the window and the bar above the page name each page', async ({ page }) => {
        await page.goto('/events');
        await expect(page).toHaveTitle('MyAEGEE | List all events');
        await expect(page.getByRole('main').getByRole('heading', { name: 'List all events' })).toBeVisible();

        await page.getByRole('link', { name: 'About MyAEGEE' }).click();
        await expect(page).toHaveTitle('MyAEGEE | About MyAEGEE');
        await expect(page.getByRole('main').getByRole('heading', { name: 'About MyAEGEE', exact: true })).toBeVisible();
    });
});
