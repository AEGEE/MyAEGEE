// Fixtures of the mocked-API suite (playwright.ui.config.ts).
//
// Every test gets a browser whose /api calls are answered by `api` (an ApiMock). By default the
// browser is logged in as a regular member (`test.use({ session: 'superadmin' | 'anonymous' })`
// to change that), and the test fails when the page throws or calls an endpoint nobody mocked.
//
// The same specs run against the Vue app (project `vue`) and against the React app next to it
// (project `react`), so they may only rely on what a user sees: roles, labels and text. No CSS
// classes, no component internals. See docs/react-migration/04-test-strategy.md.
import { test as base, expect, type Page } from '@playwright/test';

import { ApiMock } from './api-mock.ts';
import { member, ok, permission, MEMBER_PERMISSIONS, type Member, type Permission } from './factories.ts';

export type Session = 'member' | 'superadmin' | 'anonymous';
export type Frontend = 'vue' | 'react';

export const ACCESS_TOKEN = 'mock-access-token';
export const REFRESH_TOKEN = 'mock-refresh-token';

interface Options {
    session: Session;
    // Fail the test when the page calls an /api endpoint that no handler answers.
    strictApi: boolean;
}

interface Fixtures {
    frontend: Frontend;
    me: Member | null;
    myPermissions: Permission[];
    api: ApiMock;
    pageErrors: Error[];
}

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

export const test = base.extend<Options & Fixtures>({
    session: ['member', { option: true }],
    strictApi: [true, { option: true }],

    frontend: async ({}, use, testInfo) => { // eslint-disable-line no-empty-pattern
        await use((testInfo.project.metadata.frontend ?? 'vue') as Frontend);
    },

    // Fonts and map tiles come from the internet; the tests don't need them.
    context: async ({ context }, use) => {
        await context.route((requestUrl) => !LOCAL_HOSTS.includes(requestUrl.hostname), (route) => route.abort());
        await use(context);
    },

    me: async ({ session }, use) => {
        if (session === 'anonymous') {
            await use(null);
            return;
        }
        await use(member(session === 'superadmin'
            ? { id: 1, username: 'admin', first_name: 'Ada', last_name: 'Admin', superadmin: true }
            : { id: 2, username: 'member', first_name: 'Alex', last_name: 'Member' }));
    },

    myPermissions: async ({ session }, use) => {
        await use(session === 'anonymous' ? [] : MEMBER_PERMISSIONS.map(permission));
    },

    api: async ({ page, me, myPermissions, strictApi }, use, testInfo) => {
        const api = new ApiMock();

        if (me) {
            // Logged in the way the Vue app stores it, which the React app reads as well.
            await page.addInitScript(([access, refresh]) => {
                window.localStorage.setItem('access-token', access);
                window.localStorage.setItem('refresh-token', refresh);
            }, [ACCESS_TOKEN, REFRESH_TOKEN]);
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
            const unhandled = api.unhandled.map((call) => `${call.method} /api/${call.service}${call.path}`);
            expect(unhandled, 'API calls nobody mocked').toEqual([]);
        }
    },

    pageErrors: [async ({ page }, use) => {
        const errors: Error[] = [];
        page.on('pageerror', (error) => errors.push(error));
        await use(errors);
        expect(errors.map((error) => error.message), 'uncaught errors in the page').toEqual([]);
    }, { auto: true }]
});

// The toast/notification the app shows after an action. Both apps render it with role="alert".
export const toast = (page: Page, text: string | RegExp) => page.getByRole('alert').filter({ hasText: text });

export { expect };
