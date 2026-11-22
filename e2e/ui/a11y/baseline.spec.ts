// Accessibility baseline: runs axe (WCAG 2.2 A and AA rules) on every page and records the
// violations in a11y-results/<project>/. Report only: it never fails on what axe finds, so
// the numbers can go down over time. `node scripts/a11y-summary.ts` sums them up.
// See docs/react-migration/06-a11y-baseline.md.
import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';

import { test, expect } from '../support/test.ts';
import { ROUTES } from '../support/routes.ts';
import { mockEverything } from '../support/smoke-data.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ strictApi: false });

for (const route of ROUTES) {
    test.describe(route.auth ? 'as superadmin' : 'anonymously', () => {
        test.use({ session: route.auth ? 'superadmin' : 'anonymous' });

        test(`${route.name} (${route.url})`, { tag: route.migrated ? ['@a11y', '@migrated'] : ['@a11y'] }, async ({ page, api, frontend }, testInfo) => {
            // axe on a full page takes a few seconds by itself.
            test.slow();
            mockEverything(api);
            await page.goto(route.url);
            await expect(page).toHaveTitle(/^MyAEGEE \| /);
            await page.waitForLoadState('networkidle');
            // Let route transitions and toasts finish.
            await page.waitForTimeout(500);

            const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
            const violations = results.violations.map((violation) => ({
                id: violation.id,
                impact: violation.impact,
                help: violation.help,
                helpUrl: violation.helpUrl,
                tags: violation.tags.filter((tag) => tag.startsWith('wcag')),
                nodes: violation.nodes.length,
                targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' '))
            }));

            const file = path.join(import.meta.dirname, '../../a11y-results', frontend, `${route.name}.json`);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, `${JSON.stringify({ route: route.name, url: route.url, component: route.component, frontend, violations }, null, 2)}\n`);
            testInfo.annotations.push({ type: 'axe', description: `${violations.length} rules violated on ${violations.reduce((sum, v) => sum + v.nodes, 0)} elements` });
        });
    });
}
