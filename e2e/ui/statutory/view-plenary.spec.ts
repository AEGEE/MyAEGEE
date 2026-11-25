// One plenary of an Agora (/statutory/:id/plenaries/:plenary_id): its times, who attended it,
// and marking delegates and envoys in and out by their application or statutory id.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { statutoryEvent, statutoryEventPermissions } from '../support/factories/statutory-events.ts';
import {
    plenaryAttendance,
    statutoryPlenaryWithAttendances,
    type PlenaryAttendance,
    type StatutoryPlenaryWithAttendances
} from '../support/factories/statutory-plenaries.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const CHAIR = statutoryEventPermissions({ manage_plenaries: true, see_plenaries: true, mark_attendance: true });

// Alex left the plenary already; Jan is still there.
const ALEX_LEFT = plenaryAttendance({
    id: 30,
    starts: '2027-03-02T08:05:00.000Z',
    ends: '2027-03-02T09:10:30.000Z',
    application: { id: 12, statutory_id: '005-0001', first_name: 'Alex', last_name: 'Member', body_name: 'AEGEE-Antenna' }
});
const JAN_THERE = plenaryAttendance({
    id: 31,
    starts: '2027-03-02T08:20:00.000Z',
    application: { id: 14, statutory_id: '005-0002', first_name: 'Jan', last_name: 'Jansen', body_name: 'AEGEE-Utrecht', participant_type: 'envoy' }
});

const PLENARY = statutoryPlenaryWithAttendances({
    id: 2,
    event_id: 5,
    name: 'Opening plenary',
    starts: '2027-03-02T08:00:00.000Z',
    ends: '2027-03-02T12:00:00.000Z',
    attendances: [JAN_THERE, ALEX_LEFT]
});

const showPlenary = (api: ApiMock, plenary: StatutoryPlenaryWithAttendances = PLENARY): void => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring', permissions: CHAIR })));
    api.json('GET statutory /events/:id/plenaries/:plenary_id', ok(plenary));
};

const attendances = (page: Page) => page.getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(attendances(page)).filter({ hasText: name });
const idField = (page: Page) => page.getByLabel('Application ID or statutory ID');
const mark = async (page: Page, id: string): Promise<void> => {
    await idField(page).fill(id);
    await idField(page).press('Enter');
};

test.describe('a plenary and its attendances', () => {
    test('shows the plenary, who came and who is still there', async ({ page, api }) => {
        showPlenary(api);

        await page.goto('/statutory/agora-spring/plenaries/2');

        await expect(page.getByRole('heading', { name: 'Plenary details', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Plenary details and marking attendance');
        await expect(page.getByRole('listitem').filter({ hasText: 'Name:' })).toHaveText('Name: Opening plenary');
        await expect(page.getByRole('listitem').filter({ hasText: 'Starts at:' })).toHaveText('Starts at: 2027-03-02 09:00');
        await expect(page.getByRole('listitem').filter({ hasText: 'Ends at:' })).toHaveText('Ends at: 2027-03-02 13:00');

        const table = attendances(page);
        await expect(tableRows(table)).toHaveCount(2);
        // The newest attendance first, as the service sends them.
        await expect(tableRows(table).first()).toContainText('Jan Jansen');
        const alex = rowOf(page, 'Alex Member');
        await expect(await cellOf(table, alex, '#')).toHaveText('30');
        await expect(await cellOf(table, alex, 'Application ID')).toHaveText('12');
        await expect(await cellOf(table, alex, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(await cellOf(table, alex, 'Starts')).toHaveText('2027-03-02 09:05:00');
        await expect(await cellOf(table, alex, 'Ends')).toHaveText('2027-03-02 10:10:30');
        const jan = rowOf(page, 'Jan Jansen');
        await expect(await cellOf(table, jan, 'Starts')).toHaveText('2027-03-02 09:20:00');
        await expect(await cellOf(table, jan, 'Ends')).toHaveText('');
        await expect(page.getByRole('button', { name: 'Add attendance info' })).toBeEnabled();
    });

    test('a plenary nobody came to yet says so', async ({ page, api }) => {
        showPlenary(api, statutoryPlenaryWithAttendances({ ...PLENARY, attendances: [] }));

        await page.goto('/statutory/agora-spring/plenaries/2');

        await expectEmptyTable(attendances(page));
    });

    test('a delegate who arrives is marked in by statutory id and listed first', async ({ page, api }) => {
        showPlenary(api);
        const arrived: PlenaryAttendance = plenaryAttendance({
            id: 32,
            starts: '2027-03-02T09:30:00.000Z',
            application: { id: 15, statutory_id: '005-0003', first_name: 'Ana', last_name: 'Silva', body_name: 'AEGEE-Lisboa' }
        });
        api.json('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark', ok(arrived));

        await page.goto('/statutory/agora-spring/plenaries/2');
        await mark(page, '005-0003');

        await expect(toast(page, 'Successfully marked application 15 as present.')).toBeVisible();
        const table = attendances(page);
        await expect(tableRows(table)).toHaveCount(3);
        await expect(tableRows(table).first()).toContainText('Ana Silva');
        await expect(await cellOf(table, rowOf(page, 'Ana Silva'), 'Starts')).toHaveText('2027-03-02 10:30:00');
        await expect(idField(page)).toHaveValue('');
        expect(api.callsTo('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'agora-spring', plenary_id: '2' }, { application_id: '005-0003' }]]);
    });

    test('a delegate who leaves is marked out by application id, and their row gets its end', async ({ page, api }) => {
        showPlenary(api);
        api.json('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark', ok({ ...JAN_THERE, ends: '2027-03-02T10:45:00.000Z' }));

        await page.goto('/statutory/agora-spring/plenaries/2');
        await mark(page, '14');

        await expect(toast(page, 'Successfully marked application 14 as left.')).toBeVisible();
        const table = attendances(page);
        await expect(tableRows(table)).toHaveCount(2);
        await expect(await cellOf(table, rowOf(page, 'Jan Jansen'), 'Ends')).toHaveText('2027-03-02 11:45:00');
        await expect(idField(page)).toHaveValue('');
        expect(api.callsTo('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark').map((call) => call.body)).toEqual([{ application_id: '14' }]);
    });

    test('an attendance is marked once while the service answers, however often Enter is pressed', async ({ page, api }) => {
        showPlenary(api);
        api.on('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark', { json: ok({ ...JAN_THERE, ends: '2027-03-02T10:45:00.000Z' }), delayMs: 1000 });

        await page.goto('/statutory/agora-spring/plenaries/2');
        await mark(page, '14');
        await expect(page.getByRole('button', { name: 'Add attendance info' })).toBeDisabled();
        await idField(page).press('Enter');

        await expect(toast(page, 'Successfully marked application 14 as left.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add attendance info' })).toBeEnabled();
        expect(api.callsTo('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark')).toHaveLength(1);
    });

    const REFUSALS: [number, string][] = [
        [403, 'The plenary is over already, cannot mark any more members.'],
        [403, 'The applicant is not a delegate or envoy.'],
        [404, 'The application is not found.']
    ];
    for (const [status, message] of REFUSALS) {
        test(`a refused mark says "${message}"`, async ({ page, api }) => {
            showPlenary(api);
            api.on('POST statutory /events/:id/plenaries/:plenary_id/attendance/mark', { status, json: forbidden(message) });

            await page.goto('/statutory/agora-spring/plenaries/2');
            await mark(page, '005-0009');

            await expect(toast(page, `Could not mark attendance: ${message}`)).toBeVisible();
            await expect(idField(page)).toHaveValue('');
            await expect(tableRows(attendances(page))).toHaveCount(2);
            await expect(page.getByRole('button', { name: 'Add attendance info' })).toBeEnabled();
        });
    }

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });

        await page.goto('/statutory/nope/plenaries/2');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('an unknown plenary, or one of another event, says the plenary is not found', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring', permissions: CHAIR })));
        api.on('GET statutory /events/:id/plenaries/:plenary_id', { status: 404, json: notFound('Plenary is not found.') });

        await page.goto('/statutory/agora-spring/plenaries/99');

        await expect(toast(page, 'Plenary is not found')).toBeVisible();
        await expect(toast(page, 'Event is not found')).toHaveCount(0);
        await expect(page).toHaveURL('/statutory');
    });

    test('who may not see the plenary goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring' })));
        api.on('GET statutory /events/:id/plenaries/:plenary_id', { status: 403, json: forbidden('You cannot see this plenary.') });

        await page.goto('/statutory/agora-spring/plenaries/2');

        await expect(toast(page, 'Some error happened: You cannot see this plenary.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('when the event can\'t be loaded, it says so and goes back to the list', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Internal server error.' } });

        await page.goto('/statutory/agora-spring/plenaries/2');

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
