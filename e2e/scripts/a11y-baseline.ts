// Keeps the axe baseline (ui/support/a11y/<area>.json) in step with what the axe run found
// (a11y-results/<frontend>/<route>.json, written by ui/a11y/pages.spec.ts).
//
//   node scripts/a11y-baseline.ts check-stale [--complete] [results dir ...]
//       Fails when a page is better than its baseline, so an improvement is locked in before
//       it can be lost again. --complete also fails when a route has no result.
//   node scripts/a11y-baseline.ts lower [results dir ...]
//       Lowers the baseline to what the pages have now. Never raises a count: a page that got
//       worse has to be fixed, or its count raised by hand in a change a reviewer accepts.
//   node scripts/a11y-baseline.ts lower --reset [results dir ...]
//       Writes the baseline as the pages are now, higher counts included. Only for an upgrade
//       of axe itself, in a pull request of its own.
//
// The default results directory is a11y-results/. See docs/testing/accessibility.md.
import fs from 'node:fs';
import path from 'node:path';

import { RESULTS_DIR, countsOf, readBaseline, writeBaseline, type AreaBaseline, type Counts, type PageResult } from '../ui/support/a11y-baseline.ts';
import { AREAS, type Area } from '../ui/support/areas.ts';
import { ROUTES } from '../ui/support/routes.ts';

// The baseline is for the Vue app on a desktop viewport.
const FRONTEND = 'vue';

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((argument) => argument.startsWith('--')));
const directories = rest.filter((argument) => !argument.startsWith('--'));

// Every <frontend>/<route>.json below the directories, however deep (CI collects one
// directory per shard).
const findResults = (directory: string): string[] => {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return findResults(file);
        return entry.name.endsWith('.json') && path.basename(directory) === FRONTEND ? [file] : [];
    });
};

const results = new Map<string, Counts>();
for (const directory of directories.length ? directories : [RESULTS_DIR]) {
    for (const file of findResults(path.resolve(directory))) {
        const result = JSON.parse(fs.readFileSync(file, 'utf8')) as PageResult;
        results.set(result.route, countsOf(result));
    }
}

const baselines = Object.fromEntries(AREAS.map((area) => [area, readBaseline(area)])) as Record<Area, AreaBaseline>;
const areaOf = new Map(ROUTES.map((route) => [route.name, route.area]));

const total = (baseline: Record<Area, AreaBaseline>): { pages: number; elements: number } => {
    const pages = Object.values(baseline).flatMap((area) => Object.values(area));
    return { pages: pages.length, elements: pages.flatMap((counts) => Object.values(counts)).reduce((sum, count) => sum + count, 0) };
};

const checkStale = (): void => {
    const problems: string[] = [];
    for (const area of AREAS) {
        for (const [route, counts] of Object.entries(baselines[area])) {
            if (areaOf.get(route) !== area) {
                problems.push(`${area}.json: "${route}" is not a route of this area any more`);
                continue;
            }
            const found = results.get(route);
            if (!found) continue;
            for (const [rule, allowed] of Object.entries(counts)) {
                const now = found[rule] ?? 0;
                if (now < allowed) problems.push(`${area}.json: ${route} ${rule} is ${now} now, the baseline still says ${allowed}`);
            }
        }
    }
    if (flags.has('--complete')) {
        for (const route of ROUTES) {
            if (!results.has(route.name)) problems.push(`no axe result for ${route.name}: did every shard of the axe run finish?`);
        }
    }

    if (problems.length) {
        console.error(`The accessibility baseline is out of date (${problems.length}):`);
        for (const problem of problems) console.error(`  ${problem}`);
        console.error('\nPages got better: lock that in with `npm run a11y:lower` in e2e/ after an axe run (`npx playwright test -c playwright.ui.config.ts --grep @a11y`), and commit the changed files.');
        process.exit(1);
    }
    const { pages, elements } = total(baselines);
    console.log(`The accessibility baseline matches the ${results.size} page(s) checked. It allows ${elements} element(s) on ${pages} page(s).`);
};

const lower = (): void => {
    const reset = flags.has('--reset');
    const before = total(baselines);
    let worse = 0;
    for (const area of AREAS) {
        const next: AreaBaseline = {};
        for (const route of ROUTES.filter((item) => item.area === area)) {
            const allowed = baselines[area][route.name] ?? {};
            const found = results.get(route.name);
            if (!found) {
                // Not part of this run: leave it as it is.
                next[route.name] = allowed;
            } else if (reset) {
                next[route.name] = found;
            } else {
                next[route.name] = Object.fromEntries(Object.entries(allowed).map(([rule, count]) => [rule, Math.min(count, found[rule] ?? 0)]));
                for (const [rule, count] of Object.entries(found)) {
                    if (count > (allowed[rule] ?? 0)) {
                        worse++;
                        console.warn(`not raised: ${route.name} ${rule} is ${count}, the baseline allows ${allowed[rule] ?? 0}`);
                    }
                }
            }
        }
        baselines[area] = next;
        writeBaseline(area, next);
    }
    // Read back what was written (zeros and empty pages are dropped on the way).
    const after = total(Object.fromEntries(AREAS.map((area) => [area, readBaseline(area)])) as Record<Area, AreaBaseline>);
    console.log(`Baseline: ${before.elements} element(s) on ${before.pages} page(s) before, ${after.elements} on ${after.pages} now (from ${results.size} result(s)).`);
    if (worse) {
        console.error(`${worse} count(s) are higher than the baseline and were left alone: fix the pages, or raise the counts by hand.`);
        process.exit(1);
    }
};

if (command === 'check-stale') checkStale();
else if (command === 'lower') lower();
else {
    console.error('Usage: node scripts/a11y-baseline.ts check-stale [--complete] [results dir ...] | lower [--reset] [results dir ...]');
    process.exit(2);
}
