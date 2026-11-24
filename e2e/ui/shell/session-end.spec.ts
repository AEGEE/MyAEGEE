// The session ending while a page is open: the member logs out from the account menu, or the
// page gets a 401 that can no longer be renewed. Either way the app forgets the member at once,
// while the page is still on screen, so every page that reads the member has to cope with
// there being none. Each page of the small areas and of the shell ends on the login page,
// without an error in the page (their areas are enforced: a console.error fails the test).
// When the session ends by itself, the page's requests are stopped: no error of the page shows
// over the login page, the progress bar at the top finishes, and the member is told why.
import { FIXED_NOW, ok } from '../support/factories/base.ts';
import { ROUTES, prepareProfile, redirectOf } from '../support/routes.ts';
import { freezeTime, openAccountMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const AREAS = ['auth', 'dashboard', 'static', 'resources', 'network', 'discounts'];

// The pages a logged-in member stays on (the login page sends a member to the dashboard).
const PAGES = ROUTES.filter((route) => AREAS.includes(route.area) && !redirectOf(route) && route.name !== 'oms.login');

// Pages that ask the API nothing once they are open, so no request of theirs can get a 401.
const ASK_NOTHING = [
    'oms.about', 'oms.status', 'oms.bug_report', 'oms.confluence', 'oms.calendar',
    'oms.resources.categories.create', 'oms.discounts.categories.create', 'oms.discounts.create'
];

const SESSION_ENDED = 'Your session has ended. Please log in again. Changes that were not saved are lost.';

const prepare = (route: (typeof PAGES)[number]) => {
    test.use({ session: 'superadmin', area: route.area });

    test.beforeEach(async ({ page, api, me }) => {
        await freezeTime(page);
        mockEverything(api, Date.parse(FIXED_NOW));
        prepareProfile(route, me);
    });
};

for (const route of PAGES) {
    test.describe(`logging out on ${route.name} (${route.url})`, () => {
        prepare(route);

        test('ends on the login page', async ({ page, layout }) => {
            await page.goto(route.url);

            const account = await openAccountMenu(page, layout);
            await account.getByRole('button', { name: 'Logout' }).click();

            await expect(page).toHaveURL('/login');
            await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
            // The member chose to log out: nothing to warn about.
            await expect(toast(page, SESSION_ENDED)).toHaveCount(0);
        });
    });
}

// A 401 only comes from what needs a login: public pages ask the services as a visitor.
for (const route of PAGES.filter((item) => item.auth && !ASK_NOTHING.includes(item.name))) {
    test.describe(`a session that can't be renewed on ${route.name} (${route.url})`, () => {
        prepare(route);

        test('ends on the login page', async ({ page, api, me, myPermissions }) => {
            // Every request of the page answers that the member is not logged in, with each
            // service's own text, and the refresh token is refused too (core's answer for an
            // unknown one). The app already knows the member: it fetched them before the page
            // opened.
            const reason = { optional: 'one answer for every request, whichever services the page asks' };
            // network and discounts
            api.on('* * *', { status: 401, json: { success: false, message: 'Error fetching user: user is not authenticated.' } }, reason);
            for (const service of ['events', 'statutory', 'summeruniversity'] as const) {
                api.on(`* ${service} *`, { status: 401, json: { success: false, message: 'Error fetching data: user is not authenticated.' } }, reason);
            }
            api.on('* core *', { status: 401, json: { success: false, message: 'You are not authorized.' } }, reason);
            const known = { optional: 'asked when the app starts, but not by every page of the app' };
            api.on('GET core /members/me', () => ({ json: ok(me) }), known);
            api.on('GET core /my_permissions', () => ({ json: ok(myPermissions) }), known);
            api.on('POST core /renew', { status: 403, json: { success: false, message: 'Token is not found.' } });

            await page.goto(route.url);

            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === route.url);
            await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
            expect(await page.evaluate(() => localStorage.getItem('refresh-token'))).toBeNull();
            await expect(toast(page, SESSION_ENDED)).toHaveCount(1);
            await expect(toast(page, /Could not|Some error/)).toHaveCount(0);

            // The progress bar at the top counts every request: the stopped ones have ended too,
            // so after going on to another page it finishes.
            await page.getByRole('link', { name: 'Forgot your password?' }).click();
            await expect(page).toHaveURL('/password_reset');
            // eslint-disable-next-line no-restricted-syntax -- the progress bar has no role or name; nprogress renders it as #nprogress
            await expect(page.locator('#nprogress')).toHaveCount(0);
        });
    });
}
