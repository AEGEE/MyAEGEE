// The resources page (/resources): sections of links to AEGEE's tools and documents, kept in
// core. Members only.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { resourceCategory, resourceLink, type ResourceTheme } from '../support/factories/static.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const resources = (page: Page) => page.getByRole('region', { name: 'Resources', exact: true });
const section = (page: Page, name: string) => resources(page).getByRole('region', { name, exact: true });
const NEW_TAB = '(opens in a new tab)';

const SECTIONS = [
    resourceCategory({
        id: 1,
        name: 'Stay informed',
        theme: 'blue',
        links: [
            resourceLink({ id: 11, category_id: 1, title: 'AEGEE Newsletter', description: 'News from the network, every month.', url: 'https://www.aegee.org/newsletter/' }),
            resourceLink({ id: 12, category_id: 1, title: 'Mailing Lists', description: 'Which lists there are and how to join them.', url: '/pages/mailing-lists', position: 1 })
        ]
    }),
    resourceCategory({
        id: 2,
        name: 'Financial',
        theme: 'yellow',
        position: 1,
        links: [
            resourceLink({ id: 21, category_id: 2, title: 'Financial guidelines', description: 'How the money of AEGEE is handled.', url: 'https://www.aegee.org/financial-guidelines/' })
        ]
    })
];

test.describe('resources page', () => {
    test('lists each section as a named region with its links in order', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources');

        await expect(resources(page).getByRole('heading', { level: 2 })).toHaveText(['Stay informed', 'Financial']);
        await expect(section(page, 'Stay informed').getByRole('link')).toHaveText([
            /^AEGEE Newsletter\s*News from the network, every month\./,
            /^Mailing Lists\s*Which lists there are and how to join them\./
        ]);
        await expect(section(page, 'Financial').getByRole('link')).toHaveCount(1);
        expect(api.callsTo('GET core /resources')).toHaveLength(1);
    });

    test('other sites open in a new tab and say so; pages of MyAEGEE open in the app', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));
        await page.goto('/resources');

        const newsletter = section(page, 'Stay informed').getByRole('link', { name: /^AEGEE Newsletter/ });
        await expect(newsletter).toHaveAttribute('href', 'https://www.aegee.org/newsletter/');
        await expect(newsletter).toHaveAttribute('target', '_blank');
        await expect(newsletter).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(newsletter).toHaveAccessibleName(/\(opens in a new tab\)$/);

        const lists = section(page, 'Stay informed').getByRole('link', { name: /^Mailing Lists/ });
        await expect(lists).toHaveAttribute('href', '/pages/mailing-lists');
        await expect(lists).not.toHaveAttribute('target');
        await expect(lists).not.toHaveAccessibleName(new RegExp(NEW_TAB.replace(/[()]/g, '\\$&')));

        // Kept by the page as long as it isn't loaded again.
        await page.evaluate(() => { (window as { resourcesOpened?: boolean }).resourcesOpened = true; });
        api.fallback(mockEverything);
        await lists.click();

        await expect(page).toHaveURL(/\/pages\/mailing-lists$/);
        expect(await page.evaluate(() => (window as { resourcesOpened?: boolean }).resourcesOpened)).toBe(true);
    });

    test('the header text of every theme, and of an unknown one, is readable', async ({ page, api }) => {
        const themes: ResourceTheme[] = ['blue', 'blue-dark', 'purple', 'red', 'grey', 'yellow', 'green'];
        api.json('GET core /resources', ok([
            ...themes.map((theme, index) => resourceCategory({ id: 100 + index, name: `Theme ${theme}`, theme, position: index })),
            // Core only stores the themes above; the page shows anything else in grey.
            resourceCategory({ id: 200, name: 'Theme unknown', theme: 'orange' as ResourceTheme, position: 10 })
        ]));
        await page.goto('/resources');
        await expect(resources(page).getByRole('heading', { level: 2 })).toHaveCount(themes.length + 1);

        // The page fades in: axe reads the colours once that is over.
        await expect(async () => {
            const results = await new AxeBuilder({ page }).include('[role=region][aria-label=Resources]').withRules(['color-contrast']).analyze();
            expect(results.violations).toEqual([]);
            expect(results.passes.flatMap((rule) => rule.nodes).length).toBeGreaterThanOrEqual(themes.length + 1);
        }).toPass({ timeout: 5000 });
    });

    test('offers to manage the resources only to members who may', async ({ page, api, myPermissions }) => {
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources');
        await expect(section(page, 'Financial')).toBeVisible();
        await expect(resources(page).getByRole('link', { name: 'Manage resources' })).toHaveCount(0);

        myPermissions.push(permission('global:manage:resources'));
        await page.reload();
        await expect(resources(page).getByRole('link', { name: 'Manage resources' })).toHaveAttribute('href', '/resources/manage');
    });

    test('says so when there are no resources', async ({ page, api }) => {
        api.json('GET core /resources', ok([]));

        await page.goto('/resources');

        await expect(resources(page).getByText('Nothing here.')).toBeVisible();
        await expect(resources(page).getByRole('region')).toHaveCount(0);
    });

    test('says so when the resources cannot be loaded', async ({ page, api }) => {
        api.on('GET core /resources', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/resources');

        await expect(toast(page, 'Could not load the resources: Database is down')).toBeVisible();
        await expect(resources(page)).not.toHaveAttribute('aria-busy');
    });

    test('is busy until the resources are in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET core /resources', async () => { await held; return { json: ok(SECTIONS) }; });

        await page.goto('/resources');

        await expect(resources(page)).toHaveAttribute('aria-busy', 'true');
        await expect(resources(page).getByText('Nothing here.')).toHaveCount(0);
        release();
        await expect(resources(page)).not.toHaveAttribute('aria-busy');
        await expect(section(page, 'Stay informed')).toBeVisible();
    });
});
