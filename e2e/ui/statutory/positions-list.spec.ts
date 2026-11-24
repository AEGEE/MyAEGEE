// The positions of an Agora (/statutory/:id/positions/:prefix): "View candidates" (`approved`)
// for every member, with applying and the approved candidatures, and "Manage candidates"
// (`all`) for the Juridical Commission, with every candidature, their statuses and the
// positions themselves. The two modals of the page are in positions-list-modals.spec.ts.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { body, type Body } from '../support/factories/core.ts';
import {
    approvedCandidate, listedCandidate, myCandidature, pendingCandidateSummary, positionWithCandidates,
    type MyCandidature, type PositionWithCandidates
} from '../support/factories/statutory-candidates.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEvent } from '../support/factories/statutory-events.ts';
import { cellOf, dialog, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const XSS = '**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)';

const CD_BODY = body({ id: 3, name: 'Comité Directeur', type: 'other', task_description: 'Runs the **network** between two Agorae.' });
const JC_BODY = body({ id: 4, name: 'Juridical Commission', type: 'other', task_description: null });
const BODIES: Body[] = [CD_BODY, JC_BODY];

const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({ id: 1, url: 'agora-spring', ...overrides });
const JC = statutoryEventPermissions({ manage_candidates: true });

const JAN = { id: 11, user_id: 7, first_name: 'Jan', last_name: 'Jansen', created_at: '2027-01-10T09:30:15.000Z' };
const PIET = { id: 12, user_id: 8, first_name: 'Piet', last_name: 'Pieters', body_name: 'AEGEE-Delft', created_at: '2027-01-11T10:00:00.000Z' };

// The Comité Directeur, open, and the Juridical Commission, closed. As every member sees them:
// Jan's approved candidature in full, Piet's pending one as a summary.
const CD = (candidates: PositionWithCandidates['candidates'] = []) => positionWithCandidates({
    id: 5,
    name: 'Comité Directeur',
    body_id: 3,
    places: 7,
    status: 'open',
    starts: '2027-02-01T09:00:00.000Z',
    ends: '2027-04-06T21:59:00.000Z',
    start_term: '2027-08-01',
    end_term: '2028-07-31',
    requirements: 'Be a member for **2 years**.',
    candidates
});
const JC_POSITION = (candidates: PositionWithCandidates['candidates'] = []) => positionWithCandidates({
    id: 6,
    name: 'Juridical Commission',
    body_id: 4,
    places: 5,
    status: 'closed',
    starts: '2027-01-01T09:00:00.000Z',
    ends: '2027-02-01T09:00:00.000Z',
    requirements: null,
    candidates
});
const APPROVED_LIST = (): PositionWithCandidates[] => [
    CD([approvedCandidate(JAN), pendingCandidateSummary(PIET)]),
    JC_POSITION()
];
const ALL_LIST = (): PositionWithCandidates[] => [
    CD([
        listedCandidate({ ...JAN, status: 'approved', notification_email: 'jan@example.org' }),
        listedCandidate({ ...PIET, body_id: 5, notification_email: 'piet@example.org' })
    ]),
    JC_POSITION()
];

interface PageData {
    event?: StatutoryEvent;
    prefix?: 'all' | 'approved';
    positions?: PositionWithCandidates[];
    mine?: MyCandidature[];
}

const mockPositions = (api: ApiMock, { event = agora(), prefix = 'approved', positions = APPROVED_LIST(), mine = [] }: PageData = {}): void => {
    api.json('GET core /bodies', ok(BODIES));
    api.json('GET statutory /events/:id', ok(event));
    api.json(`GET statutory /events/:id/positions/${prefix}`, ok(positions));
    api.json('GET statutory /events/:id/positions/candidates/mine', ok(mine));
};

const positionsTable = (page: Page) => page.getByRole('region', { name: 'Positions' }).getByRole('table');
const candidatesTable = (page: Page) => page.getByRole('region', { name: 'Applications for selected position' }).getByRole('table');
const positionRow = (page: Page, name: string) => tableRows(positionsTable(page)).filter({ hasText: name });
const candidateRow = (page: Page, name: string) => tableRows(candidatesTable(page)).filter({ hasText: name });

// The picture in XSS (relative to the page) fails to load, which is when its handler would run.
const answerPicture = (api: ApiMock): Promise<void> => new Promise<void>((resolve) => {
    api.url('GET', '/statutory/agora-spring/positions/x', () => {
        resolve();
        return { status: 404, body: '' };
    });
});

const selectPosition = async (page: Page, name: string): Promise<void> => {
    await (await cellOf(positionsTable(page), positionRow(page, name), 'Name')).click();
    await expect(page.getByRole('heading', { name: 'Information about selected position' })).toBeVisible();
};

test.describe('the positions of an Agora', () => {
    test.describe('as every member sees them', () => {
        test('lists the positions with their periods, places and status', async ({ page, api }) => {
            mockPositions(api);
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect(page.getByRole('heading', { name: 'Positions list', exact: true })).toBeVisible();
            await expect(page).toHaveTitle('MyAEGEE | Positions list for Agora');
            await expect(page.getByText('All positions are closed two weeks before the Agora.')).toBeVisible();

            const table = positionsTable(page);
            await expect(tableRows(table)).toHaveCount(2);
            const cd = positionRow(page, 'Comité Directeur');
            await expect(await cellOf(table, cd, '#')).toHaveText('5');
            await expect(await cellOf(table, cd, 'Application period starts')).toHaveText('2027-02-01 10:00');
            await expect(await cellOf(table, cd, 'Application period ends')).toHaveText('2027-04-06 23:59');
            await expect(await cellOf(table, cd, 'Places available')).toHaveText('7');
            // Piet's pending candidature counts too.
            await expect(await cellOf(table, cd, 'Applications')).toHaveText('2');
            await expect(await cellOf(table, cd, 'Status')).toHaveText('open');
            await expect(await cellOf(table, positionRow(page, 'Juridical Commission'), 'Status')).toHaveText('closed');
            await expect(await cellOf(table, positionRow(page, 'Juridical Commission'), 'Applications')).toHaveText('0');

            // Nothing to manage.
            await expect(page.getByRole('button', { name: 'Create a position' })).toHaveCount(0);
            await expect(page.getByRole('link', { name: 'Export candidates' })).toHaveCount(0);
            await expect(page.getByRole('combobox', { name: 'Status of Comité Directeur' })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Edit position Comité Directeur' })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Delete position Comité Directeur' })).toHaveCount(0);

            // The candidatures are asked for at this event.
            expect(api.callsTo('GET statutory /events/:id/positions/candidates/mine').map((call) => call.params.id)).toEqual(['agora-spring']);
        });

        test('a member applies to an open position, not to a closed one', async ({ page, api }) => {
            mockPositions(api);
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect(positionRow(page, 'Comité Directeur').getByRole('link', { name: 'Apply!' }))
                .toHaveAttribute('href', '/statutory/agora-spring/positions/5/apply');
            const closed = positionRow(page, 'Juridical Commission');
            await expect(closed.getByText('You cannot apply.')).toBeVisible();
            await expect(closed.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
        });

        test('a member edits their pending candidature, but not one that was decided on', async ({ page, api }) => {
            mockPositions(api, {
                positions: [CD(), positionWithCandidates({ ...JC_POSITION(), status: 'open' })],
                mine: [myCandidature({ id: 21, position_id: 5, status: 'pending' }), myCandidature({ id: 22, position_id: 6, status: 'approved' })]
            });
            await page.goto('/statutory/agora-spring/positions/approved');

            const cd = positionRow(page, 'Comité Directeur');
            await expect(cd.getByRole('link', { name: 'Edit my application!' }))
                .toHaveAttribute('href', '/statutory/agora-spring/positions/5/candidates/21/edit');
            await expect(cd.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
            const jc = positionRow(page, 'Juridical Commission');
            await expect(jc.getByText('You cannot edit your application.')).toBeVisible();
            await expect(jc.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
            await expect(jc.getByRole('link', { name: 'Edit my application!' })).toHaveCount(0);
            await expect(jc.getByText('You cannot apply.')).toHaveCount(0);
        });

        test('an Agora without positions says so', async ({ page, api }) => {
            mockPositions(api, { positions: [] });
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect.poll(() => api.callsTo('GET statutory /events/:id/positions/candidates/mine')).toHaveLength(1);
            await expectEmptyTable(positionsTable(page));
        });

        test('says while the positions are loading', async ({ page, api }) => {
            mockPositions(api);
            api.on('GET statutory /events/:id/positions/approved', { json: ok(APPROVED_LIST()), delayMs: 1000 });
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect(page.getByRole('region', { name: 'Positions' })).toHaveAttribute('aria-busy', 'true');
            await expect(page.getByRole('region', { name: 'Positions' })).toHaveAttribute('aria-busy', 'false');
            await expect(tableRows(positionsTable(page))).toHaveCount(2);
        });
    });

    test.describe('a selected position', () => {
        test('shows its term, requirements, description and its approved candidatures', async ({ page, api }) => {
            mockPositions(api);
            await page.goto('/statutory/agora-spring/positions/approved');
            await expect(page.getByRole('heading', { name: 'Applications for selected position' })).toHaveCount(0);

            await selectPosition(page, 'Comité Directeur');

            await expect(page.getByText('The term for this position starts on 2027-08-01 and ends on 2028-07-31.')).toBeVisible();
            await expect(page.getByText('This position has the following requirements associated with it:')).toBeVisible();
            await expect(page.getByText('Be a member for 2 years.')).toBeVisible();
            await expect(page.getByRole('strong').filter({ hasText: '2 years' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Description of selected position' })).toBeVisible();
            // The task description of the position's body in core.
            await expect(page.getByRole('strong').filter({ hasText: 'network' })).toBeVisible();
            await expect(page.getByText('Runs the network between two Agorae.')).toBeVisible();

            const table = candidatesTable(page);
            await expect(tableRows(table)).toHaveCount(2);
            const jan = candidateRow(page, 'Jansen');
            await expect(await cellOf(table, jan, '#')).toHaveText('11');
            await expect(await cellOf(table, jan, 'First name')).toHaveText('Jan');
            await expect(await cellOf(table, jan, 'Body')).toHaveText('AEGEE-Utrecht');
            await expect(await cellOf(table, jan, 'Applied on')).toHaveText('2027-01-10 10:30:15');
            await expect(jan.getByRole('button', { name: 'View candidature of Jan Jansen' })).toBeVisible();
            // A pending candidature can't be looked at yet.
            const piet = candidateRow(page, 'Pieters');
            await expect(await cellOf(table, piet, 'Body')).toHaveText('AEGEE-Delft');
            await expect(piet.getByRole('button', { name: /^View/ })).toHaveCount(0);
            // Nothing of the Juridical Commission's.
            await expect(page.getByRole('link', { name: /^Edit candidature of/ })).toHaveCount(0);
            await expect(page.getByRole('combobox', { name: 'Status of Jan Jansen' })).toHaveCount(0);
            await expect(table).not.toContainText('@example.org');
        });

        test('without requirements, a body or its description shows the defaults', async ({ page, api }) => {
            const positions = [
                positionWithCandidates({ id: 7, name: 'No body', body_id: null, requirements: '' }),
                positionWithCandidates({ id: 8, name: 'Unknown body', body_id: 99, requirements: null }),
                // The Juridical Commission has no task description in core.
                JC_POSITION()
            ];
            mockPositions(api, { positions });
            await page.goto('/statutory/agora-spring/positions/approved');

            for (const name of ['No body', 'Unknown body', 'Juridical Commission']) {
                await selectPosition(page, name);
                await expect(page.getByText('A description for this position has not been set.')).toBeVisible();
                await expect(page.getByText('This position has the following requirements associated with it:')).toHaveCount(0);
                await expectEmptyTable(candidatesTable(page));
            }
        });

        test('says when the bodies can\'t be loaded, and shows the default description', async ({ page, api }) => {
            mockPositions(api);
            api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect(toast(page, 'Could not fetch bodies: Something went wrong on the server.')).toBeVisible();
            await selectPosition(page, 'Comité Directeur');
            await expect(page.getByText('A description for this position has not been set.')).toBeVisible();
            await expect(page).toHaveURL('/statutory/agora-spring/positions/approved');
        });

        test('renders the requirements and the description as safe markdown', async ({ page, api }) => {
            api.json('GET core /bodies', ok([body({ ...CD_BODY, task_description: XSS })]));
            api.json('GET statutory /events/:id', ok(agora()));
            api.json('GET statutory /events/:id/positions/approved', ok([positionWithCandidates({ ...CD(), requirements: XSS })]));
            api.json('GET statutory /events/:id/positions/candidates/mine', ok([]));
            const picture = answerPicture(api);
            await page.goto('/statutory/agora-spring/positions/approved');

            await selectPosition(page, 'Comité Directeur');

            await expect(page.getByRole('strong').filter({ hasText: 'bold' })).toHaveCount(2);
            const links = page.getByText('x', { exact: true });
            await expect(links).toHaveCount(2);
            await expect(links.first()).not.toHaveAttribute('href', /javascript:/);
            await expect(links.last()).not.toHaveAttribute('href', /javascript:/);
            await picture;
            expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
        });
    });

    test.describe('managed by the Juridical Commission', () => {
        const manage = (api: ApiMock, positions = ALL_LIST()) => mockPositions(api, { event: agora({ permissions: JC }), prefix: 'all', positions });

        test('lists every candidature, with their email, links to edit and statuses', async ({ page, api }) => {
            manage(api);
            await page.goto('/statutory/agora-spring/positions/all');

            await expect(page.getByRole('button', { name: 'Create a position' })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Export candidates' })).toHaveAttribute('href', '/statutory/agora-spring/positions/export');
            await expect(page.getByRole('combobox', { name: 'Status of Comité Directeur' })).toHaveValue('open');
            await expect(page.getByRole('combobox', { name: 'Status of Juridical Commission' })).toHaveValue('closed');
            await expect(positionRow(page, 'Comité Directeur').getByRole('button', { name: 'Edit position Comité Directeur' })).toBeVisible();
            await expect(positionRow(page, 'Comité Directeur').getByRole('button', { name: 'Delete position Comité Directeur' })).toBeVisible();

            await selectPosition(page, 'Comité Directeur');
            const table = candidatesTable(page);
            const piet = candidateRow(page, 'Pieters');
            await expect(await cellOf(table, piet, 'Email')).toHaveText('piet@example.org');
            await expect(await cellOf(table, candidateRow(page, 'Jansen'), 'Email')).toHaveText('jan@example.org');
            // Pending ones can be looked at, edited and decided on too.
            await expect(piet.getByRole('button', { name: 'View candidature of Piet Pieters' })).toBeVisible();
            await expect(piet.getByRole('link', { name: 'Edit candidature of Piet Pieters' }))
                .toHaveAttribute('href', '/statutory/agora-spring/positions/5/candidates/12/edit');
            await expect(page.getByRole('combobox', { name: 'Status of Piet Pieters' })).toHaveValue('pending');
            await expect(page.getByRole('combobox', { name: 'Status of Jan Jansen' })).toHaveValue('approved');
        });

        test('approves a candidature', async ({ page, api }) => {
            manage(api);
            api.json('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id/status', ok(listedCandidate({ ...PIET, status: 'approved' })));
            await page.goto('/statutory/agora-spring/positions/all');
            await selectPosition(page, 'Comité Directeur');

            await page.getByRole('combobox', { name: 'Status of Piet Pieters' }).selectOption('Approved');

            await expect(toast(page, 'Successfully updated status of candidature for user #8 to "approved"')).toBeVisible();
            expect(api.callsTo('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id/status').map((call) => [call.params, call.body]))
                .toEqual([[{ id: 'agora-spring', position_id: '5', candidate_id: '12' }, { status: 'approved' }]]);
        });

        test('says why a candidature\'s status could not be changed', async ({ page, api }) => {
            manage(api);
            api.on('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id/status', { status: 500, json: { success: false, message: 'Internal server error.' } });
            await page.goto('/statutory/agora-spring/positions/all');
            await selectPosition(page, 'Comité Directeur');

            await page.getByRole('combobox', { name: 'Status of Piet Pieters' }).selectOption('Rejected');

            await expect(toast(page, 'Could not update candidature status: Internal server error.')).toBeVisible();
            await expect(page.getByRole('combobox', { name: 'Status of Piet Pieters' })).toBeEnabled();
        });

        test('closes a position', async ({ page, api }) => {
            manage(api);
            api.json('PUT statutory /events/:id/positions/:position_id/status', ok(positionWithCandidates({ ...CD(), status: 'closed' })));
            await page.goto('/statutory/agora-spring/positions/all');

            await page.getByRole('combobox', { name: 'Status of Comité Directeur' }).selectOption('Closed');

            await expect(toast(page, 'Successfully updated status of application for position "Comité Directeur" to closed.')).toBeVisible();
            // The position can't be applied to any more.
            await expect(positionRow(page, 'Comité Directeur').getByText('You cannot apply.')).toBeVisible();
            expect(api.callsTo('PUT statutory /events/:id/positions/:position_id/status').map((call) => [call.params, call.body]))
                .toEqual([[{ id: 'agora-spring', position_id: '5' }, { status: 'closed' }]]);
        });

        test('says why a position\'s status could not be changed', async ({ page, api }) => {
            manage(api);
            api.on('PUT statutory /events/:id/positions/:position_id/status', { status: 403, json: forbidden('You cannot manage positions.') });
            await page.goto('/statutory/agora-spring/positions/all');

            await page.getByRole('combobox', { name: 'Status of Comité Directeur' }).selectOption('Closed');

            await expect(toast(page, 'Could not update position status: You cannot manage positions.')).toBeVisible();
            await expect(positionRow(page, 'Comité Directeur').getByRole('link', { name: 'Apply!' })).toBeVisible();
        });

        test('removes a position after asking, and only then', async ({ page, api }) => {
            manage(api, [...ALL_LIST(), positionWithCandidates({ id: 9, name: '<b>Bold</b> board', body_id: null })]);
            api.json('DELETE statutory /events/:id/positions/:position_id', { success: true, message: 'The position was deleted.' });
            await page.goto('/statutory/agora-spring/positions/all');

            const bold = positionRow(page, '<b>Bold</b> board');
            await bold.getByRole('button', { name: 'Delete position <b>Bold</b> board' }).click();
            const confirm = dialog(page, 'Removing position');
            // The name is shown as it is written.
            await expect(confirm).toContainText('Are you sure you want to remove the position for <b>Bold</b> board? This action cannot be undone.');
            await confirm.getByRole('button', { name: 'Cancel' }).click();
            await expect(confirm).toHaveCount(0);
            expect(api.callsTo('DELETE statutory /events/:id/positions/:position_id')).toHaveLength(0);

            await selectPosition(page, 'Comité Directeur');
            await positionRow(page, 'Comité Directeur').getByRole('button', { name: 'Delete position Comité Directeur' }).click();
            await dialog(page, 'Removing position').getByRole('button', { name: 'Remove position' }).click();

            await expect(toast(page, 'Position is removed.')).toBeVisible();
            await expect(tableRows(positionsTable(page))).toHaveCount(2);
            await expect(positionRow(page, 'Comité Directeur')).toHaveCount(0);
            await expect(page.getByRole('heading', { name: 'Information about selected position' })).toHaveCount(0);
            expect(api.callsTo('DELETE statutory /events/:id/positions/:position_id').map((call) => call.params)).toEqual([{ id: 'agora-spring', position_id: '5' }]);
        });

        test('says why a position could not be removed', async ({ page, api }) => {
            manage(api);
            api.on('DELETE statutory /events/:id/positions/:position_id', { status: 500, json: { success: false, message: 'Internal server error.' } });
            await page.goto('/statutory/agora-spring/positions/all');

            await positionRow(page, 'Juridical Commission').getByRole('button', { name: 'Delete position Juridical Commission' }).click();
            await dialog(page, 'Removing position').getByRole('button', { name: 'Remove position' }).click();

            await expect(toast(page, 'Could not remove position: Internal server error.')).toBeVisible();
            await expect(tableRows(positionsTable(page))).toHaveCount(2);
        });
    });

    test.describe('when the positions can\'t be shown', () => {
        test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
            api.fallback(mockEverything);
            api.json('GET core /bodies', ok(BODIES));
            api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
            await page.goto('/statutory/nope/positions/approved');

            await expect(toast(page, 'Event is not found')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('a member who may not manage the candidates goes back to the list of statutory events', async ({ page, api }) => {
            api.fallback(mockEverything);
            mockPositions(api, { prefix: 'all' });
            api.on('GET statutory /events/:id/positions/all', { status: 403, json: forbidden('You cannot manage positions.') });
            api.json('GET statutory /events/:id/positions/candidates/mine', ok([]), { optional: 'the candidatures are asked for after the positions only' });
            await page.goto('/statutory/agora-spring/positions/all');

            await expect(toast(page, 'Some error happened: You cannot manage positions.')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('an event that is no Agora goes back to the list of statutory events', async ({ page, api }) => {
            api.fallback(mockEverything);
            mockPositions(api, { event: agora({ type: 'epm', url: 'epm-spring' }) });
            api.on('GET statutory /events/:id/positions/approved', { status: 400, json: { success: false, message: 'You can only access memberslist for Agora.' } });
            api.json('GET statutory /events/:id/positions/candidates/mine', ok([]), { optional: 'the candidatures are asked for after the positions only' });
            await page.goto('/statutory/epm-spring/positions/approved');

            await expect(toast(page, 'Some error happened: You can only access memberslist for Agora.')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('candidatures that can\'t be loaded go back to the list of statutory events', async ({ page, api }) => {
            api.fallback(mockEverything);
            mockPositions(api);
            api.on('GET statutory /events/:id/positions/candidates/mine', { status: 500, json: { success: false, message: 'Internal server error.' } });
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('a network failure goes back to the list of statutory events', async ({ page, api }) => {
            api.fallback(mockEverything);
            mockPositions(api);
            api.on('GET statutory /events/:id/positions/approved', { abort: 'failed' });
            api.json('GET statutory /events/:id/positions/candidates/mine', ok([]), { optional: 'the candidatures are asked for after the positions only' });
            await page.goto('/statutory/agora-spring/positions/approved');

            await expect(toast(page, 'Some error happened: Network Error')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('an address with another kind of list shows the positions every member sees', async ({ page, api }) => {
            mockPositions(api);
            await page.goto('/statutory/agora-spring/positions/pending');

            await expect(page).toHaveURL('/statutory/agora-spring/positions/approved');
            await expect(tableRows(positionsTable(page))).toHaveCount(2);
            expect(api.callsTo('GET statutory /events/:id/positions/approved')).toHaveLength(1);
            expect(api.callsTo('GET statutory /events/:id/positions/pending')).toHaveLength(0);
        });
    });
});
