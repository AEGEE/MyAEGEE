// The axe baseline: how many elements break each accessibility rule on each page today, per
// area in ui/support/a11y/<area>.json. A page that isn't in its area's file has no violations.
// Used by the axe run (ui/a11y/pages.spec.ts) and by scripts/a11y-baseline.ts.
// See docs/testing/accessibility.md.
import fs from 'node:fs';
import path from 'node:path';

import type { Area } from './areas.ts';

// Rule id -> number of elements that break it.
export type Counts = Record<string, number>;
// Route name -> counts.
export type AreaBaseline = Record<string, Counts>;

// What the axe run writes per page into a11y-results/<frontend>/<route>.json.
export interface PageResult {
    route: string;
    url: string;
    component: string;
    area: Area;
    frontend: string;
    violations: {
        id: string;
        impact: string | null | undefined;
        help: string;
        helpUrl: string;
        tags: string[];
        nodes: number;
        targets: string[];
    }[];
}

export const RESULTS_DIR = path.join(import.meta.dirname, '../../a11y-results');

export const baselineFile = (area: Area): string => path.join(import.meta.dirname, 'a11y', `${area}.json`);

export const readBaseline = (area: Area): AreaBaseline => JSON.parse(fs.readFileSync(baselineFile(area), 'utf8')) as AreaBaseline;

const sorted = <T>(record: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

// Routes and rules in a fixed order and without zeros, so the files only change when a count does.
export const writeBaseline = (area: Area, baseline: AreaBaseline): void => {
    const clean = Object.fromEntries(Object.entries(baseline)
        .map(([route, counts]) => [route, sorted(Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0)))] as const)
        .filter(([, counts]) => Object.keys(counts).length > 0));
    fs.writeFileSync(baselineFile(area), `${JSON.stringify(sorted(clean), null, 2)}\n`);
};

export const countsOf = (result: PageResult): Counts => Object.fromEntries(result.violations.map((violation) => [violation.id, violation.nodes]));
