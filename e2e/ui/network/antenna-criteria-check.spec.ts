// The Antenna Criteria check (/network/ac_check): for an Agora, which antennae, contact antennae
// and contacts fulfil the criteria they need to (a contact one, a contact antenna three, an
// antenna all eight), for the Network Commission to see who is in danger. Board election,
// members list, fee and events are worked out from what network, statutory, events and
// summeruniversity answer; network keeps the values set by hand, which win.
// The dialogs the table opens are covered in antenna-criteria-check-edit.spec.ts and
// antenna-criteria-check-mail.spec.ts.
import type { Locator, Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import {
    antennaCriterion, netcomAssignment, networkRecentEvent, networkRecentStatutoryEvent, networkRecentSummerUniversity, recentBoardElection,
    type AntennaCriterionName
} from '../support/factories/network.ts';
import {
    AUTUMN_AGORA, NETWORK_COMMISSION, SPRING_AGORA, acCheck, acTable, memberslist, mockAcCheck, netcommie, networkManager
} from '../support/network-helpers.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ALPHA = body({ id: 11, name: 'AEGEE-Alpha', type: 'antenna' });
const BETA = body({ id: 12, name: 'AEGEE-Beta', type: 'contact antenna' });
const GAMMA = body({ id: 13, name: 'AEGEE-Gamma', type: 'contact' });
const WORKING_GROUP = body({ id: 14, name: 'IT Working Group', type: 'working group' });
const NORA = netcommie(41, 'Nora', { gsuite: 'nora@aegee.eu' });
const OTTO = netcommie(42, 'Otto');

const criterion = (bodyId: number, name: AntennaCriterionName, value: 'true' | 'false' | 'exception' | null, agoraId = SPRING_AGORA.id) => antennaCriterion({
    agora_id: agoraId, body_id: bodyId, antenna_criterion: name, value, comment: null
});

const rowOf = (page: Page, name: string): Locator => tableRows(acTable(page)).filter({ hasText: name });
const cell = async (page: Page, name: string, column: string): Promise<Locator> => cellOf(acTable(page), rowOf(page, name), column);
// The eight criteria, by the short names of the column headers on a window up to 2320 pixels wide.
const CRITERIA = ['C', 'BE', 'ML', 'F', 'E', 'AA', 'DP', 'FR'];
const tags = async (page: Page, name: string): Promise<string[]> => {
    const texts: string[] = [];
    for (const column of CRITERIA) texts.push(((await (await cell(page, name, column)).textContent()) ?? '').trim());
    return texts;
};

const loaded = async (page: Page): Promise<void> => {
    await expect(acTable(page)).toBeVisible();
    await expect(acCheck(page)).not.toHaveAttribute('aria-busy');
};

test.describe('Antenna Criteria check', () => {
    test.beforeEach(({ myPermissions }) => {
        myPermissions.splice(0, myPermissions.length, ...networkManager());
    });

    test('loads the most recent Agora and shows each Local with its type, NetCommie and status', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [ALPHA, BETA, GAMMA, WORKING_GROUP, NETWORK_COMMISSION],
            netcommies: [NORA, OTTO],
            assignments: [netcomAssignment({ body_id: ALPHA.id, netcom_id: NORA.user_id }), netcomAssignment({ body_id: BETA.id, netcom_id: OTTO.user_id })],
            elections: [recentBoardElection({ body_id: ALPHA.id, latest_election: '2026-12-01' })],
            memberslists: [memberslist({ event_id: SPRING_AGORA.id, body_id: ALPHA.id }), memberslist({ event_id: SPRING_AGORA.id, body_id: BETA.id })],
            events: [networkRecentEvent({ organizing_bodies: [{ body_id: ALPHA.id }], latest_event: '2026-09-30T16:00:00.000Z' })],
            criteria: [
                ...(['communication', 'agora attendance', 'development plan', 'fulfilment report'] as const).map((name) => criterion(ALPHA.id, name, 'true')),
                criterion(BETA.id, 'communication', 'false'),
                criterion(GAMMA.id, 'communication', 'exception')
            ]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(page.getByLabel('Selected Agora').getByRole('option')).toHaveText(['Agora Spring 2027', 'Agora Autumn 2026']);
        await expect(page.getByLabel('Selected Agora').getByRole('option', { selected: true })).toHaveText('Agora Spring 2027');
        const rows = tableRows(acTable(page));
        await expect(rows).toHaveCount(3);
        await expect(rowOf(page, 'IT Working Group')).toHaveCount(0);
        await expect(rowOf(page, 'Network Commission')).toHaveCount(0);

        await expect((await cell(page, 'AEGEE-Alpha', 'Body name')).getByRole('link', { name: 'AEGEE-Alpha' })).toHaveAttribute('href', '/bodies/11');
        await expect(await cell(page, 'AEGEE-Alpha', 'Type')).toHaveText('A');
        await expect(await cell(page, 'AEGEE-Beta', 'Type')).toHaveText('CA');
        await expect(await cell(page, 'AEGEE-Gamma', 'Type')).toHaveText('C');
        await expect(await cell(page, 'AEGEE-Alpha', 'NetCom')).toHaveText('Nora');
        await expect(await cell(page, 'AEGEE-Beta', 'NetCom')).toHaveText('Otto');
        await expect(await cell(page, 'AEGEE-Gamma', 'NetCom')).toHaveText('Not set');
        await expect(await cell(page, 'AEGEE-Alpha', 'Status')).toHaveText('Safe');
        await expect(await cell(page, 'AEGEE-Beta', 'Status')).toHaveText('Danger');
        await expect(await cell(page, 'AEGEE-Gamma', 'Status')).toHaveText('Safe');
        expect(await tags(page, 'AEGEE-Alpha')).toEqual(['Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes']);

        // Everything for the Agora that was chosen: its id, and its end as the day up to which
        // elections and events count.
        expect(api.callsTo('GET statutory /').map((call) => Object.fromEntries(call.query))).toEqual([{ type: 'agora' }]);
        expect(api.callsTo('GET core /bodies').map((call) => Object.fromEntries(call.query))).toEqual([{}, { query: 'network commission' }]);
        expect(api.callsTo('GET core /bodies/:id/members').map((call) => call.params)).toEqual([{ id: '90' }]);
        expect(api.callsTo('GET network /netcom')).toHaveLength(1);
        for (const route of ['GET network /boards/recents', 'GET events /recents', 'GET statutory /recents', 'GET summeruniversity /recents']) {
            expect(api.callsTo(route).map((call) => Object.fromEntries(call.query)), route).toEqual([{ ends: SPRING_AGORA.ends }]);
        }
        expect(api.callsTo('GET statutory /events/:id/memberslists').map((call) => call.params)).toEqual([{ id: '7' }]);
        expect(api.callsTo('GET network /antennaCriteria/:agora_id').map((call) => call.params)).toEqual([{ agora_id: '7' }]);
        expect(api.callsTo('GET network /mailComponent/:agora_id').map((call) => call.params)).toEqual([{ agora_id: '7' }]);
    });

    test('the tag of a criterion says whether it is met, excused, missed, not needed or not set', async ({ page, api }) => {
        const delta = body({ id: 15, name: 'AEGEE-Delta', type: 'antenna' });
        mockAcCheck(api, {
            bodies: [delta, BETA, GAMMA],
            netcommies: [NORA],
            criteria: [
                criterion(delta.id, 'communication', 'exception'),
                criterion(delta.id, 'board election', 'false'),
                criterion(delta.id, 'membership fee', 'exception'),
                criterion(delta.id, 'events', 'true'),
                criterion(delta.id, 'agora attendance', 'false'),
                criterion(delta.id, 'development plan', null),
                criterion(BETA.id, 'communication', 'true'),
                criterion(BETA.id, 'members list', 'true'),
                criterion(BETA.id, 'membership fee', 'true'),
                criterion(GAMMA.id, 'communication', 'false'),
                // Set for a criterion a contact doesn't need.
                criterion(GAMMA.id, 'events', 'true')
            ]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        expect(await tags(page, 'AEGEE-Delta')).toEqual(['Exception', 'No', 'Empty', 'Exception', 'Yes', 'No', 'Empty', 'Empty']);
        await expect(await cell(page, 'AEGEE-Delta', 'Status')).toHaveText('Danger');
        expect(await tags(page, 'AEGEE-Beta')).toEqual(['Yes', 'Else', 'Yes', 'Yes', 'Else', 'Else', 'Else', 'Else']);
        await expect(await cell(page, 'AEGEE-Beta', 'Status')).toHaveText('Safe');
        expect(await tags(page, 'AEGEE-Gamma')).toEqual(['No', 'Else', 'Else', 'Else', 'Yes', 'Else', 'Else', 'Else']);
        await expect(await cell(page, 'AEGEE-Gamma', 'Status')).toHaveText('Danger');
    });

    test('board election is met by an election in the year before the Agora ends', async ({ page, api }) => {
        const recent = body({ id: 21, name: 'AEGEE-Recent', type: 'antenna' });
        const older = body({ id: 22, name: 'AEGEE-Older', type: 'antenna' });
        const later = body({ id: 23, name: 'AEGEE-Later', type: 'antenna' });
        const none = body({ id: 24, name: 'AEGEE-None', type: 'antenna' });
        mockAcCheck(api, {
            bodies: [recent, older, later, none],
            netcommies: [NORA],
            elections: [
                recentBoardElection({ body_id: recent.id, latest_election: '2026-05-01' }),
                recentBoardElection({ body_id: older.id, latest_election: '2026-04-01' }),
                recentBoardElection({ body_id: later.id, latest_election: '2027-05-01' }),
                // A body the page doesn't list.
                recentBoardElection({ body_id: 99, latest_election: '2027-01-01' })
            ]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-Recent', 'BE')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Older', 'BE')).toHaveText('No');
        await expect(await cell(page, 'AEGEE-Later', 'BE')).toHaveText('No');
        await expect(await cell(page, 'AEGEE-None', 'BE')).toHaveText('Empty');

        await acCheck(page).getByRole('button', { name: 'Show detailed information' }).click();
        await expect(await cell(page, 'AEGEE-Recent', 'BE')).toHaveText('1/5/2026');
        await expect(await cell(page, 'AEGEE-Older', 'BE')).toHaveText('1/4/2026');
        await expect(await cell(page, 'AEGEE-Later', 'BE')).toHaveText('1/5/2027');
        await expect(await cell(page, 'AEGEE-None', 'BE')).toHaveText('No');
    });

    test('members list and fee follow the uploaded members list and what is still owed', async ({ page, api }) => {
        const paid = body({ id: 21, name: 'AEGEE-Paid', type: 'antenna' });
        const owes = body({ id: 22, name: 'AEGEE-Owes', type: 'contact antenna' });
        const missing = body({ id: 23, name: 'AEGEE-Missing', type: 'antenna' });
        mockAcCheck(api, {
            bodies: [paid, owes, missing],
            netcommies: [NORA],
            memberslists: [
                memberslist({ event_id: SPRING_AGORA.id, body_id: paid.id, fee_not_paid: 0 }),
                memberslist({ event_id: SPRING_AGORA.id, body_id: owes.id, fee_not_paid: 12.5 })
            ]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-Paid', 'ML')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Paid', 'F')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Owes', 'ML')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Owes', 'F')).toHaveText('Empty');
        await expect(await cell(page, 'AEGEE-Owes', 'Status')).toHaveText('Danger');
        await expect(await cell(page, 'AEGEE-Missing', 'ML')).toHaveText('Empty');
        await expect(await cell(page, 'AEGEE-Missing', 'F')).toHaveText('Empty');
    });

    test('events are met by the latest European event, statutory event or Summer University in the two years before the Agora', async ({ page, api }) => {
        const european = body({ id: 21, name: 'AEGEE-European', type: 'antenna' });
        const statutory = body({ id: 22, name: 'AEGEE-Statutory', type: 'antenna' });
        const old = body({ id: 23, name: 'AEGEE-Old', type: 'antenna' });
        mockAcCheck(api, {
            bodies: [european, statutory, old],
            netcommies: [NORA],
            events: [
                networkRecentEvent({ organizing_bodies: [{ body_id: european.id }], latest_event: '2025-09-30T16:00:00.000Z' }),
                networkRecentEvent({ organizing_bodies: [{ body_id: old.id }, { body_id: 99 }], latest_event: '2023-07-31T16:00:00.000Z' })
            ],
            statutoryEvents: [
                networkRecentStatutoryEvent({ body_id: statutory.id, latest_event: '2026-05-03T16:00:00.000Z' }),
                networkRecentStatutoryEvent({ body_id: european.id, latest_event: '2024-11-03T16:00:00.000Z' }),
                networkRecentStatutoryEvent({ body_id: 99, latest_event: '2026-11-03T16:00:00.000Z' })
            ],
            summerUniversities: [
                // Organised together: the later one counts for both.
                networkRecentSummerUniversity({ organizing_bodies: [{ body_id: european.id }, { body_id: old.id }], latest_event: '2025-01-15T16:00:00.000Z' })
            ]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-European', 'E')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Statutory', 'E')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Old', 'E')).toHaveText('No');

        await acCheck(page).getByRole('button', { name: 'Show detailed information' }).click();
        await expect(await cell(page, 'AEGEE-European', 'E')).toHaveText('9/2025');
        await expect(await cell(page, 'AEGEE-Statutory', 'E')).toHaveText('5/2026');
        await expect(await cell(page, 'AEGEE-Old', 'E')).toHaveText('1/2025');
    });

    test('values set by hand win over the ones worked out', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [ALPHA],
            netcommies: [NORA],
            elections: [recentBoardElection({ body_id: ALPHA.id, latest_election: '2026-12-01' })],
            memberslists: [memberslist({ event_id: SPRING_AGORA.id, body_id: ALPHA.id })],
            criteria: [criterion(ALPHA.id, 'board election', 'false'), criterion(ALPHA.id, 'members list', 'exception')]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-Alpha', 'BE')).toHaveText('No');
        await expect(await cell(page, 'AEGEE-Alpha', 'ML')).toHaveText('Exception');
        await expect(await cell(page, 'AEGEE-Alpha', 'F')).toHaveText('Yes');
    });

    test('the detailed information shows dates instead of yes and no, and the basic information again', async ({ page, api }) => {
        const excused = body({ id: 21, name: 'AEGEE-Excused', type: 'antenna' });
        mockAcCheck(api, {
            bodies: [ALPHA, excused, BETA],
            netcommies: [NORA],
            elections: [recentBoardElection({ body_id: ALPHA.id, latest_election: '2026-12-01' })],
            events: [networkRecentEvent({ organizing_bodies: [{ body_id: ALPHA.id }], latest_event: '2026-09-30T16:00:00.000Z' })],
            criteria: [criterion(excused.id, 'board election', 'exception'), criterion(excused.id, 'events', 'exception')]
        });

        await page.goto('/network/ac_check');
        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Show detailed information' }).click();

        await expect(await cell(page, 'AEGEE-Alpha', 'BE')).toHaveText('1/12/2026');
        await expect(await cell(page, 'AEGEE-Alpha', 'E')).toHaveText('9/2026');
        await expect(await cell(page, 'AEGEE-Alpha', 'C')).toHaveText('Empty');
        await expect(await cell(page, 'AEGEE-Excused', 'BE')).toHaveText('Exception');
        await expect(await cell(page, 'AEGEE-Excused', 'E')).toHaveText('Exception');
        // A contact antenna needs neither.
        await expect(await cell(page, 'AEGEE-Beta', 'BE')).toHaveText('Else');
        await expect(await cell(page, 'AEGEE-Beta', 'E')).toHaveText('Else');

        await acCheck(page).getByRole('button', { name: 'Show basic information' }).click();
        await expect(await cell(page, 'AEGEE-Alpha', 'BE')).toHaveText('Yes');
        await expect(acCheck(page).getByRole('button', { name: 'Show detailed information' })).toBeVisible();
    });

    test('"Show only Locals in danger" leaves out the safe ones until all are shown again', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [BETA, GAMMA],
            netcommies: [NORA],
            criteria: [criterion(GAMMA.id, 'communication', 'true')]
        });

        await page.goto('/network/ac_check');
        await loaded(page);
        await expect(tableRows(acTable(page))).toHaveCount(2);

        await acCheck(page).getByRole('button', { name: 'Show only Locals in danger' }).click();
        await expect(tableRows(acTable(page))).toHaveCount(1);
        await expect(rowOf(page, 'AEGEE-Beta')).toHaveCount(1);

        await acCheck(page).getByRole('button', { name: 'Show all Locals' }).click();
        await expect(tableRows(acTable(page))).toHaveCount(2);
    });

    test('choosing another Agora checks the criteria for that Agora', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [ALPHA],
            netcommies: [NORA],
            override: {
                'GET network /antennaCriteria/:agora_id': ({ params }) => ({
                    json: ok([criterion(ALPHA.id, 'communication', params.agora_id === '6' ? 'true' : 'false', Number(params.agora_id))])
                })
            }
        });

        await page.goto('/network/ac_check');
        await loaded(page);
        await expect(await cell(page, 'AEGEE-Alpha', 'C')).toHaveText('No');

        await page.getByLabel('Selected Agora').selectOption({ label: 'Agora Autumn 2026' });

        await expect(await cell(page, 'AEGEE-Alpha', 'C')).toHaveText('Yes');
        await loaded(page);
        expect(api.callsTo('GET network /antennaCriteria/:agora_id').map((call) => call.params.agora_id)).toEqual(['7', '6']);
        expect(api.callsTo('GET statutory /events/:id/memberslists').map((call) => call.params.id)).toEqual(['7', '6']);
        expect(api.callsTo('GET network /mailComponent/:agora_id').map((call) => call.params.agora_id)).toEqual(['7', '6']);
        for (const route of ['GET network /boards/recents', 'GET events /recents', 'GET statutory /recents', 'GET summeruniversity /recents']) {
            expect(api.callsTo(route).map((call) => call.query.get('ends')), route).toEqual([SPRING_AGORA.ends, AUTUMN_AGORA.ends]);
        }
        // The Agorae are only asked for once.
        expect(api.callsTo('GET statutory /')).toHaveLength(1);
    });

    test('after a quick change of Agora only the chosen Agora\'s criteria are shown', async ({ page, api }) => {
        const held = { spring: (): void => {}, autumn: (): void => {} };
        const springHeld = new Promise<void>((resolve) => { held.spring = resolve; });
        const autumnHeld = new Promise<void>((resolve) => { held.autumn = resolve; });
        mockAcCheck(api, {
            bodies: [ALPHA],
            netcommies: [NORA],
            override: {
                'GET network /antennaCriteria/:agora_id': async ({ params }) => {
                    if (params.agora_id === '7') {
                        await springHeld;
                        return { json: ok([criterion(ALPHA.id, 'communication', 'false'), criterion(ALPHA.id, 'agora attendance', 'true')]) };
                    }
                    await autumnHeld;
                    return { json: ok([criterion(ALPHA.id, 'communication', 'true', AUTUMN_AGORA.id)]) };
                }
            }
        });

        await page.goto('/network/ac_check');
        await expect(acCheck(page)).toHaveAttribute('aria-busy', 'true');
        await page.getByLabel('Selected Agora').selectOption({ label: 'Agora Autumn 2026' });
        await expect.poll(() => api.callsTo('GET network /netcom')).toHaveLength(2);

        // The answer for the Agora that is no longer chosen comes first, then the one for the
        // chosen Agora.
        held.spring();
        await expect.poll(() => api.callsTo('GET network /antennaCriteria/:agora_id').map((call) => call.params.agora_id)).toEqual(['7']);
        held.autumn();

        await expect(await cell(page, 'AEGEE-Alpha', 'C')).toHaveText('Yes');
        await loaded(page);
        await expect(await cell(page, 'AEGEE-Alpha', 'AA')).toHaveText('Empty');
    });

    test('a window up to 2320 pixels wide abbreviates the criteria and types, a wider one writes them out', async ({ page, api }) => {
        mockAcCheck(api, { bodies: [ALPHA, BETA, GAMMA], netcommies: [NORA] });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-Beta', 'Type')).toHaveText('CA');
        // The short header says what it stands for when it has the focus (or the pointer).
        await acTable(page).getByText('FR', { exact: true }).focus();
        await expect(page.getByRole('tooltip')).toHaveText('Fulfilment report');

        await page.setViewportSize({ width: 2400, height: 900 });
        await expect(await cell(page, 'AEGEE-Alpha', 'Type')).toHaveText('Antenna');
        await expect(await cell(page, 'AEGEE-Beta', 'Type')).toHaveText('Contact antenna');
        await expect(await cell(page, 'AEGEE-Gamma', 'Type')).toHaveText('Contact');
        for (const header of ['Communication (C)', 'Board election (BE)', 'Members list (ML)', 'Membership fee (F)', 'Events (E)', 'Agora attendance (AA)', 'Development plan (DP)', 'Fulfilment report (FR)']) {
            await expect(await cell(page, 'AEGEE-Alpha', header), header).toHaveText('Empty');
        }
        await expect(acTable(page).getByText('FR', { exact: true })).toHaveCount(0);

        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(await cell(page, 'AEGEE-Alpha', 'Type')).toHaveText('A');
    });

    test('sorts the Locals by name, type, NetCommie and status', async ({ page, api }) => {
        const delta = body({ id: 15, name: 'AEGEE-Delta', type: 'antenna' });
        mockAcCheck(api, {
            bodies: [GAMMA, delta, BETA, ALPHA],
            netcommies: [NORA, OTTO],
            assignments: [
                netcomAssignment({ body_id: ALPHA.id, netcom_id: OTTO.user_id }),
                netcomAssignment({ body_id: GAMMA.id, netcom_id: NORA.user_id }),
                netcomAssignment({ body_id: delta.id, netcom_id: NORA.user_id })
            ],
            criteria: [criterion(GAMMA.id, 'communication', 'true'), criterion(BETA.id, 'communication', 'true')]
        });
        const names = async (): Promise<string[]> => {
            const result: string[] = [];
            for (const row of await tableRows(acTable(page)).all()) result.push(((await (await cellOf(acTable(page), row, 'Body name')).textContent()) ?? '').trim());
            return result;
        };

        await page.goto('/network/ac_check');
        await loaded(page);
        await expect(tableRows(acTable(page))).toHaveCount(4);

        // The table keeps its columns on a phone too (no cards), so its headers are clicked there as well.
        await sortBy(acTable(page), 'Body name', 'desktop');
        await expect.poll(names).toEqual(['AEGEE-Alpha', 'AEGEE-Beta', 'AEGEE-Delta', 'AEGEE-Gamma']);
        // Antenna, contact, contact antenna.
        await sortBy(acTable(page), 'Type', 'desktop');
        await expect.poll(names).toEqual(['AEGEE-Alpha', 'AEGEE-Delta', 'AEGEE-Gamma', 'AEGEE-Beta']);
        // By first name: Nora, Not set, Otto.
        await sortBy(acTable(page), 'NetCom', 'desktop');
        await expect.poll(names).toEqual(['AEGEE-Delta', 'AEGEE-Gamma', 'AEGEE-Beta', 'AEGEE-Alpha']);
        // Danger before Safe.
        await sortBy(acTable(page), 'Status', 'desktop');
        await expect.poll(names).toEqual(['AEGEE-Delta', 'AEGEE-Beta', 'AEGEE-Alpha', 'AEGEE-Gamma']);
    });

    test('without the fulfilment mail permission there is no way to the mails, and no mail texts are asked for', async ({ page, api, myPermissions }) => {
        myPermissions.splice(0, myPermissions.length, ...networkManager(['global:manage_network:fulfilment_email']));
        mockAcCheck(api, { bodies: [ALPHA], netcommies: [NORA], mailComponents: null });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(acCheck(page).getByRole('button', { name: 'Edit criteria for AEGEE-Alpha' })).toBeVisible();
        await expect(acCheck(page).getByRole('button', { name: 'Change fulfilment email text' })).toHaveCount(0);
        await expect(acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Alpha' })).toHaveCount(0);
        await expect(toast(page, /Could not fetch mail components/)).toHaveCount(0);
    });

    test('with the fulfilment mail permission there are buttons to change the texts and to send the mail', async ({ page, api }) => {
        mockAcCheck(api, { bodies: [ALPHA, BETA], netcommies: [NORA] });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(acCheck(page).getByRole('button', { name: 'Change fulfilment email text' })).toBeVisible();
        await expect(acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Alpha' })).toBeVisible();
        await expect(acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Beta' })).toBeVisible();
    });

    test('takes the permissions from the session instead of asking for them again', async ({ page, api }) => {
        mockAcCheck(api, { bodies: [ALPHA], netcommies: [NORA] });

        await page.goto('/network/ac_check');
        await loaded(page);
        await expect(acCheck(page).getByRole('button', { name: 'Change fulfilment email text' })).toBeVisible();

        // The app asked once, when it started.
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(1);
    });

    test('says so when there is no Agora to check', async ({ page, api }) => {
        api.json('GET statutory /', ok([]));

        await page.goto('/network/ac_check');

        await expect(toast(page, 'Could not fetch statutory data: no Agora data available')).toBeVisible();
        await expectEmptyTable(acTable(page));
    });

    test('says so when the Agorae cannot be loaded', async ({ page, api }) => {
        api.on('GET statutory /', { status: 500, json: { success: false, message: 'Statutory is down' } });

        await page.goto('/network/ac_check');

        await expect(toast(page, 'Could not fetch statutory data: Statutory is down')).toBeVisible();
        await expectEmptyTable(acTable(page));
    });

    test('says so when the bodies cannot be loaded, and stops loading', async ({ page, api }) => {
        api.json('GET statutory /', ok([SPRING_AGORA]));
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Core is down' } });

        await page.goto('/network/ac_check');

        await expect(toast(page, 'Could not fetch bodies: Core is down')).toBeVisible();
        await expect(acCheck(page)).not.toHaveAttribute('aria-busy');
        await expectEmptyTable(acTable(page));
    });

    for (const [route, message] of [
        ['GET network /boards/recents', 'Could not fetch boards data'],
        ['GET statutory /events/:id/memberslists', 'Could not fetch members list data'],
        ['GET events /recents', 'Could not fetch event data'],
        ['GET statutory /recents', 'Could not fetch statutory event data'],
        ['GET summeruniversity /recents', 'Could not fetch Summer University data'],
        ['GET network /antennaCriteria/:agora_id', 'Could not fetch manual Antenna Criteria fulfilment'],
        ['GET core /bodies/:id/members', 'Could not fetch NetCom data'],
        ['GET network /mailComponent/:agora_id', 'Could not fetch mail components']
    ] as const) {
        test(`says so when ${route} fails, and fills in the rest`, async ({ page, api }) => {
            const otherSource = route === 'GET network /antennaCriteria/:agora_id'
                ? { elections: [recentBoardElection({ body_id: ALPHA.id, latest_election: '2026-12-01' })] }
                : { criteria: [criterion(ALPHA.id, 'board election', 'true')] };
            mockAcCheck(api, {
                bodies: [ALPHA],
                netcommies: [NORA],
                assignments: [netcomAssignment({ body_id: ALPHA.id, netcom_id: NORA.user_id })],
                ...otherSource,
                override: { [route]: { status: 500, json: { success: false, message: 'Down' } } }
            });

            await page.goto('/network/ac_check');

            await expect(toast(page, `${message}: Down`)).toBeVisible();
            await loaded(page);
            await expect(await cell(page, 'AEGEE-Alpha', 'BE')).toHaveText('Yes');
        });
    }

    test('says so when the NetCom assignment cannot be loaded, and fills in the rest', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [ALPHA],
            criteria: [criterion(ALPHA.id, 'communication', 'true')],
            netcommies: null,
            override: { 'GET network /netcom': { status: 403, json: { success: false, message: 'You are not allowed to list NetCom assignment.' } } }
        });

        await page.goto('/network/ac_check');

        await expect(toast(page, 'Could not fetch NetCom assignment: You are not allowed to list NetCom assignment.')).toBeVisible();
        await loaded(page);
        await expect(await cell(page, 'AEGEE-Alpha', 'C')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Alpha', 'NetCom')).toHaveText('');
    });

    test('without a Network Commission body every Local has no NetCommie set', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [ALPHA, BETA],
            netcomBodies: [],
            netcommies: null,
            assignments: [netcomAssignment({ body_id: ALPHA.id, netcom_id: NORA.user_id })]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-Alpha', 'NetCom')).toHaveText('Not set');
        await expect(await cell(page, 'AEGEE-Beta', 'NetCom')).toHaveText('Not set');
        await expect(toast(page, /Could not fetch/)).toHaveCount(0);
    });

    test('a members list or a value set by hand for a body that is not listed is left out', async ({ page, api }) => {
        mockAcCheck(api, {
            bodies: [ALPHA],
            netcommies: [NORA],
            memberslists: [memberslist({ event_id: SPRING_AGORA.id, body_id: 99 }), memberslist({ event_id: SPRING_AGORA.id, body_id: ALPHA.id })],
            criteria: [criterion(99, 'communication', 'true'), criterion(ALPHA.id, 'communication', 'true')]
        });

        await page.goto('/network/ac_check');
        await loaded(page);

        await expect(await cell(page, 'AEGEE-Alpha', 'ML')).toHaveText('Yes');
        await expect(await cell(page, 'AEGEE-Alpha', 'C')).toHaveText('Yes');
        await expect(toast(page, /Could not fetch/)).toHaveCount(0);
    });
});
