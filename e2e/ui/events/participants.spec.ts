// Participants of an event (/events/:id/participants): the organisers' list of applications.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { application, eventOrganizerPermissions, organizedEvent, participantRow, question, type Application } from '../support/factories/events.ts';
import { cellOf, dialog, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const EVENT = organizedEvent({
    id: 9,
    url: 'spring',
    name: 'Spring Training',
    questions: [question({ type: 'string', description: 'Why do you want to join?' }), question({ type: 'checkbox', description: 'I am vegetarian' })]
});

const ROWS = [
    participantRow({ id: 31, user_id: 7, first_name: 'Carla', last_name: 'Third', body_id: 3, body_name: 'AEGEE-Zulu', status: 'accepted', confirmed: true, attended: true }),
    participantRow({ id: 32, user_id: 5, first_name: 'Alex', last_name: 'First', body_id: 1, body_name: 'AEGEE-Antenna' }),
    participantRow({ id: 33, user_id: 6, first_name: 'Bea', last_name: 'Second', body_id: 2, body_name: 'AEGEE-Yankee', status: 'rejected', confirmed: true })
];

const showParticipants = (api: ApiMock, rows: Application[] = ROWS) => {
    api.json('GET events /single/:id', ok(EVENT, { permissions: eventOrganizerPermissions() }));
    api.json('GET events /single/:id/applications', ok(rows));
};

const table = (page: Page) => page.getByRole('table');
const row = (page: Page, name: string) => tableRows(table(page)).filter({ hasText: name });

test.describe('participants of an event', () => {
    test('lists the applications with their bodies and current values', async ({ page, api }) => {
        showParticipants(api);
        await page.goto('/events/spring/participants');

        await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List/manage participants of the event');
        await expect(page.getByText('Total applications: 3.')).toBeVisible();
        await expect(tableRows(table(page))).toHaveCount(3);

        const carla = row(page, 'Carla Third');
        await expect(carla).toBeVisible();
        await expect(await cellOf(table(page), carla, 'User ID')).toHaveText('7');
        await expect(carla.getByRole('link', { name: 'AEGEE-Zulu' })).toHaveAttribute('href', '/bodies/3');
        await expect(carla.getByRole('combobox', { name: 'Status of Carla Third' })).toHaveValue('accepted');
        // Attendance locks the confirmation.
        await expect(carla.getByRole('combobox', { name: 'Confirmed for Carla Third' })).toBeDisabled();
        await expect(carla.getByRole('combobox', { name: 'Attended for Carla Third' })).toBeEnabled();

        // Without a confirmation, attendance can't be set.
        const alex = row(page, 'Alex First');
        await expect(alex.getByRole('combobox', { name: 'Attended for Alex First' })).toBeDisabled();
        await expect(alex.getByRole('combobox', { name: 'Confirmed for Alex First' })).toBeEnabled();
        await expect(row(page, 'Bea Second').getByRole('combobox', { name: 'Status of Bea Second' })).toHaveValue('rejected');
        expect(api.callsTo('GET events /single/:id/applications').map((call) => call.params.id)).toEqual(['spring']);
    });

    test('changing an application\'s status saves it and confirms', async ({ page, api }) => {
        showParticipants(api);
        api.on('PUT events /single/:id/applications/:application_id/status', ({ body }) => ({ json: ok(participantRow({ ...ROWS[1], ...(body as object) })) }));
        await page.goto('/events/spring/participants');

        await row(page, 'Alex First').getByRole('combobox', { name: 'Status of Alex First' }).selectOption({ label: 'Accepted' });

        await expect(toast(page, 'Successfully updated status of application for user #5 to "accepted"')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/applications/:application_id/status').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'spring', application_id: '32' }, { status: 'accepted' }]]);
    });

    test('a refused status change shows the error and puts the old status back', async ({ page, api }) => {
        showParticipants(api);
        api.on('PUT events /single/:id/applications/:application_id/status', { status: 403, json: forbidden('You are not allowed to accept or reject participants') });
        await page.goto('/events/spring/participants');
        const status = row(page, 'Alex First').getByRole('combobox', { name: 'Status of Alex First' });

        await status.selectOption({ label: 'Rejected' });

        await expect(toast(page, 'Could not update participant status: You are not allowed to accept or reject participants')).toBeVisible();
        await expect(status).toHaveValue('pending');
    });

    test('confirming a participant lets attendance be set, and attendance locks the confirmation', async ({ page, api }) => {
        showParticipants(api);
        api.on('PUT events /single/:id/applications/:application_id/confirmed', ({ body }) => ({ json: ok(participantRow({ ...ROWS[1], ...(body as object) })) }));
        api.on('PUT events /single/:id/applications/:application_id/attended', ({ body }) => ({ json: ok(participantRow({ ...ROWS[1], confirmed: true, ...(body as object) })) }));
        await page.goto('/events/spring/participants');
        const alex = row(page, 'Alex First');

        await alex.getByRole('combobox', { name: 'Confirmed for Alex First' }).selectOption({ label: 'Yes' });
        await expect(toast(page, 'Successfully updated fee info of application for user #5')).toBeVisible();
        await expect(alex.getByRole('combobox', { name: 'Attended for Alex First' })).toBeEnabled();

        await alex.getByRole('combobox', { name: 'Attended for Alex First' }).selectOption({ label: 'Yes' });
        await expect(toast(page, 'Successfully updated attendance info of application for user #5')).toBeVisible();
        await expect(alex.getByRole('combobox', { name: 'Confirmed for Alex First' })).toBeDisabled();

        expect(api.callsTo('PUT events /single/:id/applications/:application_id/confirmed').map((call) => [call.params.application_id, call.body])).toEqual([['32', { confirmed: true }]]);
        expect(api.callsTo('PUT events /single/:id/applications/:application_id/attended').map((call) => [call.params.application_id, call.body])).toEqual([['32', { attended: true }]]);
    });

    test('refused confirmation and attendance changes show the error and keep the stored values', async ({ page, api }) => {
        showParticipants(api);
        const refused = { status: 403, json: forbidden('You don\'t have permissions to change this application.') };
        api.on('PUT events /single/:id/applications/:application_id/confirmed', refused);
        api.on('PUT events /single/:id/applications/:application_id/attended', refused);
        await page.goto('/events/spring/participants');

        const alex = row(page, 'Alex First');
        await alex.getByRole('combobox', { name: 'Confirmed for Alex First' }).selectOption({ label: 'Yes' });
        await expect(toast(page, 'Could not update participant fee info: You don\'t have permissions to change this application.')).toBeVisible();
        await expect(alex.getByRole('combobox', { name: 'Confirmed for Alex First' })).toHaveValue('false');

        const carla = row(page, 'Carla Third');
        await carla.getByRole('combobox', { name: 'Attended for Carla Third' }).selectOption({ label: 'No' });
        await expect(toast(page, 'Could not update participant attendance info: You don\'t have permissions to change this application.')).toBeVisible();
        await expect(carla.getByRole('combobox', { name: 'Attended for Carla Third' })).toHaveValue('true');
    });

    test('"View" opens the application with its answers and the board\'s comment', async ({ page, api }) => {
        showParticipants(api);
        api.json('GET events /single/:id/applications/:application_id', ok({
            ...application({ id: 32, user_id: 5, first_name: 'Alex', last_name: 'First', body_name: 'AEGEE-Antenna', notification_email: 'alex.first@example.org', created_at: '2027-02-03T10:00:00.000Z', answers: ['To learn', true] }),
            board_comment: 'Active member'
        }));
        await page.goto('/events/spring/participants');

        await row(page, 'Alex First').getByRole('button', { name: 'View the application of Alex First' }).click();

        const modal = dialog(page, 'View participant');
        await expect(modal.getByRole('row', { name: /^First Name/ })).toHaveText(/Alex/);
        await expect(modal.getByRole('row', { name: /^Last Name/ })).toHaveText(/First/);
        await expect(modal.getByRole('row', { name: /^Body/ })).toHaveText(/AEGEE-Antenna/);
        await expect(modal.getByRole('row', { name: /^Email/ })).toHaveText(/alex\.first@example\.org/);
        await expect(modal.getByRole('row', { name: /^Application date/ })).toHaveText(/2027-02-03/);
        await expect(modal.getByRole('row', { name: /^Why do you want to join\?/ })).toHaveText(/To learn/);
        await expect(modal.getByRole('row', { name: /^I am vegetarian/ })).toHaveText(/Yes/);
        await expect(modal.getByRole('row', { name: /^Board comment/ }).getByText('Active member')).toBeVisible();
        // The application is asked for by the event's id.
        expect(api.callsTo('GET events /single/:id/applications/:application_id').map((call) => call.params)).toEqual([{ id: '9', application_id: '32' }]);
    });

    test('"View" shows "-" without a board comment, and the dialog closes', async ({ page, api }) => {
        showParticipants(api);
        api.json('GET events /single/:id/applications/:application_id', ok({ ...application({ id: 32, answers: ['', false] }), board_comment: null }));
        await page.goto('/events/spring/participants');

        await row(page, 'Alex First').getByRole('button', { name: 'View the application of Alex First' }).click();
        const modal = dialog(page, 'View participant');
        await expect(modal.getByRole('row', { name: /^Board comment/ }).getByText('-', { exact: true })).toBeVisible();

        await modal.getByRole('button', { name: 'close' }).click();
        await expect(modal).toHaveCount(0);
    });

    test('a failing "View" shows an error', async ({ page, api }) => {
        showParticipants(api);
        api.on('GET events /single/:id/applications/:application_id', { status: 403, json: forbidden('You are not allowed to see this application.') });
        await page.goto('/events/spring/participants');

        await row(page, 'Alex First').getByRole('button', { name: 'View the application of Alex First' }).click();

        await expect(toast(page, 'Could not fetch the application: You are not allowed to see this application.')).toBeVisible();
        await expect(dialog(page, 'View participant')).toHaveCount(0);
    });

    test('"Export" downloads the participants as a spreadsheet', async ({ page, api }) => {
        showParticipants(api);
        api.on('GET events /single/:id/applications/export', {
            body: Buffer.from('PK\u0003\u0004 not really a spreadsheet'),
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        await page.goto('/events/spring/participants');

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export' }).click();

        expect((await download).suggestedFilename()).toMatch(/^participants_\d{4}-\d{2}-\d{2}T.*\.xlsx$/);
        expect(api.callsTo('GET events /single/:id/applications/export').map((call) => call.params.id)).toEqual(['spring']);
    });

    test('a refused export shows the reason', async ({ page, api }) => {
        showParticipants(api);
        api.on('GET events /single/:id/applications/export', { status: 403, json: forbidden('You are not allowed to see statistics.') });
        await page.goto('/events/spring/participants');

        await page.getByRole('button', { name: 'Export' }).click();

        await expect(toast(page, 'Could not export participants: You are not allowed to see statistics.')).toBeVisible();
    });

    test('a failed export whose answer is not JSON still says it failed', async ({ page, api }) => {
        showParticipants(api);
        api.on('GET events /single/:id/applications/export', { status: 502, body: Buffer.from('<html>Bad Gateway</html>'), contentType: 'text/html' });
        await page.goto('/events/spring/participants');

        await page.getByRole('button', { name: 'Export' }).click();

        await expect(toast(page, 'Could not export participants: Request failed with status code 502')).toBeVisible();
    });

    test('an event without applications says there is nothing', async ({ page, api }) => {
        showParticipants(api, []);
        await page.goto('/events/spring/participants');

        await expect(page.getByText('Total applications: 0.')).toBeVisible();
        await expectEmptyTable(table(page));
    });

    test('an unknown event goes back to the list', async ({ page, api }) => {
        api.on('GET events /single/:id', { status: 404, json: notFound('Event with id nope not found') });
        api.json('GET events /', ok([]));
        await page.goto('/events/nope/participants');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });

    test('someone who may not see the applications is sent back with the reason', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(EVENT, { permissions: eventOrganizerPermissions() }));
        api.on('GET events /single/:id/applications', { status: 403, json: forbidden('You cannot see applications for this event.') });
        api.json('GET events /', ok([]));
        await page.goto('/events/spring/participants');

        await expect(toast(page, 'Some error happened: You cannot see applications for this event.')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });
});
