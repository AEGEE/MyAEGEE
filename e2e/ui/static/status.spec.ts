// The status page (/status): whether each service answers, its version, and the latest release
// on GitHub and tag on Docker Hub. Public.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { dockerTags, githubRelease, healthcheck } from '../support/factories/static.ts';
import type { ApiMock, MockResponse } from '../support/api-mock.ts';
import { cellOf, openAccountMenu, tableRows } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const FRONTEND_VERSION = (JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../../frontend/package.json'), 'utf8')) as { version: string }).version;

const SERVICES = ['core', 'mailer', 'events', 'summeruniversity', 'statutory', 'discounts', 'network'] as const;
const STATIC = ['core', 'statutory', 'events', 'summeruniversity'] as const;
const ROWS = [...SERVICES, 'frontend', ...STATIC.map((name) => `${name}-static`)];

const GITHUB = 'https://api.github.com/repos/AEGEE/MyAEGEE/releases**';
const DOCKER = '/services/dockerhub/v2/repositories/aegee/*/tags';

const table = (page: Page) => page.getByRole('table');
const row = (page: Page, name: string) => tableRows(table(page)).filter({ has: page.getByRole('cell', { name, exact: true }) });
const cell = async (page: Page, name: string, column: string) => cellOf(table(page), row(page, name), column);

// A healthcheck takes a moment, as it does over the network: the page shows the time it took.
const healthy = (name: string, version = '1.4.2'): MockResponse => ({ json: ok(healthcheck({ name, version })), delayMs: 5 });

// Every row healthy, GitHub without releases and Docker Hub without tags; a test changes what it is about.
const answerAll = (api: ApiMock): void => {
    for (const service of SERVICES) api.on(`GET ${service} /healthcheck`, healthy(service));
    for (const name of STATIC) api.url('GET', `/media/${name}/healthcheck`, { ...healthy(`${name}-static`), json: ok(healthcheck({ name: `${name}-static`, version: '2.0.0' })) });
    api.url('GET', '/healthcheck', healthy('frontend', FRONTEND_VERSION));
    api.url('GET', GITHUB, { json: [] });
    api.url('GET', DOCKER, { json: dockerTags([]) });
};

test.use({ session: 'anonymous' });

test.describe('status page', () => {
    test('the page keeps the screen\'s width, so the account menu stays in reach', async ({ page, api, layout }) => {
        answerAll(api);

        await page.goto('/status');
        await expect(await cell(page, 'network', 'Is alive?')).toHaveText('Yes');

        // On a phone the table scrolls on its own instead of widening the page and the top bar.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    });

    test('every service shows that it is alive, its version and round trip, with links to its releases', async ({ page, api }) => {
        answerAll(api);
        api.on('GET events /healthcheck', healthy('events', '3.1.0'));

        await page.goto('/status/');

        await expect(page.getByRole('heading', { name: 'Services statuses' })).toBeVisible();
        await expect(tableRows(table(page))).toHaveCount(ROWS.length);
        for (const name of ROWS) {
            await expect(await cell(page, name, 'Is alive?')).toHaveText('Yes');
            await expect(await cell(page, name, 'Round-trip time')).toHaveText(/^\d+ ms\.$/);
        }
        await expect(await cell(page, 'events', 'Current version')).toHaveText('3.1.0');
        await expect(await cell(page, 'core-static', 'Current version')).toHaveText('2.0.0');
        await expect(await cell(page, 'frontend', 'Current version')).toHaveText(FRONTEND_VERSION);

        const releases = (await cell(page, 'network', 'Releases')).getByRole('link', { name: 'View releases' });
        await expect(releases).toHaveAttribute('href', 'https://github.com/AEGEE/MyAEGEE/releases?q=network');
        await expect(releases).toHaveAttribute('target', '_blank');
        await expect(releases).toHaveAttribute('rel', 'noopener noreferrer');
        // The files of the services are no releases of their own.
        await expect(await cell(page, 'statutory-static', 'Releases')).toHaveText('-');

        for (const service of SERVICES) expect(api.callsTo(`GET ${service} /healthcheck`), service).toHaveLength(1);
        for (const name of STATIC) expect(api.callsTo(`GET url /media/${name}/healthcheck`), name).toHaveLength(1);
    });

    test('the frontend row asks the site itself, and says so when it doesn\'t answer', async ({ page, api }) => {
        answerAll(api);
        api.url('GET', '/healthcheck', { status: 502, body: 'Bad gateway', contentType: 'text/plain' });

        await page.goto('/status/');

        await expect(await cell(page, 'frontend', 'Is alive?')).toHaveText('No');
        await expect(await cell(page, 'frontend', 'Round-trip time')).toHaveText(/^\d+ ms\.$/);
        // The version the page was built with.
        await expect(await cell(page, 'frontend', 'Current version')).toHaveText(FRONTEND_VERSION);
        expect(api.callsTo('GET url /healthcheck').map((call) => new URL(call.path).pathname)).toEqual(['/healthcheck']);
    });

    test('a service that doesn\'t answer is not alive; one without a version keeps "-"', async ({ page, api }) => {
        answerAll(api);
        api.on('GET mailer /healthcheck', { status: 502, json: { success: false, message: 'Bad gateway' }, delayMs: 5 });
        api.on('GET discounts /healthcheck', { json: { success: true }, delayMs: 5 });

        await page.goto('/status/');

        await expect(await cell(page, 'mailer', 'Is alive?')).toHaveText('No');
        await expect(await cell(page, 'mailer', 'Round-trip time')).toHaveText(/^\d+ ms\.$/);
        await expect(await cell(page, 'mailer', 'Current version')).toHaveText('-');
        await expect(await cell(page, 'discounts', 'Is alive?')).toHaveText('Yes');
        await expect(await cell(page, 'discounts', 'Current version')).toHaveText('-');
    });

    test('a row says "Waiting..." until its service answers', async ({ page, api }) => {
        answerAll(api);
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /healthcheck', async () => { await held; return healthy('statutory', '5.0.1'); });

        await page.goto('/status/');

        await expect(await cell(page, 'core', 'Is alive?')).toHaveText('Yes');
        await expect(await cell(page, 'statutory', 'Is alive?')).toHaveText('Waiting...');
        await expect(await cell(page, 'statutory', 'Round-trip time')).toHaveText('-');
        await expect(await cell(page, 'statutory', 'Current version')).toHaveText('-');

        release();

        await expect(await cell(page, 'statutory', 'Is alive?')).toHaveText('Yes');
        await expect(await cell(page, 'statutory', 'Current version')).toHaveText('5.0.1');
    });

    test('shows the latest release on GitHub and the latest version tag on Docker Hub', async ({ page, api }) => {
        answerAll(api);
        api.url('GET', GITHUB, { json: [githubRelease('core@1.5.0'), githubRelease('events@3.2.0'), githubRelease('core@1.4.9')] });
        api.url('GET', DOCKER, ({ path: url }) => {
            const image = new URL(url).pathname.split('/')[6];
            if (image === 'core') return { json: dockerTags(['latest', '1.5.0', '1.4.9']) };
            // Only tags that aren't versions.
            if (image === 'events') return { json: dockerTags(['latest', 'stable']) };
            return { json: dockerTags([]) };
        });

        await page.goto('/status/');

        await expect(await cell(page, 'core', 'Latest Github version')).toHaveText('1.5.0');
        await expect(await cell(page, 'events', 'Latest Github version')).toHaveText('3.2.0');
        await expect(await cell(page, 'mailer', 'Latest Github version')).toHaveText('-');
        await expect(await cell(page, 'core', 'Latest Dockerhub tag')).toHaveText('1.5.0');
        await expect(await cell(page, 'events', 'Latest Dockerhub tag')).toHaveText('');

        const [releases] = api.callsTo(`GET url ${GITHUB}`);
        expect(new URL(releases.path).searchParams.get('per_page')).toBe('100');
        const images = api.callsTo(`GET url ${DOCKER}`).map((call) => new URL(call.path));
        expect(images.map((url) => url.pathname.split('/')[6]).sort()).toEqual([...ROWS].sort());
        expect(images.map((url) => url.searchParams.get('page_size'))).toEqual(ROWS.map(() => '10000'));
    });

    test('GitHub and Docker Hub failing leave their columns at "-" and show no error', async ({ page, api }) => {
        answerAll(api);
        // What GitHub answers when the rate limit is reached.
        api.url('GET', GITHUB, { status: 403, json: { message: 'API rate limit exceeded', documentation_url: 'https://docs.github.com/rest' } });
        api.url('GET', DOCKER, { abort: 'failed' });

        await page.goto('/status/');

        await expect(await cell(page, 'core', 'Is alive?')).toHaveText('Yes');
        await expect.poll(() => api.callsTo(`GET url ${DOCKER}`).length).toBe(ROWS.length);
        await expect(await cell(page, 'core', 'Latest Github version')).toHaveText('-');
        await expect(await cell(page, 'core', 'Latest Dockerhub tag')).toHaveText('-');
        await expect(page.getByRole('alert')).toHaveCount(0);
    });
});
