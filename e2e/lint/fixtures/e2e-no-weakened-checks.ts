// lint-as: ui/events/example.spec.ts
import { test, expect } from '../support/test.ts';

const ANYTHING = /Network Error/;

test.describe('the checks every test gets', () => {
    test.use({ session: 'board', strictApi: true, allowedConsoleErrors: [/Network Error/, /\[Vue warn\]: Error in render: "TypeError/i] });
    // Escaped brackets and dots are text of the message, not a character class or "anything".
    test.use({ allowedConsoleErrors: [/\[Vue warn\]/, /\(404\)/, /axios\.get/] });

    test('names the console error it expects', async ({ page }) => {
        await expect(page).toHaveTitle('MyAEGEE');
    });
});

test.describe('turned off', () => {
    // expect-lint: e2e-no-weakened-checks
    test.use({ strictApi: false });
    // expect-lint: e2e-no-weakened-checks
    test.use({ strictApi: !process.env.CI });

    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/.*/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/./] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/^/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/(?:)/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/[\s\S]*/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/\w+/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/Error|/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/(Network Error)?/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/e/i] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/[Vue warn]/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/\w\w\w\d{3}/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/\u0045\x72\x72/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [new RegExp('')] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [ANYTHING] });
    // expect-lint: e2e-no-weakened-checks, e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: [/Network Error/, /.+/, /\S/] });
    // expect-lint: e2e-no-weakened-checks
    test.use({ allowedConsoleErrors: ANYTHING as unknown as RegExp[] });

    test('still asserts something', async ({ page }) => {
        await expect(page).toHaveTitle('MyAEGEE');
    });
});
