// The votes of an Agora (/statutory/:id/votes): how many votes each antenna has and how they
// are shared among its delegates, and the export of the antennas' votes for the voting tool.
// Every logged-in member may see them: the tests run as a member without any statutory
// permission, and the page asks for no event.
import fs from 'node:fs';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { badRequest, notFound, ok } from '../support/factories/base.ts';
import { body, type Body } from '../support/factories/core.ts';
import { votesPerAntenna, votesPerDelegate, type VotesPerAntenna, type VotesPerDelegate } from '../support/factories/statutory-memberslists.ts';
import { cellOf, freezeTime, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', code: 'ANT' });
const UTRECHT = body({ id: 3, name: 'AEGEE-Utrecht', code: 'UTR' });

const ANTENNA_VOTES = votesPerAntenna({ id: 40, body_id: 1, votes: 1 });
const UTRECHT_VOTES = votesPerAntenna({ id: 41, body_id: 3, votes: 3 });

// Utrecht's two delegates share its three votes: before the Agora both confirmed ones, at the
// Agora only the one who is there.
const JAN_ON = votesPerDelegate({ id: 50, application_id: 13, user_id: 7, body_id: 3, type: 'on-event', votes: 3, application: { statutory_id: '001-0002', user_id: 7, body_id: 3 } });
const JAN_OFF = votesPerDelegate({ id: 51, application_id: 13, user_id: 7, body_id: 3, type: 'off-event', votes: 2, application: { statutory_id: '001-0002', user_id: 7, body_id: 3 } });
const PIM_OFF = votesPerDelegate({ id: 52, application_id: 14, user_id: 8, body_id: 3, type: 'off-event', votes: 1, application: { statutory_id: '001-0003', user_id: 8, body_id: 3 } });

interface Votes {
    antennae?: VotesPerAntenna[];
    delegates?: VotesPerDelegate[];
    bodies?: Body[];
}

const mockVotes = (api: ApiMock, { antennae = [UTRECHT_VOTES, ANTENNA_VOTES], delegates = [JAN_ON, JAN_OFF, PIM_OFF], bodies = [ANTENNA, UTRECHT] }: Votes = {}): void => {
    api.json('GET statutory /events/:id/votes-amounts/antenna', ok(antennae));
    api.json('GET statutory /events/:id/votes-amounts/delegate', ok(delegates));
    api.json('GET core /bodies', ok(bodies));
};

const byAntenna = (page: Page) => page.getByRole('table', { name: 'By antenna' });
const byDelegate = (page: Page) => page.getByRole('table', { name: 'By delegate' });
const exportLink = (page: Page) => page.getByRole('link', { name: 'Export list of votes' });

test.describe('the votes of an Agora', () => {
    test('shows the votes of each antenna and of each delegate', async ({ page, api }) => {
        mockVotes(api);
        await page.goto('/statutory/agora-spring/votes');

        await expect(page.getByRole('heading', { name: 'Votes amount', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Votes amount per antenna/delegates');

        const antennae = byAntenna(page);
        await expect(tableRows(antennae)).toHaveCount(2);
        const utrecht = tableRows(antennae).filter({ hasText: 'AEGEE-Utrecht' });
        await expect(await cellOf(antennae, utrecht, 'Body Code')).toHaveText('UTR');
        await expect(await cellOf(antennae, utrecht, 'Votes')).toHaveText('3');
        await expect(utrecht.getByRole('link', { name: 'AEGEE-Utrecht' })).toHaveAttribute('href', '/bodies/3');
        await expect(await cellOf(antennae, tableRows(antennae).filter({ hasText: 'AEGEE-Antenna' }), 'Body Code')).toHaveText('ANT');

        // The votes before the Agora come first.
        const delegates = byDelegate(page);
        await expect(tableRows(delegates)).toHaveCount(3);
        await expect(tableRows(delegates).nth(0)).toContainText('off-event');
        await expect(tableRows(delegates).nth(1)).toContainText('off-event');
        await expect(tableRows(delegates).nth(2)).toContainText('on-event');
        const pim = tableRows(delegates).filter({ hasText: '001-0003' });
        await expect(await cellOf(delegates, pim, 'Statutory ID')).toHaveText('001-0003');
        await expect(await cellOf(delegates, pim, 'User ID')).toHaveText('8');
        await expect(await cellOf(delegates, pim, 'Body')).toHaveText('AEGEE-Utrecht');
        await expect(await cellOf(delegates, pim, 'Type')).toHaveText('off-event');
        await expect(await cellOf(delegates, pim, 'Votes')).toHaveText('1');
        await expect(pim.getByRole('link', { name: 'AEGEE-Utrecht' })).toHaveAttribute('href', '/bodies/3');

        expect(api.callsTo('GET statutory /events/:id/votes-amounts/antenna').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
        expect(api.callsTo('GET statutory /events/:id/votes-amounts/delegate').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('the votes of the antennas are exported as a text file for the voting tool', async ({ page, api }) => {
        await freezeTime(page);
        mockVotes(api);
        await page.goto('/statutory/agora-spring/votes');

        const download = page.waitForEvent('download');
        await exportLink(page).click();

        // One line per antenna: its code, a tab and its votes. Named after the moment of the
        // export (Chromium may write the colons differently).
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/^exportVotes_agora-spring_2027-03-01T09.00.\d\d\.\d{3}Z\.txt$/);
        expect(fs.readFileSync(await file.path(), 'utf8')).toBe('UTR\t3\nANT\t1\n');
    });

    test('an antenna whose body core doesn\'t list any more is shown and exported by its id', async ({ page, api }) => {
        const gone = votesPerAntenna({ id: 42, body_id: 9, votes: 2 });
        const delegate = votesPerDelegate({ id: 53, body_id: 9, application: { statutory_id: '001-0009', user_id: 2, body_id: 9 } });
        mockVotes(api, { antennae: [UTRECHT_VOTES, gone], delegates: [delegate], bodies: [UTRECHT] });
        await page.goto('/statutory/agora-spring/votes');

        const antennae = byAntenna(page);
        const row = tableRows(antennae).filter({ hasText: 'Unknown body (#9)' });
        await expect(await cellOf(antennae, row, 'Body Code')).toHaveText('-');
        await expect(row.getByRole('link', { name: 'Unknown body (#9)' })).toHaveAttribute('href', '/bodies/9');
        await expect(await cellOf(byDelegate(page), tableRows(byDelegate(page)), 'Body')).toHaveText('Unknown body (#9)');

        const download = page.waitForEvent('download');
        await exportLink(page).click();
        expect(fs.readFileSync(await (await download).path(), 'utf8')).toBe('UTR\t3\n#9\t2\n');
    });

    test('an Agora without votes says so', async ({ page, api }) => {
        mockVotes(api, { antennae: [], delegates: [] });
        await page.goto('/statutory/agora-spring/votes');

        await expect(byAntenna(page).getByRole('row', { name: 'No votes yet!' })).toBeVisible();
        await expect(tableRows(byAntenna(page))).toHaveCount(1);
        await expect(byDelegate(page).getByRole('row', { name: 'No votes yet!' })).toBeVisible();
        await expect(tableRows(byDelegate(page))).toHaveCount(1);
    });

    test('the tables say they are loading while the votes come', async ({ page, api }) => {
        api.on('GET statutory /events/:id/votes-amounts/antenna', { json: ok([ANTENNA_VOTES]), delayMs: 1000 });
        api.json('GET statutory /events/:id/votes-amounts/delegate', ok([]));
        api.on('GET core /bodies', { json: ok([ANTENNA]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/votes');

        await expect(byAntenna(page).getByRole('row', { name: 'Loading...' })).toBeVisible();
        await expect(byDelegate(page).getByRole('row', { name: 'Loading...' })).toBeVisible();
        await expect(exportLink(page)).toHaveCount(0);

        // The votes are there before the names of the bodies.
        const row = tableRows(byAntenna(page)).filter({ hasText: '1' });
        await expect(await cellOf(byAntenna(page), row, 'Votes')).toHaveText('1');
        await expect(await cellOf(byAntenna(page), row, 'Body')).toHaveText('Loading...');
        await expect(byDelegate(page).getByRole('row', { name: 'No votes yet!' })).toBeVisible();

        await expect(await cellOf(byAntenna(page), row, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(exportLink(page)).toBeVisible();
    });

    test('bodies that can\'t be loaded are said so, and there is nothing to export', async ({ page, api }) => {
        mockVotes(api);
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/votes');

        await expect(toast(page, 'Could not fetch bodies: Database is down')).toBeVisible();
        await expect(await cellOf(byAntenna(page), tableRows(byAntenna(page)).filter({ hasText: '3' }), 'Body')).toHaveText('Unknown body (#3)');
        await expect(exportLink(page)).toHaveCount(0);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id/votes-amounts/antenna', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/votes');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('an event that is no Agora has no votes', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id/votes-amounts/antenna', { status: 400, json: badRequest('You can only access memberslist for Agora.') });
        await page.goto('/statutory/epm-spring/votes');

        await expect(toast(page, 'Some error happened: You can only access memberslist for Agora.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('votes of the delegates that can\'t be loaded go back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id/votes-amounts/antenna', ok([ANTENNA_VOTES]));
        api.on('GET statutory /events/:id/votes-amounts/delegate', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/votes');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
