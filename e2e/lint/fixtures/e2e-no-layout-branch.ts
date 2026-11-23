// lint-as: ui/shell/example.spec.ts
import path from 'node:path';

import { openMenu, sortBy } from '../support/shell.ts';
import { test, expect, type Layout } from '../support/test.ts';

const describeLayout = (layout: Layout): string => `on a ${layout}`;

test.describe('the same steps on both viewports', () => {
    test('layout goes to the helpers', async ({ page, layout, frontend }, testInfo) => {
        const menu = await openMenu(page, layout);
        await sortBy(page.getByRole('table'), 'Name', layout, 'desc');
        await expect(menu.getByRole('link', { name: 'Bodies' })).toBeVisible();
        // Naming a file or a result after the project decides nothing.
        const file = path.join('results', frontend, `${testInfo.project.name}.json`);
        const result = { frontend, file, where: describeLayout(layout) };
        expect(result.frontend).toBe('vue');
    });
});

test.describe('branching on the viewport', () => {
    test('with if', async ({ page, layout, isMobile, viewport }, testInfo) => {
        // expect-lint: e2e-no-layout-branch
        if (layout === 'phone') await page.getByRole('button', { name: 'Menu', exact: true }).click();
        // expect-lint: e2e-no-layout-branch
        if (isMobile) await page.getByRole('button', { name: 'Menu', exact: true }).click();
        // expect-lint: e2e-no-layout-branch
        if (!isMobile) await page.getByRole('link', { name: 'Bodies' }).hover();
        // expect-lint: e2e-no-layout-branch
        if (testInfo.project.name === 'vue-mobile') await page.reload();
        // expect-lint: e2e-no-layout-branch
        if (test.info().project.name.endsWith('mobile')) await page.reload();
        // expect-lint: e2e-no-layout-branch
        if (viewport!.width < 800) await page.reload();
        // expect-lint: e2e-no-layout-branch
        if ((page.viewportSize()?.width ?? 0) < 800) await page.reload();
        // expect-lint: e2e-no-layout-branch
        if (testInfo.project.metadata.layout !== 'desktop') await page.reload();
        await expect(page).toHaveTitle('MyAEGEE');
    });

    test('without if', async ({ page, layout, frontend }) => {
        // expect-lint: e2e-no-layout-branch
        const name = layout === 'phone' ? 'Account menu' : 'Alex Member';
        // expect-lint: e2e-no-layout-branch
        const count = { desktop: 5, phone: 1 }[layout];
        // expect-lint: e2e-no-layout-branch
        const isPhone = layout === 'phone';
        // expect-lint: e2e-no-layout-branch
        const where = layout;
        // expect-lint: e2e-no-layout-branch
        await (frontend === 'vue' && page.reload());
        // expect-lint: e2e-no-layout-branch
        switch (layout) {
        default:
        }
        // expect-lint: e2e-no-layout-branch
        while (['phone'].includes(layout)) await page.reload();
        await expect(page.getByRole('button', { name })).toHaveCount(count);
        expect([isPhone, where]).toHaveLength(2);
    });

    // expect-lint: e2e-no-layout-branch, e2e-no-layout-branch
    test('under another name', async ({ page, layout: l, isMobile: phone = false }) => {
        if (l === 'phone' || phone) await page.reload();
        await expect(page).toHaveTitle('MyAEGEE');
    });

    test('kept for later', async ({ page, layout }, testInfo) => {
        // expect-lint: e2e-no-layout-branch
        const onPhone = ['phone'].includes(layout);
        // expect-lint: e2e-no-layout-branch
        const size = page.viewportSize();
        // expect-lint: e2e-no-layout-branch
        const project = testInfo.project.name;
        // expect-lint: e2e-no-layout-branch
        const mobile = testInfo.project.name.endsWith('mobile');
        // expect-lint: e2e-no-layout-branch
        const narrow = /mobile/.test(test.info().project.name);
        // expect-lint: e2e-no-layout-branch
        const { project: { name } } = testInfo;
        let later;
        // expect-lint: e2e-no-layout-branch
        later = testInfo.project.metadata.layout as string;
        if (onPhone || mobile || narrow || size!.width < 800 || project === 'vue-mobile' || name === later) await page.reload();
        await expect(page).toHaveTitle('MyAEGEE');
    });

    // expect-lint: e2e-no-layout-branch
    test('taken out of the test\'s information', async ({ page }, { project }) => {
        if (project.name === 'vue-mobile') await page.reload();
        await expect(page).toHaveTitle('MyAEGEE');
    });
});
