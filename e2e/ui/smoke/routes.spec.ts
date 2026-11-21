// Every page of the app loads: it gets its title, doesn't throw and shows no error. With
// generic API answers (support/smoke-data.ts) this catches pages that break on their own, and,
// in the `react` project, migrated pages that the React app doesn't serve properly.
// Members-only pages are opened as a superadmin (who sees everything), public ones anonymously.
import { test, expect } from '../support/test.ts';
import { ROUTES } from '../support/routes.ts';
import { mockEverything } from '../support/smoke-data.ts';

test.use({ strictApi: false });

// Pages that need more realistic data than the generic answers to render. With these, a JS
// error inside the view's then() lands in a catch() that reads `err.response.status`, which
// throws again. Mock them properly when writing their behavioural specs.
const NEEDS_DATA: Record<string, string> = {
    'oms.statutory.applications.stats': 'needs statutory application stats',
    'oms.statutory.applications.export': 'needs statutory applications and fields',
    'oms.statutory.applications.new': 'needs a statutory event with question lines'
};

// Error messages that are the expected result of having no data.
const EXPECTED_ALERTS: Record<string, RegExp> = {
    'oms.network.ac_check': /no Agora data available/
};

for (const route of ROUTES) {
    test.describe(route.auth ? 'as superadmin' : 'anonymously', () => {
        test.use({ session: route.auth ? 'superadmin' : 'anonymous' });

        test(`${route.name} (${route.url}) loads`, { tag: route.migrated ? ['@smoke', '@migrated'] : ['@smoke'] }, async ({ page, api }) => {
            test.fixme(route.name in NEEDS_DATA, NEEDS_DATA[route.name]);
            mockEverything(api);
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
            await expect(page).toHaveTitle(route.auth ? `MyAEGEE | ${route.label}` : /^MyAEGEE \| /);
            await page.waitForLoadState('networkidle');

            const expected = EXPECTED_ALERTS[route.name];
            const errors = alerts.filter((text) => /could not|error|not found|failed/i.test(text) && !expected?.test(text));
            expect(errors, 'error messages shown').toEqual([]);
        });
    });
}
