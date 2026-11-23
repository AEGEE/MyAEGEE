// lint-as: ui/support/example.ts
// A helper of the mocked-API suite: where the difference between the viewports belongs. The
// rules about tests don't apply here, the ones about what the suite may rely on do.
import { expect, type Locator, type Page } from '@playwright/test';

import { test, type Layout } from './test.ts';

export const openSomething = async (page: Page, layout: Layout): Promise<Locator | undefined> => {
    const toggle = page.getByRole('button', { name: 'Something', exact: true });
    if (layout === 'phone') await toggle.click();
    if (await toggle.getAttribute('aria-expanded') !== 'true') return undefined;
    if (layout === 'phone') await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    return toggle;
};

export const notOnAPhone = (layout: Layout): void => {
    // expect-lint: e2e-no-skipped-tests
    test.skip(layout === 'phone', 'a helper may not skip the tests that call it');
};

// expect-lint: no-restricted-syntax
export const byClass = (page: Page): Locator => page.locator('.table-mobile-sort');
