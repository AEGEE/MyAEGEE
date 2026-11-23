// Frontend coverage for both Playwright suites (the mocked-API suite and the real stack).
//
// The tests run against a build of the Vue app that counts which code ran (FRONTEND_COVERAGE=1,
// see frontend/build/coverage-loader.js and scripts/prepare.ts). With E2E_COVERAGE=1 the fixtures
// below take those counts out of every page and write them to .coverage/raw, one file per
// worker. They also note which routes the tests opened, in .coverage/routes.
// `npm run coverage` (scripts/coverage.ts) merges and reports them. Without E2E_COVERAGE=1 the
// fixtures do nothing.
//
// A run starts by removing what an earlier run of the same suite wrote (support/coverage-setup.ts,
// the globalSetup of both configs), so the report is about the last run of each suite and never
// about a sum of runs nobody remembers. E2E_COVERAGE_KEEP=1 keeps the earlier files, to add up
// several partial runs on purpose.
//
// Use: spread `coverageFixtures('<suite>')` into the suite's `base.extend()`:
//   base.extend<MyFixtures & CoverageFixtures, CoverageWorkerFixtures>({ ...coverageFixtures('mocked'), ... })
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type {
    Fixtures, Page, PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions
} from '@playwright/test';

// The name the suite's files get in .coverage/raw and .coverage/routes.
export type Suite = 'mocked' | 'real';

export const COVERAGE_DIR = path.resolve(import.meta.dirname, '../.coverage');
export const RAW_DIR = path.join(COVERAGE_DIR, 'raw');
export const ROUTES_DIR = path.join(COVERAGE_DIR, 'routes');

export const coverageEnabled = process.env.E2E_COVERAGE === '1';

// Removes the files an earlier run of `suite` left in the given directories. Returns how many.
export const clearSuiteData = (suite: Suite, dirs: string[] = [RAW_DIR, ROUTES_DIR]): number => {
    let removed = 0;
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            if (name.startsWith(`${suite}-`) && name.endsWith('.json')) {
                fs.rmSync(path.join(dir, name));
                removed++;
            }
        }
    }
    return removed;
};

// How often the statements, functions and branches of one instrumented file ran, with the ids
// istanbul gave them. `hash` identifies the instrumented code, so counts of different builds
// are never added up. The positions of the ids are in the build's baseline (.coverage/build).
export interface FileHits {
    hash: string;
    s: Record<string, number>;
    f: Record<string, number>;
    b: Record<string, number[]>;
}

// A file of .coverage/raw: the hits by the file's path at build time.
export type RawCoverage = Record<string, FileHits>;

// A file of .coverage/routes: the ids of the tests that opened a route, by route name.
export type RouteVisits = Record<string, string[]>;

// Adds the hits of `from` to `into`. Both must come from the same build.
export const addHits = (into: RawCoverage, from: RawCoverage): void => {
    for (const [file, hits] of Object.entries(from)) {
        const sum = into[file];
        if (!sum) {
            into[file] = structuredClone(hits);
            continue;
        }
        if (sum.hash !== hits.hash) {
            throw new Error(`Coverage of ${file} comes from two different builds of the frontend (${sum.hash} and ${hits.hash}).`);
        }
        for (const [id, count] of Object.entries(hits.s)) sum.s[id] = (sum.s[id] ?? 0) + count;
        for (const [id, count] of Object.entries(hits.f)) sum.f[id] = (sum.f[id] ?? 0) + count;
        for (const [id, counts] of Object.entries(hits.b)) {
            sum.b[id] = counts.map((count, index) => (sum.b[id]?.[index] ?? 0) + count);
        }
    }
};

interface RouteDefinition {
    name: string;
    path: string;
    component: string;
}

export interface AppRoute {
    name: string;
    path: string;
    // views/<area>/…: the first part of the route's component.
    area: string;
    pattern: RegExp;
}

const require = createRequire(import.meta.url);
// eslint-disable-next-line import/no-dynamic-require -- the path is fixed, only resolved from here
const definitions = require(path.resolve(import.meta.dirname, '../../frontend/src/router/routes.js')) as RouteDefinition[];

// The routes of the Vue app in the order of routes.js, which is the order vue-router tries them in.
export const APP_ROUTES: AppRoute[] = definitions.map((route) => ({
    name: route.name,
    path: route.path,
    area: route.component.split('/')[0],
    // Like vue-router: a parameter is one path segment, a slash at the end and the case don't matter.
    pattern: new RegExp('^' + route.path.replace(/\/$/, '').split('/')
        .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/') + '/?$', 'i')
}));

// The route that vue-router shows for a path: the first one that matches, so `/events/new` is
// the create page and not the event with the id `new`.
export const routeNameFor = (pathname: string): string | undefined => APP_ROUTES.find((route) => route.pattern.test(pathname))?.name;

export interface CoverageFixtures {
    coverage: void;
    routeVisits: void;
}

export interface CoverageWorkerFixtures {
    coverageStore: RawCoverage;
    routeVisitStore: Map<string, Set<string>>;
}

interface PageGlobals {
    __coverage__?: RawCoverage;
    __e2eCoverage(json: string): Promise<void>;
    __e2eCoverageSnapshot?(): string | null;
}

const STORAGE_KEY = '__e2e_coverage';
// A page that hangs must not keep the test from finishing.
const SNAPSHOT_TIMEOUT = 5 * 1000;

const writeJson = (dir: string, name: string, data: unknown): void => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
};

type BaseTestArgs = PlaywrightTestArgs & PlaywrightTestOptions;
type BaseWorkerArgs = PlaywrightWorkerArgs & PlaywrightWorkerOptions;

export const coverageFixtures = (suite: Suite): Fixtures<CoverageFixtures, CoverageWorkerFixtures, BaseTestArgs, BaseWorkerArgs> => ({
    // One sum per worker, written when the worker stops: a file per test would be 100 times the data.
    coverageStore: [async ({}, use, workerInfo) => { // eslint-disable-line no-empty-pattern
        const store: RawCoverage = {};
        await use(store);
        if (coverageEnabled && Object.keys(store).length > 0) {
            writeJson(RAW_DIR, `${suite}-${process.pid}-${workerInfo.workerIndex}.json`, store);
        }
    }, { scope: 'worker' }],

    routeVisitStore: [async ({}, use, workerInfo) => { // eslint-disable-line no-empty-pattern
        const store = new Map<string, Set<string>>();
        await use(store);
        if (coverageEnabled && store.size > 0) {
            const visits: RouteVisits = Object.fromEntries([...store].map(([route, tests]) => [route, [...tests].sort()]));
            writeJson(ROUTES_DIR, `${suite}-${process.pid}-${workerInfo.workerIndex}.json`, visits);
        }
    }, { scope: 'worker' }],

    // Without E2E_COVERAGE=1 these two don't ask for a browser context, so a test that only
    // calls the API doesn't open one because of them.
    coverage: coverageEnabled ? [async ({ context, coverageStore }, use) => {
        // What a page hands over arrives while the test runs; a problem with it is reported at the end.
        let failure: unknown;
        await context.exposeFunction('__e2eCoverage', (json: string) => {
            try {
                addHits(coverageStore, JSON.parse(json) as RawCoverage);
            } catch (error) {
                failure ??= error;
            }
        });
        await context.addInitScript((storageKey) => {
            const w = window as unknown as PageGlobals;
            // Only the counts: the maps and source maps of every file are in the build's baseline.
            w.__e2eCoverageSnapshot = () => {
                if (!w.__coverage__) return null;
                const hits: RawCoverage = {};
                for (const [file, { hash, s, f, b }] of Object.entries(w.__coverage__)) hits[file] = { hash, s, f, b };
                return JSON.stringify(hits);
            };
            try {
                // A full page load throws the counts away with the page. Keep them in sessionStorage
                // while the page unloads (synchronous, so nothing gets lost) and hand them over from
                // the next page.
                const pending = window.sessionStorage.getItem(storageKey);
                if (pending) {
                    window.sessionStorage.removeItem(storageKey);
                    w.__e2eCoverage(pending).catch(() => {});
                }
                window.addEventListener('pagehide', () => {
                    const json = w.__e2eCoverageSnapshot?.();
                    if (json) window.sessionStorage.setItem(storageKey, json);
                });
            } catch {
                // A document without storage (about:blank, a sandboxed frame) has no app code either.
            }
        }, STORAGE_KEY);

        await use();

        for (const page of context.pages()) {
            let timer: NodeJS.Timeout | undefined;
            const json = await Promise.race([
                page.evaluate(() => (window as unknown as PageGlobals).__e2eCoverageSnapshot?.() ?? null).catch(() => null),
                new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT); })
            ]);
            clearTimeout(timer);
            if (json) addHits(coverageStore, JSON.parse(json) as RawCoverage);
        }
        if (failure) throw failure;
    }, { auto: true }] : [async ({}, use) => { await use(); }, { auto: true }], // eslint-disable-line no-empty-pattern

    // Which routes the test opened: every address the main frame showed (also the ones the
    // router went to without a page load), for behavioural tests only. The generated smoke
    // and accessibility tests open every route and say nothing about a route being tested.
    routeVisits: coverageEnabled ? [async ({ context, routeVisitStore }, use, testInfo) => {
        const pathnames = new Set<string>();
        const watch = (page: Page): void => {
            page.on('framenavigated', (frame) => {
                if (frame !== page.mainFrame()) return;
                try {
                    pathnames.add(new URL(frame.url()).pathname);
                } catch {
                    // Not an address of the app.
                }
            });
        };
        context.pages().forEach(watch);
        context.on('page', watch);

        await use();

        if (testInfo.tags.includes('@smoke') || testInfo.tags.includes('@a11y')) return;
        // The suite's checks of its own helpers borrow pages; they don't test them.
        if (testInfo.file.split(path.sep).includes('harness')) return;
        for (const pathname of pathnames) {
            const route = routeNameFor(pathname);
            if (!route) continue;
            if (!routeVisitStore.has(route)) routeVisitStore.set(route, new Set());
            routeVisitStore.get(route)!.add(testInfo.testId);
        }
    }, { auto: true }] : [async ({}, use) => { await use(); }, { auto: true }] // eslint-disable-line no-empty-pattern
});
