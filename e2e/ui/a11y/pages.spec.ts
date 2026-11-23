// The accessibility ratchet: axe (WCAG 2.2 A and AA rules) runs on every page, and a page may
// not get worse than its baseline in ui/support/a11y/<area>.json. Getting better is locked in
// with `npm run a11y:lower` (CI fails while the baseline is higher than the page).
// Desktop only. What axe can and can't find: docs/testing/accessibility.md.
import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';

import { RESULTS_DIR, readBaseline, type PageResult } from '../support/a11y-baseline.ts';
import { FIXED_NOW } from '../support/factories/base.ts';
import { ROUTES, prepareProfile, redirectOf } from '../support/routes.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Without animations, and on a fixed day, the page is the same every time axe looks at it: a
// calendar shows the days of the neighbouring months in grey, and how many there are (and so
// how many elements lack contrast) depends on the month.
test.use({ strictApi: false, now: FIXED_NOW, contextOptions: { reducedMotion: 'reduce' } });

for (const route of ROUTES) {
    test.describe(route.auth ? 'as superadmin' : 'anonymously', () => {
        test.use({ session: route.auth ? 'superadmin' : 'anonymous', area: route.area });

        test(`${route.name} (${route.url})`, { tag: '@a11y' }, async ({ page, api, frontend, me }, testInfo) => {
            // axe on a full page takes a few seconds by itself.
            test.slow();
            mockEverything(api, Date.parse(FIXED_NOW));
            prepareProfile(route, me);
            await page.goto(route.url);
            await expect(page).toHaveTitle(/^MyAEGEE \| /);
            await page.waitForLoadState('networkidle');
            // eslint-disable-next-line no-restricted-syntax -- lets route transitions and toasts finish; the generic answers leave nothing else to wait for
            await page.waitForTimeout(500);
            // What is scanned is the page of the route, unless the route is listed as one that
            // sends every viewer on.
            await expect(page).toHaveURL((url) => url.pathname === (redirectOf(route)?.url ?? route.url));

            const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
            const result: PageResult = {
                route: route.name,
                url: route.url,
                component: route.component,
                area: route.area,
                frontend,
                violations: results.violations.map((violation) => ({
                    id: violation.id,
                    impact: violation.impact,
                    help: violation.help,
                    helpUrl: violation.helpUrl,
                    tags: violation.tags.filter((tag) => tag.startsWith('wcag')),
                    nodes: violation.nodes.length,
                    targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' '))
                }))
            };
            const file = path.join(RESULTS_DIR, frontend, `${route.name}.json`);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
            testInfo.annotations.push({ type: 'axe', description: `${result.violations.length} rules violated on ${result.violations.reduce((sum, violation) => sum + violation.nodes, 0)} elements` });

            const baseline = readBaseline(route.area)[route.name] ?? {};
            const worse = result.violations
                .filter((violation) => violation.nodes > (baseline[violation.id] ?? 0))
                .map((violation) => `${violation.id}: ${violation.nodes} element(s), the baseline allows ${baseline[violation.id] ?? 0} (${violation.help}). For example: ${violation.targets.join(' | ')}`);
            expect(worse, `accessibility got worse than ui/support/a11y/${route.area}.json allows for this page`).toEqual([]);
        });
    });
}
