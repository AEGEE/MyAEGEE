// lint-as: tests/example-contract.spec.ts
// The real-stack suite: its tests assert too, with the helpers for real answers.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { event } from '../ui/support/factories/events.ts';

test.describe('against the real services', () => {
    test('asserts with expectStatus and expectShape', async ({ api }) => {
        const created = await api.createEvent('admin', {});
        try {
            const single = await api.call<Envelope<unknown>>('member', 'GET', `/api/events/single/${created.url}`);
            expectStatus(single, 200);
            expectShape('event', event(), single.body.data);
        } finally {
            await api.call('admin', 'DELETE', `/api/events/single/${created.id}`);
        }
    });

    test('uses the page like a member would, however it finds things', async ({ page, isMobile }) => {
        // The rules of the mocked-API suite about locators and viewports are not for this suite.
        if (isMobile) await page.locator('.navbar-burger').click();
        await expect(page.locator('.title')).toBeVisible();
    });

    // expect-lint: e2e-expect-expect
    test('only calls the API', async ({ api }) => {
        await api.createEvent('admin', {});
    });

    test('returns early', async ({ api }) => {
        const created = await api.createEvent('admin', {});
        // expect-lint: e2e-no-early-return
        if (!created.url) return;
        expectStatus(await api.call('member', 'GET', `/api/events/single/${created.url}`), 200);
    });

    test('asserts under a condition', async ({ api }) => {
        const answer = await api.call('member', 'GET', '/api/events/');
        // expect-lint: e2e-no-conditional-expect
        if (answer.status === 200) expectShape('event', [event()], answer.body);
    });

    // expect-lint: e2e-no-skipped-tests
    test.skip('skipped', async ({ api }) => {
        expectStatus(await api.call('member', 'GET', '/api/events/'), 200);
    });

    test('checks a constant, with retries of its own', async () => {
        // expect-lint: e2e-no-run-overrides
        test.describe.configure({ retries: 3 });
        // expect-lint: e2e-valid-expect
        expect(true).toBe(true);
    });

    test('an exception without its reason', async ({ api }) => {
        // expect-lint: @eslint-community/eslint-comments/require-description
        // eslint-disable-next-line no-script-url
        expectStatus(await api.call('member', 'GET', '/api/events/?link=javascript:void(0)'), 200);
    });
});
