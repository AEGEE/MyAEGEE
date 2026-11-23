// Fixtures of the mocked-API suite (playwright.ui.config.ts).
//
// Every test gets a browser whose /api calls are answered by `api` (an ApiMock). By default the
// browser is logged in as a regular member (`test.use({ session: 'board' | 'superadmin' |
// 'anonymous' })` to change that), and the test fails when the page throws or calls an endpoint
// nobody mocked.
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
import { ok } from './factories/base.ts';
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

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

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

    // Fonts and map tiles come from the internet; the tests don't need them. A test that needs
    // an answer from another host gives one with `api.url()`.
    context: async ({ context }, use) => {
        await context.route((requestUrl) => !LOCAL_HOSTS.includes(requestUrl.hostname), (route) => route.abort());
        await use(context);
    },

    // The logged-in member. A test may change it before going to a page (it is read when the
    // page asks for it), for example `me!.privacy_consent = null` for an incomplete profile.
    me: async ({ session }, use) => {
        await use(session === 'anonymous' ? null : PROFILES[session]());
    },

    myPermissions: async ({ session }, use) => {
        await use(PERMISSIONS[session]());
    },

    api: async ({ page, me, myPermissions, session, tokens, strictApi }, use, testInfo) => {
        const api = new ApiMock();

        const stored = tokens ?? (session === 'anonymous' ? 'none' : 'both');
        if (stored !== 'none') {
            // Logged in the way the app stores it. Only on the first page load: init scripts run
            // on every load, and a full page load (after logging out, say) must keep what the app
            // did to the tokens.
            await page.addInitScript(([access, refresh]) => {
                if (window.sessionStorage.getItem('mock-session')) return;
                window.sessionStorage.setItem('mock-session', 'set');
                if (access) window.localStorage.setItem('access-token', access);
                if (refresh) window.localStorage.setItem('refresh-token', refresh);
            }, [stored === 'refresh' ? null : ACCESS_TOKEN, stored === 'access' ? null : REFRESH_TOKEN]);
        }

        if (me) {
            // Read the variables at request time, so a test can change them before going to a page.
            api.on('GET core /members/me', () => ({ json: ok(me) }));
            api.on('GET core /my_permissions', () => ({ json: ok(myPermissions) }));
        } else {
            api.on('GET core /members/me', { status: 401, json: { success: false, message: 'Unauthorized' } });
        }
        api.json('POST core /logout', { success: true });

        await api.install(page);
        await use(api);

        if (strictApi && testInfo.status === testInfo.expectedStatus) {
            const unhandled = api.unhandled.map((call) => (call.service === 'url' ? `${call.method} ${call.path}` : `${call.method} /api/${call.service}${call.path}`));
            expect(unhandled, 'requests nobody mocked').toEqual([]);
        }
    },

    pageErrors: [async ({ page }, use) => {
        const errors: Error[] = [];
        page.on('pageerror', (error) => errors.push(error));
        await use(errors);
        expect(errors.map((error) => error.message), 'uncaught errors in the page').toEqual([]);
    }, { auto: true }],

    // What the page wrote with console.error. Vue reports errors in render functions, watchers
    // and lifecycle hooks this way; they never reach `pageErrors`. Once an area's coverage gate
    // is enforced they fail its tests; until then they are only noted on the test.
    // A test that expects one: `test.use({ allowedConsoleErrors: [/Network Error/] })`.
    consoleErrors: [async ({ page, area, allowedConsoleErrors }, use, testInfo) => {
        const errors: string[] = [];
        page.on('console', (message) => {
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
