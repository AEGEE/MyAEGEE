// Participants limits (/statutory/limits): how many delegates, envoys, observers and visitors
// each body may send to an Agora, EPM or SPM, and changing them.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { defaultPaxLimit, paxLimit, type PaxLimit } from '../support/factories/statutory-events.ts';
import { cellOf, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ALPHA = body({ id: 10, name: 'AEGEE-Alpha', type: 'antenna' });
const BETA = body({ id: 11, name: 'AEGEE-Beta', type: 'contact antenna' });
const GAMMA = body({ id: 12, name: 'AEGEE-Gamma', type: 'contact' });
const DELTA = body({ id: 13, name: 'AEGEE-Delta', type: 'antenna' });
const BODIES = [ALPHA, BETA, GAMMA, DELTA];

// Alpha has a limit of its own; Delta has one stored that is the same as the default.
const AGORA_LIMITS: PaxLimit[] = [
    paxLimit({ id: 1, body_id: 10, delegate: 5, envoy: 0, observer: 0, visitor: 10 }),
    defaultPaxLimit(BETA),
    defaultPaxLimit(GAMMA),
    paxLimit({ id: 2, body_id: 13, delegate: 3, envoy: 0, observer: 0, visitor: 30 })
];

const answerLimits = (api: ApiMock, limits: Record<string, PaxLimit[]> = { agora: AGORA_LIMITS }): void => {
    api.on('GET statutory /limits/:type', ({ params }) => ({ json: ok(limits[params.type] ?? []) }));
    api.on('GET statutory /limits/:type/defaults', ({ params }) => ({ json: ok(BODIES.map((item) => defaultPaxLimit(item, params.type as PaxLimit['event_type']))) }));
    api.json('GET core /bodies', ok(BODIES));
};

const limitsTable = (page: Page) => page.getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(limitsTable(page)).filter({ hasText: name });

test.describe('participants limits', () => {
    test('lists the limits of every body for Agorae, and which ones are its own', async ({ page, api }) => {
        answerLimits(api);

        await page.goto('/statutory/limits');

        await expect(page.getByRole('heading', { name: 'Manage participants limits for a statutory event' })).toBeVisible();
        await expect(page.getByLabel('Select event type')).toHaveValue('agora');
        await expect(page.getByText('Total bodies listed: 4')).toBeVisible();
        await expect(page.getByText('Bodies with custom limits: 1')).toBeVisible();

        const table = limitsTable(page);
        await expect(tableRows(table)).toHaveCount(4);
        const alpha = rowOf(page, 'AEGEE-Alpha');
        await expect(alpha.getByRole('link', { name: 'AEGEE-Alpha' })).toHaveAttribute('href', '/bodies/10');
        await expect(await cellOf(table, alpha, 'Body type')).toHaveText('Antenna');
        await expect(await cellOf(table, alpha, 'Delegates')).toHaveText('5');
        await expect(await cellOf(table, alpha, 'Envoys')).toHaveText('0');
        await expect(await cellOf(table, alpha, 'Observers')).toHaveText('0');
        await expect(await cellOf(table, alpha, 'Visitors')).toHaveText('10');
        await expect(alpha.getByRole('button', { name: 'Use default' })).toBeVisible();

        const beta = rowOf(page, 'AEGEE-Beta');
        await expect(await cellOf(table, beta, 'Body type')).toHaveText('Contact antenna');
        await expect(await cellOf(table, beta, 'Envoys')).toHaveText('3');
        await expect(beta.getByRole('button', { name: 'Use default' })).toHaveCount(0);
        await expect(beta.getByRole('button', { name: 'Edit' })).toBeVisible();

        // No limit is "Unlimited".
        await expect(await cellOf(table, rowOf(page, 'AEGEE-Gamma'), 'Observers')).toHaveText('Unlimited');
        // A stored limit that is the same as the default counts as the default (Rik, 2026-11-23).
        await expect(rowOf(page, 'AEGEE-Delta').getByRole('button', { name: 'Use default' })).toHaveCount(0);

        // The bodies are asked for once.
        expect(api.callsTo('GET core /bodies')).toHaveLength(1);
    });

    test('a limit is changed, and an emptied value means unlimited', async ({ page, api }) => {
        answerLimits(api);
        api.json('POST statutory /limits/:type', ok(paxLimit({ id: 3, body_id: 11, delegate: 0, envoy: null, observer: 0, visitor: 15 })));

        await page.goto('/statutory/limits');
        const beta = rowOf(page, 'AEGEE-Beta');
        await beta.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('spinbutton', { name: 'Delegates of AEGEE-Beta' })).toHaveValue('0');
        await page.getByRole('spinbutton', { name: 'Envoys of AEGEE-Beta' }).fill('');
        await page.getByRole('spinbutton', { name: 'Visitors of AEGEE-Beta' }).fill('15');
        await beta.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Limit is saved.')).toBeVisible();
        const table = limitsTable(page);
        await expect(await cellOf(table, beta, 'Envoys')).toHaveText('Unlimited');
        await expect(await cellOf(table, beta, 'Visitors')).toHaveText('15');
        await expect(beta.getByRole('button', { name: 'Use default' })).toBeVisible();
        await expect(page.getByText('Bodies with custom limits: 2')).toBeVisible();
        expect(api.callsTo('POST statutory /limits/:type').map((call) => [call.params.type, call.body]))
            .toEqual([['agora', { body_id: 11, delegate: 0, envoy: null, observer: 0, visitor: 15 }]]);
    });

    test('a limit saved back to the default values counts as the default again', async ({ page, api }) => {
        answerLimits(api);
        api.json('POST statutory /limits/:type', ok(paxLimit({ body_id: 10 })));

        await page.goto('/statutory/limits');
        const alpha = rowOf(page, 'AEGEE-Alpha');
        await alpha.getByRole('button', { name: 'Edit' }).click();
        await page.getByRole('spinbutton', { name: 'Delegates of AEGEE-Alpha' }).fill('3');
        await page.getByRole('spinbutton', { name: 'Visitors of AEGEE-Alpha' }).fill('30');
        await alpha.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Limit is saved.')).toBeVisible();
        await expect(alpha.getByRole('button', { name: 'Use default' })).toHaveCount(0);
        await expect(page.getByText('Bodies with custom limits: 0')).toBeVisible();
    });

    test('a limit that may not be changed says so and stays open for editing', async ({ page, api }) => {
        answerLimits(api);
        api.on('POST statutory /limits/:type', { status: 403, json: forbidden('You are not allowed to change limits.') });

        await page.goto('/statutory/limits');
        const beta = rowOf(page, 'AEGEE-Beta');
        await beta.getByRole('button', { name: 'Edit' }).click();
        await page.getByRole('spinbutton', { name: 'Visitors of AEGEE-Beta' }).fill('15');
        await beta.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Error saving limit: You are not allowed to change limits.')).toBeVisible();
        await expect(page.getByRole('spinbutton', { name: 'Visitors of AEGEE-Beta' })).toHaveValue('15');
        await expect(beta.getByRole('button', { name: 'Save' })).toBeVisible();
    });

    test('"Use default" drops the body\'s own limit and shows the default', async ({ page, api }) => {
        let limits = AGORA_LIMITS;
        api.on('GET statutory /limits/:type', () => ({ json: ok(limits) }));
        api.on('GET statutory /limits/:type/defaults', () => ({ json: ok(BODIES.map((item) => defaultPaxLimit(item))) }));
        api.json('GET core /bodies', ok(BODIES));
        api.on('DELETE statutory /limits/:type/:body_id', () => {
            limits = [defaultPaxLimit(ALPHA), ...AGORA_LIMITS.slice(1)];
            return { json: { success: true, message: 'The limit for a body 10 was deleted, using default one now.' } };
        });

        await page.goto('/statutory/limits');
        const alpha = rowOf(page, 'AEGEE-Alpha');
        await alpha.getByRole('button', { name: 'Use default' }).click();

        await expect(toast(page, 'Limit is deleted.')).toBeVisible();
        await expect(await cellOf(limitsTable(page), alpha, 'Delegates')).toHaveText('3');
        await expect(alpha.getByRole('button', { name: 'Use default' })).toHaveCount(0);
        expect(api.callsTo('DELETE statutory /limits/:type/:body_id').map((call) => call.params)).toEqual([{ type: 'agora', body_id: '10' }]);
        // The limits are asked for again; the app isn't loaded again.
        expect(api.callsTo('GET statutory /limits/:type')).toHaveLength(2);
        expect(api.callsTo('GET core /members/me')).toHaveLength(1);
    });

    test('a limit that is already gone says so', async ({ page, api }) => {
        answerLimits(api);
        api.on('DELETE statutory /limits/:type/:body_id', { status: 404, json: notFound('There\'s no limit for body with the ID 10.') });

        await page.goto('/statutory/limits');
        await rowOf(page, 'AEGEE-Alpha').getByRole('button', { name: 'Use default' }).click();

        await expect(toast(page, 'Error deleting limit: There\'s no limit for body with the ID 10.')).toBeVisible();
    });

    test('choosing EPM lists the limits for EPMs', async ({ page, api }) => {
        answerLimits(api, { agora: AGORA_LIMITS, epm: BODIES.map((item) => defaultPaxLimit(item, 'epm')) });

        await page.goto('/statutory/limits');
        await expect(await cellOf(limitsTable(page), rowOf(page, 'AEGEE-Alpha'), 'Delegates')).toHaveText('5');
        await page.getByLabel('Select event type').selectOption({ label: 'EPM' });

        await expect(await cellOf(limitsTable(page), rowOf(page, 'AEGEE-Alpha'), 'Envoys')).toHaveText('Unlimited');
        await expect(await cellOf(limitsTable(page), rowOf(page, 'AEGEE-Alpha'), 'Delegates')).toHaveText('0');
        await expect(page.getByText('Bodies with custom limits: 0')).toBeVisible();
        expect(api.callsTo('GET statutory /limits/:type').map((call) => call.params.type)).toEqual(['agora', 'epm']);
        expect(api.callsTo('GET statutory /limits/:type/defaults').map((call) => call.params.type)).toEqual(['agora', 'epm']);
    });

    test('a late answer for the type chosen before doesn\'t replace the limits of the new one', async ({ page, api }) => {
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /limits/:type', async ({ params }) => {
            if (params.type !== 'agora') return { json: ok(BODIES.map((item) => defaultPaxLimit(item, 'epm'))) };
            await held;
            return { json: ok(AGORA_LIMITS) };
        });
        api.on('GET statutory /limits/:type/defaults', ({ params }) => ({ json: ok(BODIES.map((item) => defaultPaxLimit(item, params.type as PaxLimit['event_type']))) }));
        api.json('GET core /bodies', ok(BODIES));

        await page.goto('/statutory/limits');
        await page.getByLabel('Select event type').selectOption({ label: 'EPM' });
        await expect(await cellOf(limitsTable(page), rowOf(page, 'AEGEE-Alpha'), 'Envoys')).toHaveText('Unlimited');

        // Now the answer for Agorae arrives.
        const late = page.waitForResponse((response) => response.url().endsWith('/limits/agora'));
        release();
        await (await late).finished();
        await rowOf(page, 'AEGEE-Alpha').getByRole('button', { name: 'Edit' }).click();

        await expect(page.getByRole('spinbutton', { name: 'Delegates of AEGEE-Alpha' })).toHaveValue('0');
        await expect(page.getByRole('spinbutton', { name: 'Envoys of AEGEE-Alpha' })).toHaveValue('');
        await expect(page.getByText('Bodies with custom limits: 0')).toBeVisible();
    });

    test('without bodies the table is empty', async ({ page, api }) => {
        api.on('GET statutory /limits/:type', { json: ok([]) });
        api.on('GET statutory /limits/:type/defaults', { json: ok([]) });
        api.json('GET core /bodies', ok([]));

        await page.goto('/statutory/limits');

        await expect(page.getByText('Total bodies listed: 0')).toBeVisible();
        await expect(tableRows(limitsTable(page))).toHaveCount(0);
    });

    test('a body core doesn\'t know shows as loading', async ({ page, api }) => {
        api.on('GET statutory /limits/:type', { json: ok([defaultPaxLimit({ id: 99, type: 'antenna' }), ...AGORA_LIMITS]) });
        api.on('GET statutory /limits/:type/defaults', { json: ok(BODIES.map((item) => defaultPaxLimit(item))) });
        api.json('GET core /bodies', ok(BODIES));

        await page.goto('/statutory/limits');

        const unknown = rowOf(page, 'Loading...');
        await expect(unknown.getByRole('link', { name: 'Loading...' })).toHaveAttribute('href', '/bodies/99');
        await expect(await cellOf(limitsTable(page), unknown, 'Body type')).toHaveText('Loading...');
        await unknown.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('spinbutton', { name: 'Delegates of body 99' })).toHaveValue('3');
    });

    test('shows that it is loading until the limits are there', async ({ page, api }) => {
        api.on('GET statutory /limits/:type', { json: ok(AGORA_LIMITS), delayMs: 1000 });
        api.on('GET statutory /limits/:type/defaults', { json: ok(BODIES.map((item) => defaultPaxLimit(item))) });
        api.json('GET core /bodies', ok(BODIES));

        await page.goto('/statutory/limits');

        await expect(page.getByRole('img', { name: 'Loading' })).toBeVisible();
        await expect(rowOf(page, 'AEGEE-Alpha')).toBeVisible();
        await expect(page.getByRole('img', { name: 'Loading' })).toBeHidden();
    });

    // Each service's own text for a failure.
    for (const [failing, route, message] of [
        ['limits', 'GET statutory /limits/:type', 'Internal server error.'],
        ['default limits', 'GET statutory /limits/:type/defaults', 'Internal server error.'],
        ['bodies', 'GET core /bodies', 'Something went wrong on the server.']
    ] as const) {
        test(`when the ${failing} can't be loaded, it says so`, async ({ page, api }) => {
            answerLimits(api);
            api.on(route, { status: 500, json: { success: false, message } });

            await page.goto('/statutory/limits');

            await expect(toast(page, `Could not fetch participants limits: ${message}`)).toBeVisible();
            await expect(page.getByRole('img', { name: 'Loading' })).toBeHidden();
        });
    }
});
