// Participants of a Summer University (/summeruniversity/:id/participants): the organisers'
// table of applications, the four changes per row, the application dialog and the export.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import {
    suApplication, suEvent, suOrganizerPermissions, suParticipantRow, VISA_DETAILS, type SuParticipantRow
} from '../support/factories/summeruniversity.ts';
import { dialog, expectEmptyTable, freezeTime, openMenu, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// What the service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';
const NO_SPOTS_LEFT = 'There are no spots left: the event already has max_participants accepted participants.';
const BUSY = 'Another change to this event is in progress. Please try again.';
const NOT_ALLOWED = 'You don\'t have permissions to change this application.';

const fieldError = (field: string, message: string) => ({ ...validationError({ [field]: [message] }), message });

const alex = (overrides: Partial<SuParticipantRow> = {}) => suParticipantRow({ id: 31, user_id: 2, first_name: 'Alex', last_name: 'Member', ...overrides });
const bea = (overrides: Partial<SuParticipantRow> = {}) => suParticipantRow({
    id: 32, user_id: 3, first_name: 'Bea', last_name: 'Board', body_id: 4, body_name: 'AEGEE-Other', status: 'accepted', ...overrides
});

// The SU and its applications.
const showParticipants = (api: ApiMock, rows: SuParticipantRow[]) => {
    api.json('GET summeruniversity /single/:id', ok(suEvent({
        id: 21, name: 'Mountains and Languages', url: 'mountains', questions: [{ name: '', description: 'Why this SU?' }]
    }), { permissions: suOrganizerPermissions() }));
    api.json('GET summeruniversity /single/:id/applications', ok(rows));
};

// The list the page sends the viewer back to.
const mockList = (api: ApiMock) => {
    api.json('GET summeruniversity /seasons', ok([]));
    api.json('GET summeruniversity /', ok([]));
};

const select = (page: Page, column: 'Status of' | 'Cancelled?' | 'Confirmed?' | 'Attended?', name: string) => page.getByRole('combobox', { name: `${column} ${name}` });

// The value of a row in the dialog of one application.
const detail = (modal: ReturnType<typeof dialog>, label: string) => modal.getByRole('row')
    .filter({ has: modal.page().getByRole('cell', { name: label, exact: true }) })
    .getByRole('cell')
    .filter({ hasNotText: label });

test.describe('participants of a Summer University', () => {
    test('lists the applications with their current values', async ({ page, api }) => {
        showParticipants(api, [
            alex(),
            bea({ confirmed: true, attended: true }),
            suParticipantRow({ id: 33, user_id: 5, first_name: 'Cy', last_name: 'Cancelled', status: 'rejected', cancelled: true })
        ]);

        await page.goto('/summeruniversity/mountains/participants');

        await expect(page).toHaveTitle('MyAEGEE | List/manage participants of the event');
        await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
        await expect(page.getByText('Total applications: 3.')).toBeVisible();
        const table = page.getByRole('table');
        await expect(tableRows(table)).toHaveCount(3);
        await expect(tableRows(table).filter({ hasText: 'Bea Board' }).getByRole('link', { name: 'AEGEE-Other' })).toHaveAttribute('href', '/bodies/4');

        await expect(select(page, 'Status of', 'Alex Member')).toHaveValue('pending');
        await expect(select(page, 'Status of', 'Bea Board')).toHaveValue('accepted');
        await expect(select(page, 'Status of', 'Cy Cancelled')).toHaveValue('rejected');
        // A cancelled application stays cancelled here.
        await expect(select(page, 'Cancelled?', 'Cy Cancelled')).toBeDisabled();
        await expect(select(page, 'Cancelled?', 'Alex Member')).toBeEnabled();
        // Attendance needs the confirmation, and an attended application keeps it.
        await expect(select(page, 'Attended?', 'Alex Member')).toBeDisabled();
        await expect(select(page, 'Confirmed?', 'Alex Member')).toBeEnabled();
        await expect(select(page, 'Confirmed?', 'Bea Board')).toBeDisabled();
        await expect(select(page, 'Attended?', 'Bea Board')).toHaveValue('true');
        await expect(select(page, 'Attended?', 'Bea Board')).toBeEnabled();
    });

    test('changing the status saves it, and an application that is no longer accepted loses its confirmation', async ({ page, api }) => {
        showParticipants(api, [alex(), bea({ confirmed: true })]);
        api.on('PUT summeruniversity /single/:id/applications/:application_id/status', ({ params, body }) => {
            const status = (body as { status: SuParticipantRow['status'] }).status;
            return { json: ok(suApplication({ id: Number(params.application_id), status, confirmed: false })) };
        });

        await page.goto('/summeruniversity/mountains/participants');
        await select(page, 'Status of', 'Alex Member').selectOption('accepted');
        await expect(toast(page, 'Successfully updated status of application for user #2 to "accepted"')).toBeVisible();

        await expect(select(page, 'Confirmed?', 'Bea Board')).toHaveValue('true');
        await select(page, 'Status of', 'Bea Board').selectOption('pending');
        await expect(toast(page, 'Successfully updated status of application for user #3 to "pending"')).toBeVisible();
        await expect(select(page, 'Confirmed?', 'Bea Board')).toHaveValue('false');
        await expect(select(page, 'Attended?', 'Bea Board')).toBeDisabled();

        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/status').map((call) => [call.params, call.body])).toEqual([
            [{ id: 'mountains', application_id: '31' }, { status: 'accepted' }],
            [{ id: 'mountains', application_id: '32' }, { status: 'pending' }]
        ]);
    });

    test('a refused status change shows why and puts the stored status back', async ({ page, api }) => {
        showParticipants(api, [alex(), bea({ attended: true, confirmed: true })]);
        api.on('PUT summeruniversity /single/:id/applications/:application_id/status', ({ params }) => (params.application_id === '31'
            ? { status: 422, json: fieldError('status', NO_SPOTS_LEFT) }
            : { status: 422, json: fieldError('status', 'This application is marked as attended: mark it as not attended before changing its status.') }));

        await page.goto('/summeruniversity/mountains/participants');
        await select(page, 'Status of', 'Alex Member').selectOption('accepted');
        await expect(toast(page, `Could not update participant status: ${NO_SPOTS_LEFT}`)).toBeVisible();
        await expect(select(page, 'Status of', 'Alex Member')).toHaveValue('pending');

        await select(page, 'Status of', 'Bea Board').selectOption('rejected');
        await expect(toast(page, 'Could not update participant status: This application is marked as attended: mark it as not attended before changing its status.')).toBeVisible();
        await expect(select(page, 'Status of', 'Bea Board')).toHaveValue('accepted');
    });

    test('a status change while another change is saved asks to try again', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.on('PUT summeruniversity /single/:id/applications/:application_id/status', { status: 503, json: { success: false, message: BUSY } });

        await page.goto('/summeruniversity/mountains/participants');
        await select(page, 'Status of', 'Alex Member').selectOption('rejected');

        await expect(toast(page, `Could not update participant status: ${BUSY}`)).toBeVisible();
        await expect(select(page, 'Status of', 'Alex Member')).toHaveValue('pending');
    });

    test('cancelling an application saves it and locks "Cancelled?"', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.json('PUT summeruniversity /single/:id/applications/:application_id/cancelled', ok(suApplication({ id: 31, cancelled: true, board_comment: null })));

        await page.goto('/summeruniversity/mountains/participants');
        await select(page, 'Cancelled?', 'Alex Member').selectOption('Yes');

        await expect(toast(page, 'Successfully updated cancellation info of application for user #2')).toBeVisible();
        await expect(select(page, 'Cancelled?', 'Alex Member')).toBeDisabled();
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/cancelled').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'mountains', application_id: '31' }, { cancelled: true }]]);
    });

    test('a failed cancellation shows why and puts the stored value back', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.on('PUT summeruniversity /single/:id/applications/:application_id/cancelled', { status: 503, json: { success: false, message: BUSY } });

        await page.goto('/summeruniversity/mountains/participants');
        await select(page, 'Cancelled?', 'Alex Member').selectOption('Yes');

        await expect(toast(page, `Could not update participant cancellation info: ${BUSY}`)).toBeVisible();
        await expect(select(page, 'Cancelled?', 'Alex Member')).toHaveValue('false');
        await expect(select(page, 'Cancelled?', 'Alex Member')).toBeEnabled();
    });

    test('confirming makes "Attended?" available, and attendance locks "Confirmed?"', async ({ page, api }) => {
        showParticipants(api, [bea()]);
        api.json('PUT summeruniversity /single/:id/applications/:application_id/confirmed', ok(suApplication({ id: 32, status: 'accepted', confirmed: true, board_comment: null })));
        api.json('PUT summeruniversity /single/:id/applications/:application_id/attended', ok(suApplication({ id: 32, status: 'accepted', confirmed: true, attended: true, board_comment: null })));

        await page.goto('/summeruniversity/mountains/participants');
        await expect(select(page, 'Attended?', 'Bea Board')).toBeDisabled();
        await select(page, 'Confirmed?', 'Bea Board').selectOption('Yes');
        await expect(toast(page, 'Successfully updated fee info of application for user #3')).toBeVisible();

        await select(page, 'Attended?', 'Bea Board').selectOption('Yes');
        await expect(toast(page, 'Successfully updated attendance info of application for user #3')).toBeVisible();
        await expect(select(page, 'Confirmed?', 'Bea Board')).toBeDisabled();

        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/confirmed').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'mountains', application_id: '32' }, { confirmed: true }]]);
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/attended').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'mountains', application_id: '32' }, { attended: true }]]);
    });

    test('failed confirmation and attendance changes show why and put the stored values back', async ({ page, api }) => {
        showParticipants(api, [alex(), bea({ confirmed: true })]);
        api.on('PUT summeruniversity /single/:id/applications/:application_id/confirmed', {
            status: 422, json: fieldError('confirmed', 'Only accepted applications that are not cancelled can be confirmed.')
        });
        api.on('PUT summeruniversity /single/:id/applications/:application_id/attended', { status: 403, json: forbidden(NOT_ALLOWED) });

        await page.goto('/summeruniversity/mountains/participants');
        await select(page, 'Confirmed?', 'Alex Member').selectOption('Yes');
        await expect(toast(page, 'Could not update participant fee info: Only accepted applications that are not cancelled can be confirmed.')).toBeVisible();
        await expect(select(page, 'Confirmed?', 'Alex Member')).toHaveValue('false');

        await select(page, 'Attended?', 'Bea Board').selectOption('Yes');
        await expect(toast(page, `Could not update participant attendance info: ${NOT_ALLOWED}`)).toBeVisible();
        await expect(select(page, 'Attended?', 'Bea Board')).toHaveValue('false');
        await expect(select(page, 'Confirmed?', 'Bea Board')).toBeEnabled();
    });

    test('"View" shows the application, with "Unknown" and "-" for what is missing', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.json('GET summeruniversity /single/:id/applications/:application_id', ok(suApplication({
            id: 31,
            gender: null,
            date_of_birth: null,
            allergies: null,
            board_comment: null,
            nationality: 'Belgian',
            created_at: '2027-02-10T09:00:00.000Z',
            answers: ['Because of the mountains']
        }), { permissions: suOrganizerPermissions() }));

        await page.goto('/summeruniversity/mountains/participants');
        await tableRows(page.getByRole('table')).filter({ hasText: 'Alex Member' }).getByRole('button', { name: 'View' }).click();

        const modal = dialog(page, 'View participant');
        await expect(detail(modal, 'First Name')).toHaveText('Alex');
        await expect(detail(modal, 'Last Name')).toHaveText('Member');
        await expect(detail(modal, 'Gender')).toHaveText('Unknown');
        await expect(detail(modal, 'Date of birth')).toHaveText('Unknown');
        await expect(detail(modal, 'Nationality')).toHaveText('Belgian');
        await expect(detail(modal, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(detail(modal, 'Application date')).toHaveText('2027-02-10');
        await expect(detail(modal, 'Email address')).toHaveText('alex.member@example.org');
        await expect(detail(modal, 'Visa required?')).toHaveText('No');
        await expect(detail(modal, 'Meals type')).toHaveText('Vegetarian');
        await expect(detail(modal, 'Allergies')).toHaveText('-');
        await expect(detail(modal, 'Why this SU?')).toHaveText('Because of the mountains');
        await expect(detail(modal, 'Board comment')).toHaveText('-');
        expect(api.callsTo('GET summeruniversity /single/:id/applications/:application_id').map((call) => call.params)).toEqual([{ id: '21', application_id: '31' }]);
    });

    test('"View" shows what the applicant and their board filled in', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.json('GET summeruniversity /single/:id/applications/:application_id', ok(suApplication({
            id: 31, gender: 'neutral', date_of_birth: '1999-05-01', allergies: 'Nuts', board_comment: 'Active member'
        }), { permissions: suOrganizerPermissions() }));

        await page.goto('/summeruniversity/mountains/participants');
        await page.getByRole('button', { name: 'View' }).click();

        const modal = dialog(page, 'View participant');
        await expect(detail(modal, 'Gender')).toHaveText('neutral');
        await expect(detail(modal, 'Date of birth')).toHaveText('1999-05-01');
        await expect(detail(modal, 'Allergies')).toHaveText('Nuts');
        await expect(detail(modal, 'Board comment')).toHaveText('Active member');
    });

    for (const [status, shown] of [['pending', false], ['accepted', true]] as const) {
        test(`the visa details of a ${status} applicant are ${shown ? 'shown' : 'not shown'}`, async ({ page, api }) => {
            showParticipants(api, [alex({ status })]);
            api.json('GET summeruniversity /single/:id/applications/:application_id', ok(
                suApplication({ id: 31, status, ...VISA_DETAILS, board_comment: null }),
                { permissions: suOrganizerPermissions() }
            ));

            await page.goto('/summeruniversity/mountains/participants');
            await page.getByRole('button', { name: 'View' }).click();

            const modal = dialog(page, 'View participant');
            await expect(detail(modal, 'Visa required?')).toHaveText('Yes');
            for (const label of [
                'Visa passport number', 'Visa passport issue date', 'Visa passport expiration date', 'Visa passport issue authority',
                'Visa place of birth', 'Visa embassy', 'Visa street and house number', 'Visa postal code', 'Visa city', 'Visa country'
            ]) {
                await expect(modal.getByRole('cell', { name: label, exact: true })).toBeVisible({ visible: shown });
            }
        });
    }

    test('the application dialog closes', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.json('GET summeruniversity /single/:id/applications/:application_id', ok(suApplication({ id: 31, board_comment: null }), { permissions: suOrganizerPermissions() }));

        await page.goto('/summeruniversity/mountains/participants');
        await page.getByRole('button', { name: 'View' }).click();
        const modal = dialog(page, 'View participant');
        await expect(modal).toBeVisible();
        await modal.getByRole('button', { name: 'close' }).click();

        await expect(modal).toHaveCount(0);
    });

    test('a failing "View" shows why', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.on('GET summeruniversity /single/:id/applications/:application_id', { status: 403, json: forbidden('You are not allowed to see this application.') });

        await page.goto('/summeruniversity/mountains/participants');
        await page.getByRole('button', { name: 'View' }).click();

        await expect(toast(page, 'Could not fetch the application: You are not allowed to see this application.')).toBeVisible();
        await expect(dialog(page, 'View participant')).toHaveCount(0);
    });

    test('the export downloads the participants of this Summer University', async ({ page, api }) => {
        await freezeTime(page);
        showParticipants(api, [alex()]);
        api.on('GET summeruniversity /single/:id/applications/export', {
            body: Buffer.from('a spreadsheet'), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        await page.goto('/summeruniversity/mountains/participants');
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export pending and accepted participants' }).click();

        // The name has the time of the export; the browser turns its colons into underscores.
        expect((await download).suggestedFilename()).toMatch(/^participants_Mountains and Languages_2027-03-01T09_00_\d{2}\.\d{3}Z\.xlsx$/);
        expect(api.callsTo('GET summeruniversity /single/:id/applications/export').map((call) => call.params)).toEqual([{ id: 'mountains' }]);
    });

    test('a failed export shows why', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        api.on('GET summeruniversity /single/:id/applications/export', { status: 403, json: forbidden('You are not allowed to export participants.') });

        await page.goto('/summeruniversity/mountains/participants');
        await page.getByRole('button', { name: 'Export pending and accepted participants' }).click();

        await expect(toast(page, 'Could not export participants: You are not allowed to export participants.')).toBeVisible();
    });

    test('a failed export without a message from the service says what failed', async ({ page, api }) => {
        showParticipants(api, [alex()]);
        // A gateway in between answers with a page of its own.
        api.on('GET summeruniversity /single/:id/applications/export', { status: 502, body: '<html><body>Bad gateway</body></html>', contentType: 'text/html' });

        await page.goto('/summeruniversity/mountains/participants');
        await page.getByRole('button', { name: 'Export pending and accepted participants' }).click();

        await expect(toast(page, 'Could not export participants: Request failed with status code 502')).toBeVisible();
    });

    test('without applications the table says "Nothing here."', async ({ page, api }) => {
        showParticipants(api, []);

        await page.goto('/summeruniversity/mountains/participants');

        await expect(page.getByText('Total applications: 0.')).toBeVisible();
        await expectEmptyTable(page.getByRole('table'));
    });

    test('an unknown Summer University goes back to the list', async ({ page, api }) => {
        api.on('GET summeruniversity /single/:id', { status: 404, json: notFound('Event with id nowhere not found') });
        mockList(api);

        await page.goto('/summeruniversity/nowhere/participants');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('someone who may not see the applications is sent back with the reason', async ({ page, api }) => {
        api.json('GET summeruniversity /single/:id', ok(suEvent({ url: 'mountains' }), { permissions: suOrganizerPermissions('second approval', { list_applications: false }) }));
        api.on('GET summeruniversity /single/:id/applications', { status: 403, json: forbidden('You cannot see applications for this event.') });
        mockList(api);

        await page.goto('/summeruniversity/mountains/participants');

        await expect(toast(page, 'Some error happened: You cannot see applications for this event.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('other errors go back to the list with the message', async ({ page, api }) => {
        api.on('GET summeruniversity /single/:id', { status: 500, json: { success: false, message: DATABASE_DOWN } });
        mockList(api);

        await page.goto('/summeruniversity/mountains/participants');

        await expect(toast(page, `Some error happened: ${DATABASE_DOWN}`)).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('a member who leaves while the SU loads is not sent on by its late error', async ({ page, api, layout }) => {
        let release!: () => void;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET summeruniversity /single/:id', async () => {
            await released;
            return { status: 404, json: notFound('Event with id mountains not found') };
        });
        // The page the member goes to belongs to another area: any answer will do for it.
        api.fallback(mockEverything);
        // The mock records a call only once it has answered it, so the test waits for the request.
        const isLate = (url: string) => new URL(url).pathname.replace(/\/$/, '') === '/api/summeruniversity/single/mountains';
        const asked = page.waitForRequest((request) => isLate(request.url()));
        await page.goto('/summeruniversity/mountains/participants');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL('/dashboard');

        const late = page.waitForResponse((response) => isLate(response.url()));
        release();
        await late;
        // Two frames: the page has handled the answer by then.
        await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));

        // Counted at once: a retrying matcher would only wait until a toast has gone.
        expect(await toast(page, /Event is not found/).count()).toBe(0);
        await expect(page).toHaveURL('/dashboard');
    });
});
