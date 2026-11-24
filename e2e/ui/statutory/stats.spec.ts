// The application statistics of a statutory event (/statutory/:id/applications/stats): the
// numbers of applications, a chart per breakdown with its data as a table, and the quorum of
// antennae.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { notFound, ok } from '../support/factories/base.ts';
import { body, type Body } from '../support/factories/core.ts';
import { statutoryEvent, type StatutoryEventType } from '../support/factories/statutory-events.ts';
import { statutoryStats, type StatutoryStats } from '../support/factories/statutory-stats.ts';
import { toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', type: 'antenna' });
const UTRECHT = body({ id: 2, name: 'AEGEE-Utrecht', type: 'antenna' });
const CONTACT = body({ id: 3, name: 'AEGEE-Contact', type: 'contact antenna' });

const mockPage = (api: ApiMock, { stats = statutoryStats(), bodies = [ANTENNA, UTRECHT, CONTACT], type = 'agora' }: { stats?: StatutoryStats; bodies?: Body[]; type?: StatutoryEventType } = {}) => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ type, url: 'agora-spring' })));
    api.json('GET statutory /events/:id/applications/stats', ok(stats));
    api.json('GET core /bodies', ok(bodies));
};

// The table that holds what a chart shows.
const dataOf = (page: Page, chart: string) => page.getByRole('table', { name: chart, exact: true });
const rowsOf = (page: Page, chart: string) => dataOf(page, chart).getByRole('row').filter({ has: page.getByRole('cell') });

test.describe('the application statistics of a statutory event', () => {
    test('show the numbers, a chart per breakdown and the quorum', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(page.getByRole('heading', { name: 'Application statistics for Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Applications statistics for statutory event');

        const numbers = page.getByRole('table', { name: 'Numbers of applications' });
        for (const row of [
            'Total applications: 5', 'Cancelled applications: 1', 'Pending applications: 1', 'Waiting list applications: 1',
            'Rejected applications: 0', 'Accepted applications: 2', 'Confirmed: 1', 'Arrived: 0'
        ]) {
            await expect(numbers.getByRole('row', { name: row, exact: true })).toBeVisible();
        }

        for (const chart of [
            'Applications by date', 'Applications by date (cumulative)', 'Applications by participant type', 'Applications by body',
            'Applications by gender', 'Applications by meal preference', 'Applications by number of Agorae visited', 'Quorum'
        ]) {
            await expect(page.getByRole('img', { name: chart, exact: true })).toBeVisible();
        }
        for (const heading of [
            'By date', 'By date (cumulative)', 'By participant type', 'By body', 'By gender', 'By meal preference',
            'By number of Agorae visited', 'Quorum'
        ]) {
            await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        }

        await expect(rowsOf(page, 'Applications by date')).toHaveText([/2027-02-20\s*3/, /2027-02-21\s*1/]);
        await expect(rowsOf(page, 'Applications by date (cumulative)')).toHaveText([/2027-02-20\s*3/, /2027-02-21\s*4/]);
        await expect(rowsOf(page, 'Applications by participant type')).toHaveText([/delegate \(2\)\s*2/, /visitor \(1\)\s*1/, /Not set \(1\)\s*1/]);
        // The bodies by their names in core.
        await expect(rowsOf(page, 'Applications by body')).toHaveText([/AEGEE-Antenna \(3\)\s*3/, /AEGEE-Utrecht \(1\)\s*1/]);
        await expect(page.getByRole('list', { name: 'Bodies' }).getByRole('listitem')).toHaveText(['AEGEE-Antenna (3)', 'AEGEE-Utrecht (1)']);
        // male, F and non-binary
        await expect(rowsOf(page, 'Applications by gender')).toHaveText([/Male \(2\)\s*2/, /Female \(1\)\s*1/, /Other \(1\)\s*1/]);
        await expect(rowsOf(page, 'Applications by meal preference')).toHaveText([/Vegetarian \(2\)\s*2/, /Meat-eater \(1\)\s*1/, /Vegan \(1\)\s*1/]);
        await expect(rowsOf(page, 'Applications by number of Agorae visited')).toHaveText([/0 \(2\)\s*2/, /3 \(2\)\s*2/]);

        // Two of the antennae are represented; the contact antenna doesn't count.
        await expect(page.getByText('2 of 2 antennae represented by non-cancelled applications. Required: 1 (50%).')).toBeVisible();
        await expect(rowsOf(page, 'Quorum')).toHaveText([/Represented \(100\.00%\)\s*2/, /Not represented \(0\.00%\)\s*0/]);

        expect(api.callsTo('GET statutory /events/:id/applications/stats').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('genders are counted as male, female or other', async ({ page, api }) => {
        mockPage(api, {
            stats: statutoryStats({
                by_gender: [{ type: 'm', value: 1 }, { type: ' Male ', value: 2 }, { type: 'F ', value: 3 }, { type: 'female', value: 1 }, { type: 'other', value: 4 }, { type: '', value: 1 }]
            })
        });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(rowsOf(page, 'Applications by gender')).toHaveText([/Male \(3\)\s*3/, /Female \(4\)\s*4/, /Other \(5\)\s*5/]);
    });

    test('a meal that has no colour of its own is still shown', async ({ page, api }) => {
        mockPage(api, { stats: statutoryStats({ by_meal: [{ type: 'Pescatarian', value: 2 }, { type: 'Vegan', value: 1 }] }) });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(rowsOf(page, 'Applications by meal preference')).toHaveText([/Pescatarian \(2\)\s*2/, /Vegan \(1\)\s*1/]);
    });

    test('a body core doesn\'t list is shown by its id', async ({ page, api }) => {
        mockPage(api, { stats: statutoryStats({ by_body: [{ type: 1, value: 3 }, { type: 99, value: 1 }] }) });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(rowsOf(page, 'Applications by body')).toHaveText([/AEGEE-Antenna \(3\)\s*3/, /99 \(1\)\s*1/]);
        await expect(page.getByRole('list', { name: 'Bodies' }).getByRole('listitem')).toHaveText(['AEGEE-Antenna (3)', '99 (1)']);
    });

    test('bodies past the 25 colours get a grey tag', async ({ page, api }) => {
        const many = Array.from({ length: 26 }, (_, index) => body({ id: 100 + index, name: `AEGEE-Body ${index + 1}` }));
        mockPage(api, { bodies: many, stats: statutoryStats({ by_body: many.map((item) => ({ type: item.id, value: 1 })) }) });
        await page.goto('/statutory/agora-spring/applications/stats');

        const tags = page.getByRole('list', { name: 'Bodies' }).getByRole('listitem');
        await expect(tags).toHaveCount(26);
        await expect(rowsOf(page, 'Applications by body')).toHaveCount(26);
        // The 25th colour, with white text on it.
        await expect(tags.nth(24)).toHaveAttribute('style', /background-color: rgb\(22, 62, 122\); color: rgb\(255, 255, 255\)/);
        await expect(tags.nth(25)).toHaveText('AEGEE-Body 26 (1)');
        await expect(tags.nth(25)).not.toHaveAttribute('style', /color/);
    });

    test('the quorum counts the antennae only', async ({ page, api }) => {
        const another = body({ id: 4, name: 'AEGEE-Fourth', type: 'antenna' });
        mockPage(api, {
            bodies: [ANTENNA, UTRECHT, CONTACT, another],
            // The contact antenna and a body core doesn't list don't count.
            stats: statutoryStats({ quorum: { accepted_only: false, body_ids: [1, 3, 99] } })
        });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(page.getByText('1 of 3 antennae represented by non-cancelled applications. Required: 2 (50%).')).toBeVisible();
        await expect(rowsOf(page, 'Quorum')).toHaveText([/Represented \(33\.33%\)\s*1/, /Not represented \(66\.67%\)\s*2/]);
    });

    test('without antennae the quorum is 0%', async ({ page, api }) => {
        mockPage(api, { bodies: [CONTACT] });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(page.getByText('0 of 0 antennae represented by non-cancelled applications. Required: 0 (50%).')).toBeVisible();
        await expect(rowsOf(page, 'Quorum')).toHaveText([/Represented \(0\.00%\)\s*0/, /Not represented \(0\.00%\)\s*0/]);
    });

    test('once the participants list is published the quorum counts accepted delegates only', async ({ page, api }) => {
        mockPage(api, { stats: statutoryStats({ quorum: { accepted_only: true, body_ids: [2] } }) });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(page.getByText('1 of 2 antennae represented by accepted non-cancelled delegate applications. Required: 1 (50%).')).toBeVisible();
    });

    for (const [type, plural] of [['agora', 'Agorae'], ['epm', 'EPMs'], ['spm', 'SPMs']] as const) {
        test(`the events visited are counted as ${plural} for an ${type}`, async ({ page, api }) => {
            mockPage(api, { type });
            await page.goto('/statutory/agora-spring/applications/stats');

            await expect(page.getByRole('heading', { name: `By number of ${plural} visited` })).toBeVisible();
            await expect(page.getByRole('img', { name: `Applications by number of ${plural} visited` })).toBeVisible();
        });
    }

    test('an event without applications shows empty charts', async ({ page, api }) => {
        mockPage(api, {
            stats: statutoryStats({
                numbers: { total: 0, accepted: 0, rejected: 0, pending: 0, waiting_list: 0, cancelled: 0, confirmed: 0, registered: 0, attended: 0, departed: 0 },
                quorum: { accepted_only: false, body_ids: [] },
                by_date: [],
                by_date_cumulative: [],
                by_gender: [],
                by_meal: [],
                by_type: [],
                by_body: [],
                by_number_of_events_visited: []
            })
        });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(page.getByText('0 of 2 antennae represented by non-cancelled applications. Required: 1 (50%).')).toBeVisible();
        await expect(page.getByRole('table', { name: 'Numbers of applications' }).getByRole('row', { name: 'Total applications: 0' })).toBeVisible();
        await expect(page.getByRole('img', { name: 'Applications by gender' })).toBeVisible();
        await expect(rowsOf(page, 'Applications by date')).toHaveCount(0);
        await expect(rowsOf(page, 'Applications by body')).toHaveCount(0);
        // Grouping the genders always gives the three groups.
        await expect(rowsOf(page, 'Applications by gender')).toHaveText([/Male \(0\)\s*0/, /Female \(0\)\s*0/, /Other \(0\)\s*0/]);
        await expect(page.getByRole('list', { name: 'Bodies' }).getByRole('listitem')).toHaveCount(0);
    });

    test('bodies that can\'t be loaded leave the statistics with the ids of the bodies', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring' })));
        api.json('GET statutory /events/:id/applications/stats', ok(statutoryStats()));
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(toast(page, 'Could not load the bodies: Database is down')).toBeVisible();
        await expect(rowsOf(page, 'Applications by body')).toHaveText([/1 \(3\)\s*3/, /2 \(1\)\s*1/]);
        await expect(page.getByRole('table', { name: 'Numbers of applications' }).getByRole('row', { name: 'Total applications: 5' })).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/stats');
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/applications/stats');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('statistics that can\'t be loaded send the viewer back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring' })));
        api.on('GET statutory /events/:id/applications/stats', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/applications/stats');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
