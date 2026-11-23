// Every page of the app loads: it gets its title, doesn't throw and shows no error. With
// generic API answers (support/smoke/) this catches pages that break on their own, on a
// desktop and on a phone viewport.
// Members-only pages are opened as a superadmin (who sees everything), public ones anonymously.
import { test, expect } from '../support/test.ts';
import { FIXED_NOW } from '../support/factories/base.ts';
import { ROUTES, expectedAlertOf, prepareProfile, redirectOf } from '../support/routes.ts';
import { mockEverything } from '../support/smoke/index.ts';

// A fixed day, so a page that depends on the date (a calendar, a deadline) is the same on every run.
test.use({ strictApi: false, now: FIXED_NOW });

for (const route of ROUTES) {
    test.describe(route.auth ? 'as superadmin' : 'anonymously', () => {
        test.use({ session: route.auth ? 'superadmin' : 'anonymous', area: route.area });

        test(`${route.name} (${route.url}) loads`, { tag: '@smoke' }, async ({ page, api, me }) => {
            mockEverything(api, Date.parse(FIXED_NOW));
            prepareProfile(route, me);
            const alerts: string[] = [];
            await page.exposeFunction('__smokeAlert', (text: string) => { alerts.push(text); });
            await page.addInitScript(() => {
                // Record every alert (toasts) as it appears, even when it's gone by the end.
                new MutationObserver(() => {
                    document.querySelectorAll('[role="alert"]:not([data-smoke-seen])').forEach((element) => {
                        element.setAttribute('data-smoke-seen', '');
                        (window as unknown as { __smokeAlert: (text: string) => void }).__smokeAlert(element.textContent?.trim() ?? '');
                    });
                }).observe(document, { subtree: true, childList: true });
            });

            await page.goto(route.url);
            // For visitors who aren't logged in, the Vue router skips setting the title of public
            // pages (app.js, the catch() of beforeEach), so they keep the default one.
            const redirect = redirectOf(route);
            const title = redirect?.title ?? (route.auth ? `MyAEGEE | ${route.label}` : /^MyAEGEE \| /);
            // Some pages load a large chunk first (editors, maps); give them time on a busy machine.
            await expect(page).toHaveTitle(title, { timeout: 10_000 });
            await page.waitForLoadState('networkidle');
            // Once the page has settled it is still the page of the route: one that sends the
            // viewer on has to be listed as a redirect, or this fails.
            await expect(page).toHaveURL((url) => url.pathname === (redirect?.url ?? route.url));
            await expect(page).toHaveTitle(title);

            const expected = expectedAlertOf(route);
            const errors = alerts.filter((text) => /could not|error|not found|failed/i.test(text) && !expected?.test(text));
            expect(errors, 'error messages shown').toEqual([]);
        });
    });
}
