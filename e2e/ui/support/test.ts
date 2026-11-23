// Fixtures of the mocked-API suite (playwright.ui.config.ts).
//
// Every test gets a browser whose /api calls are answered by `api` (an ApiMock), whether the
// test asks for `api` or not, and in every page of its browser context. By default the browser
// is logged in as a regular member (`test.use({ session: 'board' | 'superadmin' | 'anonymous' })`
// to change that), and the test fails when a page throws, calls an endpoint nobody mocked, or
// never calls an endpoint the test did mock.
//
// Every spec runs on a desktop and on a phone viewport (projects `vue` and `vue-mobile`), and
// is written to outlive the framework the pages are built with: it may only rely on what a
// user sees (roles, labels and text), never on CSS classes or component internals.
// See docs/testing/writing-ui-specs.md.
import fs from 'node:fs';
import path from 'node:path';

import { test as base, expect } from '@playwright/test';

import { coverageFixtures, type CoverageFixtures, type CoverageWorkerFixtures } from '../../support/coverage.ts';
import { ApiMock } from './api-mock.ts';
import { isArea, type Area } from './areas.ts';
import { NOW, ok, withNow } from './factories/base.ts';
import { freezeTime } from './shell.ts';
import { allSeedPermissions, body, circle, member, seedPermissions, type Member, type Permission } from './factories/core.ts';

export type Session = 'member' | 'board' | 'superadmin' | 'anonymous';
// Which tokens the browser starts with (the app keeps them in localStorage).
export type Tokens = 'both' | 'access' | 'refresh' | 'none';
export type Frontend = 'vue';
export type Layout = 'desktop' | 'phone';

export const ACCESS_TOKEN = 'mock-access-token';
export const REFRESH_TOKEN = 'mock-refresh-token';

interface Options {
    session: Session;
    // Defaults to 'both', and to 'none' for an anonymous session.
    tokens: Tokens | undefined;
    // Fail the test when the page calls an /api endpoint that no handler answers.
    strictApi: boolean;
    // The area the test belongs to. Defaults to the spec's directory under ui/; the generated
    // smoke and accessibility tests set it to the area of the route they open.
    area: Area | undefined;
    // console.error messages the test expects (see `consoleErrors`).
    allowedConsoleErrors: RegExp[];
    // For the generated smoke and axe tests, which must find the same page on any day: an
    // instant (FIXED_NOW) that the clock of the pages is set to before anything loads, and that
    // the logged-in member is dated from. A behavioural spec calls freezeTime(page) instead.
    now: string | undefined;
}

interface Fixtures {
    frontend: Frontend;
    layout: Layout;
    me: Member | null;
    myPermissions: Permission[];
    api: ApiMock;
    pageErrors: Error[];
    consoleErrors: string[];
}

const ANTENNA = { id: 1, name: 'AEGEE-Antenna' };

const PROFILES: Record<Exclude<Session, 'anonymous'>, () => Member> = {
    member: () => member({ id: 2, username: 'member', first_name: 'Alex', last_name: 'Member', bodies: [body(ANTENNA)] }),
    // On the board of body 1: a member of its board circle.
    board: () => member({
        id: 3,
        username: 'board',
        first_name: 'Bea',
        last_name: 'Board',
        bodies: [body(ANTENNA)],
        circles: [circle({ id: 10, name: 'Board AEGEE-Antenna', body_id: ANTENNA.id })]
    }),
    superadmin: () => member({ id: 1, username: 'admin', first_name: 'Ada', last_name: 'Admin', superadmin: true, bodies: [body(ANTENNA)] })
};

// What core answers on GET /my_permissions for the seeded users (core/scripts/seed.js): the
// global permissions of their circles, and every permission for a superadmin.
const PERMISSIONS: Record<Session, () => Permission[]> = {
    anonymous: () => [],
    member: () => seedPermissions('membersCircle'),
    board: () => seedPermissions('membersCircle', 'boardCircle'),
    superadmin: () => allSeedPermissions()
};

// How long a test that reached its end waits for the requests of handlers that nothing has
// asked for yet, before it fails for them. A request can leave the page after the last
// assertion of the test: the page sends it after a render, a debounce or a timer, and under
// load the browser gets to it late. The wait is the time every assertion of the suite gets
// (`expect.timeout` of playwright.ui.config.ts): what would have passed as
// `await expect.poll(() => api.callsTo(route)).not.toEqual([])` passes without writing it.
// Only a test with a handler nobody used waits; all others end at once.
const UNUSED_GRACE_MS = 5000;
// What the rest of the teardown gets of the test's time limit, so a test that ends just before
// its limit still fails with the list of handlers instead of with a timeout.
const TEARDOWN_MARGIN_MS = 1000;

// Whether the coverage gate of an area is enforced (ui/support/coverage/<area>.json). An
// enforced area is finished: its pages may not log errors any more.
const isEnforced = (area: Area | undefined): boolean => {
    if (!area) return false;
    const file = path.join(import.meta.dirname, 'coverage', `${area}.json`);
    return fs.existsSync(file) && (JSON.parse(fs.readFileSync(file, 'utf8')) as { gate?: string }).gate === 'enforced';
};

export const test = base.extend<Options & Fixtures & CoverageFixtures, CoverageWorkerFixtures>({
    ...coverageFixtures('mocked'),

    session: ['member', { option: true }],
    tokens: [undefined, { option: true }],
    strictApi: [true, { option: true }],
    area: [undefined, { option: true }],
    allowedConsoleErrors: [[], { option: true }],
    now: [undefined, { option: true }],

    // eslint-disable-next-line no-empty-pattern -- Playwright wants the fixtures destructured, and this one needs none
    frontend: async ({}, use, testInfo) => {
        await use((testInfo.project.metadata.frontend ?? 'vue') as Frontend);
    },

    // What the viewport of the project is like. The helpers of ui/support/shell.ts take it
    // where the steps differ (menus, sorting); specs don't branch on it themselves.
    // eslint-disable-next-line no-empty-pattern -- Playwright wants the fixtures destructured, and this one needs none
    layout: async ({}, use, testInfo) => {
        await use((testInfo.project.metadata.layout ?? 'desktop') as Layout);
    },

    // Logged in the way the app stores it: both tokens in localStorage, from the first page of
    // the context on. Storage state is set once, when the context is made, so what the app does
    // to the tokens later (renewing them, logging out) is kept over page loads and new pages.
    storageState: async ({ session, tokens, baseURL }, use) => {
        const stored = tokens ?? (session === 'anonymous' ? 'none' : 'both');
        const localStorage = [
            ...(stored === 'both' || stored === 'access' ? [{ name: 'access-token', value: ACCESS_TOKEN }] : []),
            ...(stored === 'both' || stored === 'refresh' ? [{ name: 'refresh-token', value: REFRESH_TOKEN }] : [])
        ];
        await use({ cookies: [], origins: localStorage.length ? [{ origin: new URL(baseURL!).origin, localStorage }] : [] });
    },

    // The logged-in member. A test may change it before going to a page (it is read when the
    // page asks for it), for example `me!.privacy_consent = null` for an incomplete profile.
    me: async ({ session, now }, use) => {
        await use(session === 'anonymous' ? null : withNow(now ? Date.parse(now) : NOW, PROFILES[session]));
    },

    myPermissions: async ({ session }, use) => {
        await use(PERMISSIONS[session]());
    },

    // Automatic: a test that takes only `{ page }` gets the mock, the session and the checks
    // below all the same. It answers on the browser context, so a second page or a popup of the
    // test is covered as well.
    api: [async ({ context, me, myPermissions, strictApi, now }, use, testInfo) => {
        const api = new ApiMock();
        if (now) await freezeTime(context, now);

        // What every page asks for. Nothing has to call them: not every test goes to a page.
        const optional = { optional: 'asked by every page, but not every test opens one' };
        if (me) {
            // Read the variables at request time, so a test can change them before going to a page.
            api.on('GET core /members/me', () => ({ json: ok(me) }), optional);
            api.on('GET core /my_permissions', () => ({ json: ok(myPermissions) }), optional);
        } else {
            api.on('GET core /members/me', { status: 401, json: { success: false, message: 'Unauthorized' } }, optional);
        }
        api.json('POST core /logout', { success: true }, optional);

        await api.install(context);
        const startedAt = Date.now();
        await use(api);

        const passed = testInfo.status === testInfo.expectedStatus;
        // Only for a test that got to its end: one that stopped half-way didn't make all its
        // requests. The pages are still open here, and a request they have not sent yet counts
        // (see UNUSED_GRACE_MS), so this comes before the list of unanswered requests is read.
        const left = testInfo.timeout === 0 ? UNUSED_GRACE_MS : testInfo.timeout - (Date.now() - startedAt) - TEARDOWN_MARGIN_MS;
        const grace = Math.max(0, Math.min(UNUSED_GRACE_MS, left));
        const unused = passed ? await api.stillUnused(grace) : api.unused;
        const unhandled = api.unhandled.map((call) => (call.service === 'url' ? `${call.method} ${call.path}` : `${call.method} /api/${call.service}${call.path}`));
        if (!passed) {
            // Shown with the failure in the report, whatever the test's settings are.
            if (unhandled.length) await testInfo.attach('requests nobody mocked', { body: unhandled.join('\n'), contentType: 'text/plain' });
            if (unused.length) await testInfo.attach('handlers no request matched', { body: unused.join('\n'), contentType: 'text/plain' });
        }
        // Also for a test that failed already: a forgotten mock is the usual reason for an
        // assertion that timed out, and this puts the list next to that failure.
        if (strictApi) {
            expect(unhandled, passed ? 'requests nobody mocked' : 'requests nobody mocked (a likely reason for the failure above)').toEqual([]);
        }
        if (passed) {
            expect(unused, 'handlers that no request matched: a typo in the route, or the page no longer asks. If that is expected, say why: api.on(route, answer, { optional: \'<reason>\' })').toEqual([]);
        }
    }, { auto: true }],

    // Uncaught errors in any page of the test.
    pageErrors: [async ({ context }, use) => {
        const errors: Error[] = [];
        context.on('weberror', (webError) => errors.push(webError.error()));
        await use(errors);
        expect(errors.map((error) => error.message), 'uncaught errors in the page').toEqual([]);
    }, { auto: true }],

    // What the page wrote with console.error. Vue reports errors in render functions, watchers
    // and lifecycle hooks this way; they never reach `pageErrors`. Once an area's coverage gate
    // is enforced they fail its tests; until then they are only noted on the test.
    // A test that expects one: `test.use({ allowedConsoleErrors: [/Network Error/] })`.
    consoleErrors: [async ({ context, area, allowedConsoleErrors }, use, testInfo) => {
        const errors: string[] = [];
        context.on('console', (message) => {
            if (message.type() !== 'error') return;
            const text = message.text();
            // The browser's own line for every request that fails or is answered with an error
            // status. Tests mock those on purpose; what the page does with them is what counts.
            if (text.startsWith('Failed to load resource')) return;
            errors.push(text);
        });
        await use(errors);

        const unexpected = errors.filter((text) => !allowedConsoleErrors.some((allowed) => allowed.test(text)));
        if (!unexpected.length) return;
        const [directory] = path.relative(path.join(import.meta.dirname, '..'), testInfo.file).split(path.sep);
        if (isEnforced(area ?? (isArea(directory) ? directory : undefined))) {
            expect(unexpected, 'console.error in the page').toEqual([]);
        } else {
            testInfo.annotations.push({ type: 'console.error', description: unexpected.join('\n').slice(0, 2000) });
        }
    }, { auto: true }]
});

export { expect };
