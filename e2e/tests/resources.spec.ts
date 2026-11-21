import type { Page } from '@playwright/test';
import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

const MOVE = moveToModule('frontend', 'once the frontend has component tests for Resources');

// Sections in page order, with how many links each holds.
const SECTIONS: [string, number][] = [
    ['Stay informed', 6],
    ['Safety and conduct', 3],
    ['Statutory and strategy', 3],
    ['Network', 4],
    ['Financial', 3],
    ['Requests', 2],
    ['Brand and PR', 1]
];

const NEW_TAB = '(opens in a new tab)';

const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test.describe('Resources page', () => {
    test.beforeEach(async ({ api, page }) => {
        await loginInBrowser(page, api, 'member');
        await page.goto('/resources');
        await expect(page.getByRole('heading', { level: 2, name: SECTIONS[0][0] })).toBeVisible();
    });

    test('lists each section as a heading with its links', MOVE, async ({ page }) => {
        const headings = page.getByRole('heading', { level: 2 });
        await expect(headings).toHaveText(SECTIONS.map(([name]) => name));

        for (const [name, count] of SECTIONS) {
            await expect(section(page, name).getByRole('link'), name).toHaveCount(count);
        }
    });

    test('links to other sites open in a new tab and say so', MOVE, async ({ page }) => {
        const external = page.locator('a[target="_blank"]').filter({ has: page.locator('.resource-card-header') });
        const total = SECTIONS.reduce((sum, [, count]) => sum + count, 0);
        // Every link except Mailing Lists.
        await expect(external).toHaveCount(total - 1);

        for (const link of await external.all()) {
            await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
            await expect(link).toHaveAccessibleName(new RegExp(`${NEW_TAB.replace(/[()]/g, '\\$&')}$`));
        }
    });

    test('Mailing Lists opens the MyAEGEE page in the same tab', MOVE, async ({ page }) => {
        // The gateway doesn't proxy Confluence in e2e; the page content isn't what this test checks.
        await page.route('**/services/jira-cors/wiki/rest/api/content/**', (route) => route.fulfill({
            json: { title: 'Mailing lists', body: { export_view: { value: '<p>Mailing lists</p>' } } }
        }));

        const link = section(page, 'Stay informed').getByRole('link', { name: /^Mailing Lists/ });
        await expect(link).not.toHaveAttribute('target');
        await expect(link).not.toHaveAccessibleName(new RegExp(NEW_TAB.replace(/[()]/g, '\\$&')));

        await link.click();
        await expect(page).toHaveURL(/\/pages\/mailing-lists$/);
    });

    test('card header text meets WCAG 2.2 AA contrast', MOVE, async ({ page }) => {
        const ratios = await page.locator('.resource-card-header').evaluateAll((headers) => {
            const channel = (c: number) => {
                const v = c / 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            };
            const luminance = (css: string) => {
                const [r, g, b] = (css.match(/[\d.]+/g) as string[]).slice(0, 3).map(Number);
                return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
            };
            return headers.map((header) => {
                const style = getComputedStyle(header);
                const [hi, lo] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
                return { title: header.textContent?.trim(), ratio: (hi + 0.05) / (lo + 0.05) };
            });
        });

        expect(ratios.length).toBeGreaterThan(0);
        for (const { title, ratio } of ratios) {
            // 15px bold is normal-size text, so it needs 4.5:1.
            expect(ratio, title).toBeGreaterThanOrEqual(4.5);
        }
    });
});
