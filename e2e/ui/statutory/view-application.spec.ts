// An application to a statutory event (/statutory/:id/applications/:application_id, "me" for
// the member's own): its details, its status, and cancelling it.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { FIXED_NOW, forbidden, iso, notFound, ok } from '../support/factories/base.ts';
import { singleStatutoryApplication, type SingleStatutoryApplication } from '../support/factories/statutory-applications.ts';
import {
    statutoryEvent, statutoryEventPermissions, statutoryManagerPermissions, type StatutoryEvent, type StatutoryEventOptions
} from '../support/factories/statutory-events.ts';
import { dialog, freezeTime, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const QUESTIONS: StatutoryEvent['questions'] = [
    { type: 'string', description: 'Why do you want to go?', required: true },
    { type: 'checkbox', description: 'I need a visa', required: false }
];

const agora = (overrides: Partial<StatutoryEvent> = {}, options: StatutoryEventOptions = {}): StatutoryEvent => statutoryEvent({
    url: 'agora-spring', questions: QUESTIONS, ...overrides
}, options);

// The member's own application, pending and still editable.
const OWN = singleStatutoryApplication({
    id: 12,
    statutory_id: '001-0001',
    user_id: 2,
    body_id: 1,
    body_name: 'AEGEE-Antenna',
    nationality: 'Belgian',
    meals: 'Vegan',
    allergies: 'Nuts',
    number_of_events_visited: 2,
    answers: ['To meet the network', true],
    created_at: '2027-01-10T09:30:00.000Z',
    updated_at: '2027-01-11T14:00:00.000Z'
});

// Someone else's, as a manager of applications sees it.
const JANS = singleStatutoryApplication({
    ...OWN,
    id: 13,
    statutory_id: '001-0002',
    user_id: 7,
    first_name: 'Jan',
    last_name: 'Jansen',
    body_id: 3,
    body_name: 'AEGEE-Utrecht',
    participant_type: 'delegate',
    participant_order: 1,
    board_comment: 'Active member'
}, { ...statutoryManagerPermissions(), change_status: true });

const mockPage = (api: ApiMock, application: SingleStatutoryApplication | null, event: StatutoryEvent = agora()) => {
    api.json('GET statutory /events/:id', ok(event));
    // Without an application, statutory answers for "me" and for someone else in its own words.
    api.on('GET statutory /events/:id/applications/:application_id', ({ params }) => (application
        ? { json: ok(application) }
        : { status: 404, json: notFound(`${params.application_id === 'me' ? 'You' : 'This user'} haven't applied to this event yet.`) }));
};

// The value next to a row header in the details.
const detail = (page: Page, name: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name, exact: true }) })
    .getByRole('cell');

test.describe('an application to a statutory event', () => {
    test('a member sees their own application', async ({ page, api }) => {
        mockPage(api, OWN);
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByRole('heading', { name: 'See application on Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | View application for statutory event');
        await expect(page.getByText('You applied from this body:')).toBeVisible();
        await expect(page.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(page.getByText('Member name:')).toBeHidden();
        await expect(page.getByRole('row', { name: 'Question Answer', exact: true })).toBeVisible();

        await expect(detail(page, 'Statutory ID')).toHaveText('001-0001');
        await expect(detail(page, 'Applied on')).toHaveText('2027-01-10 10:30');
        await expect(detail(page, 'Updated on')).toHaveText('2027-01-11 15:00');
        await expect(detail(page, 'First name')).toHaveText('Alex');
        await expect(detail(page, 'Last name')).toHaveText('Member');
        await expect(detail(page, 'Gender')).toHaveText('female');
        await expect(detail(page, 'Date of birth')).toHaveText('2000-01-01');
        await expect(detail(page, 'Nationality')).toHaveText('Belgian');
        await expect(detail(page, 'Meals')).toHaveText('Vegan');
        await expect(detail(page, 'Allergies')).toHaveText('Nuts');
        await expect(detail(page, 'Number of Agorae visited')).toHaveText('2');
        await expect(detail(page, 'Visa required?')).toHaveText('No');
        await expect(page.getByRole('rowheader', { name: 'Why do you want to go?' })).toBeVisible();
        await expect(detail(page, 'Participant type')).toHaveText('Not set yet.');
        await expect(detail(page, 'Participant order')).toHaveText('Not set yet.');
        await expect(detail(page, 'Confirmed?')).toHaveText('No');
        await expect(detail(page, 'Attended?')).toHaveText('No');
        await expect(detail(page, 'JC registered?')).toHaveText('No');

        await expect(page.getByText('Your application is recorded, please wait for the organisers to evaluate your application. You can still edit it till the application period ends.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Edit your application' })).toHaveAttribute('href', '/statutory/agora-spring/applications/12/edit');
        await expect(page.getByRole('button', { name: 'Cancel application', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
    });

    test('cancelling asks first, then shows the application as cancelled', async ({ page, api }) => {
        mockPage(api, OWN);
        api.json('PUT statutory /events/:id/applications/:application_id/cancel', ok({ ...OWN, cancelled: true }));
        await page.goto('/statutory/agora-spring/applications/me');

        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
        const confirm = dialog(page, 'Cancel application');
        await expect(confirm).toContainText('Are you sure you want to cancel your application? You can uncancel it only during application period.');
        await confirm.getByRole('button', { name: 'Cancel application', exact: true }).click();

        await expect(toast(page, 'Application is cancelled.')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/cancel').map((call) => [call.params.application_id, call.body]))
            .toEqual([['12', { cancelled: true }]]);
        await expect(page.getByText('Your application is cancelled. You can uncancel it till the application period ends.')).toBeVisible();
        await expect(page.getByText(/Your application is recorded/)).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Uncancel application' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cancel application', exact: true })).toHaveCount(0);
    });

    test('changing one\'s mind in the dialog cancels nothing', async ({ page, api }) => {
        mockPage(api, OWN);
        await page.goto('/statutory/agora-spring/applications/me');

        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
        await dialog(page, 'Cancel application').getByRole('button', { name: 'Cancel', exact: true }).click();

        await expect(dialog(page, 'Cancel application')).toHaveCount(0);
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/cancel')).toEqual([]);
        await expect(page.getByRole('button', { name: 'Cancel application', exact: true })).toBeVisible();
    });

    test('a cancelled application can be uncancelled', async ({ page, api }) => {
        mockPage(api, { ...OWN, cancelled: true });
        api.json('PUT statutory /events/:id/applications/:application_id/cancel', ok(OWN));
        await page.goto('/statutory/agora-spring/applications/me');

        await page.getByRole('button', { name: 'Uncancel application' }).click();

        await expect(toast(page, 'Application is uncancelled.')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/cancel').map((call) => call.body)).toEqual([{ cancelled: false }]);
        await expect(page.getByText(/Your application is recorded/)).toBeVisible();
    });

    test('shows why the application could not be cancelled', async ({ page, api }) => {
        mockPage(api, OWN);
        api.on('PUT statutory /events/:id/applications/:application_id/cancel', {
            status: 403, json: forbidden('You don\'t have permissions to change the "cancelled" attribute of this application.')
        });
        await page.goto('/statutory/agora-spring/applications/me');

        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
        await dialog(page, 'Cancel application').getByRole('button', { name: 'Cancel application', exact: true }).click();

        await expect(toast(page, 'Could not cancel application: You don\'t have permissions to change the "cancelled" attribute of this application.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Uncancel application' })).toHaveCount(0);
    });

    for (const [status, own, other] of [
        ['accepted', 'Congratulations, you have been accepted to the event!', 'This application has been accepted to the event.'],
        ['waiting_list', 'Unfortunately you\'ve been put to a waiting list. Please contact organisers to get more info on that.', 'This application is on the waiting list.'],
        ['rejected', 'Sorry, but you were not accepted to the event.', 'This application was not accepted.']
    ] as const) {
        test(`a member sees that their application is ${status.replace('_', ' ')}`, async ({ page, api }) => {
            mockPage(api, { ...OWN, status });
            await page.goto('/statutory/agora-spring/applications/me');

            await expect(page.getByText(own)).toBeVisible();
        });

        test(`a manager sees that someone's application is ${status.replace('_', ' ')}`, async ({ page, api }) => {
            mockPage(api, { ...JANS, status }, agora({ permissions: statutoryManagerPermissions() }));
            await page.goto('/statutory/agora-spring/applications/001-0002');

            await expect(page.getByText(other)).toBeVisible();
        });
    }

    test('a manager sees that someone\'s application is cancelled, without the hints for the applicant', async ({ page, api }) => {
        mockPage(api, { ...JANS, cancelled: true, permissions: { ...JANS.permissions, set_application_cancelled: false } }, agora({ permissions: statutoryManagerPermissions() }));
        await page.goto('/statutory/agora-spring/applications/001-0002');

        await expect(page.getByText('This application is cancelled.', { exact: true })).toBeVisible();
        await expect(page.getByText(/You can uncancel it/)).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Uncancel application' })).toHaveCount(0);
    });

    test('a manager sees someone else\'s application with its answers', async ({ page, api }) => {
        mockPage(api, JANS, agora({ permissions: statutoryManagerPermissions() }));
        await page.goto('/statutory/agora-spring/applications/001-0002');

        await expect(page.getByText('Application from the body:')).toBeVisible();
        await expect(page.getByRole('link', { name: 'AEGEE-Utrecht' })).toHaveAttribute('href', '/bodies/3');
        await expect(page.getByRole('link', { name: 'Jan Jansen' })).toHaveAttribute('href', '/members/7');
        await expect(page.getByText('This application is recorded and waiting for organiser review.')).toBeVisible();
        await expect(detail(page, 'Why do you want to go?')).toHaveText('To meet the network');
        await expect(detail(page, 'I need a visa')).toHaveText('Yes');
        await expect(detail(page, 'Participant type')).toHaveText('delegate');
        await expect(detail(page, 'Participant order')).toHaveText('1');
        await expect(page.getByRole('link', { name: 'Edit application', exact: true })).toHaveAttribute('href', '/statutory/agora-spring/applications/13/edit');
        // Not their own, so no hints about the deadlines.
        await expect(page.getByText(/You can still edit it/)).toHaveCount(0);
    });

    test('a manager who may cancel someone else\'s application gets the button, without applying', async ({ page, api }) => {
        mockPage(api, { ...JANS, permissions: { ...JANS.permissions, apply: false, set_application_cancelled: true } }, agora({ permissions: statutoryManagerPermissions({ apply: false }) }));
        await page.goto('/statutory/agora-spring/applications/001-0002');

        await expect(page.getByText('Application from the body:')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cancel application', exact: true })).toBeVisible();
    });

    test('who may apply but not cancel this application gets no cancel button', async ({ page, api }) => {
        mockPage(api, { ...JANS, permissions: { ...JANS.permissions, apply: true, set_application_cancelled: false } }, agora({ permissions: statutoryManagerPermissions() }));
        await page.goto('/statutory/agora-spring/applications/001-0002');

        await expect(page.getByText('Application from the body:')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Edit application', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /cancel application/i })).toHaveCount(0);
    });

    test('a board member without any action gets no buttons', async ({ page, api }) => {
        mockPage(api, { ...JANS, permissions: { ...JANS.permissions, ...statutoryEventPermissions({ apply: false }), edit_application: false, set_application_cancelled: false } });
        await page.goto('/statutory/agora-spring/applications/001-0002');

        await expect(page.getByText('Application from the body:')).toBeVisible();
        await expect(page.getByRole('button', { name: /cancel application/i })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /Edit/ })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
    });

    test('a member who hasn\'t applied yet can apply', async ({ page, api }) => {
        mockPage(api, null);
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByText('You haven\'t applied to this event yet.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Apply!' })).toHaveAttribute('href', '/statutory/agora-spring/applications/new');
        await expect(page.getByRole('row')).toHaveCount(0);
    });

    test('an application that doesn\'t exist is not mistaken for the member\'s own', async ({ page, api }) => {
        mockPage(api, null, agora({ permissions: statutoryManagerPermissions() }));
        await page.goto('/statutory/agora-spring/applications/001-0099');

        await expect(page.getByText('There is no such application.')).toBeVisible();
        await expect(page.getByText('You haven\'t applied to this event yet.')).toHaveCount(0);
    });

    test('nothing says "not applied" while the application is still coming', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora()));
        api.on('GET statutory /events/:id/applications/:application_id', { json: ok(OWN), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByRole('heading', { name: 'See application on Agora Spring' })).toBeVisible();
        await expect(page.getByText('You haven\'t applied to this event yet.')).toBeHidden();
        await expect(detail(page, 'Statutory ID')).toHaveText('001-0001');
        await expect(page.getByText('You haven\'t applied to this event yet.')).toBeHidden();
    });

    test('before the application period the member is told it hasn\'t started', async ({ page, api }) => {
        await freezeTime(page);
        const from = Date.parse(FIXED_NOW);
        mockPage(api, null, agora({
            application_period_starts: iso(3, from), application_period_ends: iso(10, from), permissions: statutoryEventPermissions({ apply: false })
        }, { now: from }));
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByText('You cannot apply to this event: application period hasn\'t started yet.')).toBeVisible();
        await expect(page.getByText('You cannot apply to this event: application period is over.')).toBeHidden();
        await expect(page.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
    });

    test('after the application period the member is told it is over', async ({ page, api }) => {
        await freezeTime(page);
        const from = Date.parse(FIXED_NOW);
        mockPage(api, null, agora({
            application_period_starts: iso(-10, from), application_period_ends: iso(-3, from), permissions: statutoryEventPermissions({ apply: false })
        }, { now: from }));
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByText('You cannot apply to this event: application period is over.')).toBeVisible();
        await expect(page.getByText('You cannot apply to this event: application period hasn\'t started yet.')).toBeHidden();
    });

    test('during the application period an event that takes no applications says so', async ({ page, api }) => {
        await freezeTime(page);
        const from = Date.parse(FIXED_NOW);
        mockPage(api, null, agora({
            application_period_starts: iso(-3, from), application_period_ends: iso(10, from), permissions: statutoryEventPermissions({ apply: false })
        }, { now: from }));
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByText('You cannot apply to this event right now.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
    });

    test('after the application period the member can\'t edit their application any more', async ({ page, api }) => {
        await freezeTime(page);
        const from = Date.parse(FIXED_NOW);
        mockPage(api, { ...OWN, permissions: { ...OWN.permissions, edit_application: false, set_application_cancelled: false, apply: false } }, agora({
            application_period_starts: iso(-10, from), application_period_ends: iso(-3, from), permissions: statutoryEventPermissions({ apply: false })
        }, { now: from }));
        await page.goto('/statutory/agora-spring/applications/me');

        await expect(page.getByText('You cannot edit your application anymore: application period is over.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Edit your application' })).toHaveCount(0);
        await expect(page.getByText(/You can still edit it/)).toHaveCount(0);
    });

    for (const [type, label] of [['epm', 'Number of EPMs visited'], ['spm', 'Number of SPMs visited']] as const) {
        test(`the details of an application to an ${type.toUpperCase()} count ${type.toUpperCase()}s`, async ({ page, api }) => {
            mockPage(api, OWN, agora({ type, url: `${type}-spring` }));
            await page.goto(`/statutory/${type}-spring/applications/me`);

            await expect(detail(page, label)).toHaveText('2');
        });
    }

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/applications/me');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('an application one may not see goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(agora()));
        api.on('GET statutory /events/:id/applications/:application_id', { status: 403, json: forbidden('You are not allowed to see this application.') });
        await page.goto('/statutory/agora-spring/applications/001-0002');

        await expect(toast(page, 'Some error happened: You are not allowed to see this application.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
