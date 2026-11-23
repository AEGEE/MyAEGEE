// lint-as: ui/smoke/example.spec.ts
import { ROUTES } from '../support/routes.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// The generated tests use generic answers, so they may turn the strict mode off.
test.use({ strictApi: false });
// expect-lint: e2e-no-weakened-checks
test.use({ allowedConsoleErrors: [/.*/] });

for (const route of ROUTES) {
    test(`${route.name} loads`, { tag: '@smoke' }, async ({ page, api }) => {
        mockEverything(api);
        await page.goto(route.url);
        await expect(page).toHaveTitle(/^MyAEGEE \| /);
    });

    // expect-lint: no-restricted-syntax
    test(`${route.name} with a tag of the behavioural specs`, { tag: '@phone-only' }, async ({ page }) => {
        await expect(page).toHaveTitle(/^MyAEGEE \| /);
    });

    // expect-lint: e2e-expect-expect
    test(`${route.name} without an assertion`, { tag: '@smoke' }, async ({ page }) => {
        await page.goto(route.url);
    });

    // expect-lint: e2e-no-skipped-tests
    if (route.auth) test(`${route.name} for members only`, { tag: '@smoke' }, async ({ page }) => {
        await expect(page).toHaveTitle(/^MyAEGEE \| /);
    });
}
