// lint-as: ui/events/example.spec.ts
import { test, expect } from '../support/test.ts';

const it = test;
// expect-lint: e2e-no-skipped-tests
const { skip } = test;
const browsers = ['chromium'];

test.describe('tests that run', () => {
    for (const browser of browsers) {
        test(`one per item of a list (${browser})`, async ({ page }) => {
            test.slow();
            await test.step('steps are fine', async () => {
                await expect(page).toHaveTitle('MyAEGEE');
            });
        });
    }

    test('an annotation that only says something', { annotation: { type: 'issue', description: 'https://example.org/1' } }, async ({ page }) => {
        await expect(page).toHaveTitle('MyAEGEE');
        // Reading the status is not setting it.
        expect(test.info().expectedStatus).toBe('passed');
    });
});

// expect-lint: e2e-no-skipped-tests
test.skip('skipped', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
// expect-lint: e2e-no-skipped-tests
test.fixme('to be fixed', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
// expect-lint: e2e-no-skipped-tests
test.fail('expected to fail', async ({ page }) => {
    await expect(page).toHaveTitle('Not MyAEGEE');
});
// expect-lint: e2e-no-skipped-tests
test.only('focused', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
// expect-lint: e2e-no-skipped-tests
it.only('focused under another name', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
// expect-lint: e2e-no-skipped-tests
test['skip']('skipped with brackets', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
// expect-lint: e2e-no-skipped-tests
test.describe.skip('a skipped group', () => {});
// expect-lint: e2e-no-skipped-tests
test.describe.fixme('a group to be fixed', () => {});
// expect-lint: e2e-no-skipped-tests
test.describe.only('a focused group', () => {});
// expect-lint: e2e-no-skipped-tests
test.describe.parallel.only('a focused parallel group', () => {});

test('skips inside a test', async ({ page, isMobile }, testInfo) => {
    // expect-lint: e2e-no-skipped-tests
    test.skip(isMobile, 'not on a phone');
    // expect-lint: e2e-no-skipped-tests
    test.fixme();
    // expect-lint: e2e-no-skipped-tests
    test.fail();
    // expect-lint: e2e-no-skipped-tests
    testInfo.skip();
    // expect-lint: e2e-no-skipped-tests
    testInfo.fixme(true, 'later');
    // expect-lint: e2e-no-skipped-tests
    testInfo.fail();
    // expect-lint: e2e-no-skipped-tests
    test.info().skip();
    // expect-lint: e2e-no-skipped-tests
    testInfo.expectedStatus = 'failed';
    // expect-lint: e2e-no-skipped-tests
    await test.step.skip('a skipped step', async () => {
        await expect(page).toHaveTitle('Not MyAEGEE');
    });
    skip();
    await expect(page).toHaveTitle('MyAEGEE');
});

// expect-lint: e2e-no-skipped-tests
test('skipped by an annotation', { annotation: { type: 'skip', description: 'later' } }, async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
test('expected to fail by an annotation', {
    annotation: [
        { type: 'issue', description: 'https://example.org/1' },
        // expect-lint: e2e-no-skipped-tests
        { type: 'fail' }
    ]
}, async ({ page }) => {
    await expect(page).toHaveTitle('Not MyAEGEE');
});

// expect-lint: e2e-no-skipped-tests
if (process.env.WITH_MAPS) test('only declared with a variable set', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
if (process.env.WITH_MAPS) {
    // expect-lint: e2e-no-skipped-tests
    test.describe('a group under a condition', () => {
        test('is reported once, for the group', async ({ page }) => {
            await expect(page).toHaveTitle('MyAEGEE');
        });
    });
}
for (const browser of browsers) {
    // expect-lint: e2e-no-skipped-tests
    if (browser !== 'chromium') test(`not for every item (${browser})`, async ({ page }) => {
        await expect(page).toHaveTitle('MyAEGEE');
    });
}
// expect-lint: e2e-no-skipped-tests
process.env.CI && test('only in CI', async ({ page }) => {
    await expect(page).toHaveTitle('MyAEGEE');
});
