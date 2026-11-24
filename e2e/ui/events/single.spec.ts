// Event page (/events/:id): the facts about an event and what the viewer can do with it.
import type { Page } from '@playwright/test';

import { FIXED_NOW, forbidden, iso, notFound, ok } from '../support/factories/base.ts';
import {
    eqacPermissions, europeanStatusPermissions, event, eventOrganizerPermissions, eventPermissions, organizedEvent, organizerPermissions, type Event, type EventPermissions
} from '../support/factories/events.ts';
import { delayMapLibrary, mockMap } from '../support/map.ts';
import { freezeTime, openAccountMenu, openMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// Lets the page handle an answer that has just come in (its handlers and the next render).
const settle = (page: Page) => page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));

// The value next to a label in the event's facts table.
const fact = (page: Page, label: string | RegExp) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: typeof label === 'string' }) })
    .getByRole('cell');

const showEvent = (api: import('../support/api-mock.ts').ApiMock, data: Event, permissions: EventPermissions = eventPermissions()) => {
    api.on('GET events /single/:id', ({ params }) => (params.id === data.url || params.id === String(data.id)
        ? { json: ok(data, { permissions }) }
        : { status: 404, json: notFound(`Event with id ${params.id} not found`) }));
};

const PICTURE = { body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), contentType: 'image/png' };
const STATUS_CHANGED = { success: true, message: 'Successfully changed approval status' };

test.describe('event page', () => {
    test('shows the facts about the event', async ({ page, api }) => {
        showEvent(api, event({
            id: 7,
            name: 'Spring Training',
            url: 'spring-training',
            description: 'Learn **project management** in a week.',
            type: 'training',
            max_participants: 25,
            fee: 50,
            optional_fee: 15,
            meals_per_day: 3,
            accommodation_type: 'Hostel',
            // 09:00 UTC is 10:00 in Brussels, the time zone of the tests.
            application_starts: '2027-02-01T09:00:00.000Z',
            application_ends: '2027-02-15T09:00:00.000Z',
            starts: '2027-03-01T09:00:00.000Z',
            ends: '2027-03-07T15:30:00.000Z',
            organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }, { body_id: 2, body_name: 'AEGEE-Other' }]
        }));

        await page.goto('/events/spring-training');

        await expect(page.getByRole('heading', { name: 'Spring Training', level: 1 })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Display single event');

        await expect(fact(page, 'Event name')).toHaveText('Spring Training');
        await expect(fact(page, 'Description').getByText('project management')).toHaveJSProperty('tagName', 'STRONG');
        await expect(fact(page, 'Max. participants')).toHaveText('25');
        await expect(fact(page, 'Application status')).toHaveText('Open');
        await expect(fact(page, /^Application period starts/)).toHaveText('2027-02-01 10:00');
        await expect(fact(page, /^Application period ends/)).toHaveText('2027-02-15 10:00');
        await expect(fact(page, /^Starts/)).toHaveText('2027-03-01 10:00');
        await expect(fact(page, /^Ends/)).toHaveText('2027-03-07 16:30');
        await expect(fact(page, 'Type')).toHaveText('Training Event');
        await expect(fact(page, 'Fee')).toHaveText('€50');
        await expect(fact(page, 'Optional Fee')).toHaveText('€15');
        await expect(fact(page, 'Number of meals provided per day')).toHaveText('3');
        await expect(fact(page, 'Accommodation type')).toHaveText('Hostel');
        await expect(fact(page, 'Organising bodies').getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(fact(page, 'Organising bodies').getByRole('link', { name: 'AEGEE-Other' })).toHaveAttribute('href', '/bodies/2');

        // Only EQAC and organisers see the status.
        await expect(page.getByRole('rowheader', { name: 'Status', exact: true })).toHaveCount(0);
    });

    test('a member can go to their application', async ({ page, api }) => {
        showEvent(api, event({ url: 'spring-training' }));
        await page.goto('/events/spring-training');

        await expect(page.getByRole('link', { name: 'Manage my application' })).toHaveAttribute('href', '/events/spring-training/applications/me');
        // and doesn't see the organiser actions.
        for (const action of ['View applications', 'Edit event']) {
            await expect(page.getByRole('link', { name: action })).toHaveCount(0);
        }
        for (const action of ['Change picture', 'Delete event', 'Unpublish', 'Ask for approval']) {
            await expect(page.getByRole('button', { name: action })).toHaveCount(0);
        }
    });

    test('free, online events without applications say so', async ({ page, api }) => {
        showEvent(api, event({ url: 'online-1', method: 'online', has_applications: false, fee: 0 }));
        await page.goto('/events/online-1');

        await expect(page.getByText('This is an online event, you can join without applying!')).toBeVisible();
        await expect(page.getByRole('rowheader', { name: 'Fee', exact: true })).toHaveCount(0);
        await expect(page.getByRole('rowheader', { name: 'Application status' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Manage my application' })).toHaveCount(0);
    });

    test('an in-person event without a fee is free', async ({ page, api }) => {
        showEvent(api, event({ url: 'free-1', fee: 0, optional_fee: 0, vegetarian: true }));
        await page.goto('/events/free-1');

        await expect(fact(page, 'Fee')).toHaveText('Free');
        await expect(page.getByRole('rowheader', { name: 'Optional Fee' })).toHaveCount(0);
        await expect(page.getByText('This event is fully vegetarian!')).toBeVisible();
    });

    test('links typed in by organisers open in a new tab', async ({ page, api }) => {
        showEvent(api, event({
            url: 'links-1',
            budget: 'https://example.org/budget',
            programme: 'www.example.org/programme',
            link_info_travel_country: 'https://example.org/travel'
        }));
        await page.goto('/events/links-1');

        const budget = fact(page, 'Budget link').getByRole('link');
        await expect(budget).toHaveAttribute('href', 'https://example.org/budget');
        await expect(budget).toHaveAttribute('target', '_blank');
        await expect(budget).toHaveAttribute('rel', /noopener/);
        // A link without a scheme opens as https, not as a page of MyAEGEE.
        await expect(fact(page, 'Program link').getByRole('link')).toHaveAttribute('href', 'https://www.example.org/programme');
        await expect(fact(page, 'Useful information to travel to this country').getByRole('link')).toHaveAttribute('href', 'https://example.org/travel');
    });

    test('an unpublished event explains who can see it', async ({ page, api }) => {
        showEvent(api, event({ url: 'draft-1', status: 'draft' }), organizerPermissions());
        await page.goto('/events/draft-1');

        await expect(page.getByText('This event is visible to EQAC and organisers only because it\'s not approved yet.')).toBeVisible();
        await expect(page.getByText('This event is in the "draft" status.')).toBeVisible();
        await expect(fact(page, 'Status')).toHaveText('Draft');
    });

    test('organisers get the actions they are allowed', async ({ page, api }) => {
        showEvent(api, event({ url: 'org-1', status: 'published' }), organizerPermissions());
        await page.goto('/events/org-1');

        await expect(page.getByRole('link', { name: 'View applications' })).toHaveAttribute('href', '/events/org-1/participants');
        await expect(page.getByRole('link', { name: 'Edit event' })).toHaveAttribute('href', '/events/org-1/edit');
        await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete event' })).toBeVisible();
        // Approving only makes sense for submitted events.
        await expect(page.getByRole('button', { name: 'Approve event' })).toHaveCount(0);
    });

    test('deleting asks first and then goes back to the list', async ({ page, api }) => {
        showEvent(api, event({ id: 9, url: 'org-1' }), organizerPermissions());
        api.json('DELETE events /single/:id', { success: true, message: 'Event successfully deleted' });
        api.json('GET events /', ok([]));
        await page.goto('/events/org-1');

        await page.getByRole('button', { name: 'Delete event' }).click();
        const dialog = page.getByRole('alertdialog');
        await expect(dialog).toContainText('Are you sure you want to delete this event?');

        // Cancelling does nothing.
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        expect(api.callsTo('DELETE events /single/:id')).toHaveLength(0);

        await page.getByRole('button', { name: 'Delete event' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Delete event' }).click();

        await expect(toast(page, 'Event is deleted.')).toBeVisible();
        await expect(page).toHaveURL('/events');
        expect(api.callsTo('DELETE events /single/:id').map((call) => call.params.id)).toEqual(['9']);
    });

    test('submitting a draft for approval needs a budget and programme first', async ({ page, api }) => {
        showEvent(api, event({ id: 9, url: 'draft-1', status: 'draft', budget: null, programme: null }), organizerPermissions());
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Ask for approval' }).click();

        await expect(toast(page, 'Please set the budget for the event in the event settings.')).toBeVisible();
        await expect(toast(page, 'Please set the program for the event in the event settings.')).toBeVisible();
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
    });

    test('submitting a complete draft for approval changes its status', async ({ page, api }) => {
        let status: Event['status'] = 'draft';
        api.on('GET events /single/:id', () => ({
            json: ok(event({ id: 9, url: 'draft-1', status, budget: 'https://example.org/b', programme: 'https://example.org/p' }), { permissions: organizerPermissions() })
        }));
        api.on('PUT events /single/:id/status', ({ body }) => {
            status = (body as { status: Event['status'] }).status;
            return { json: STATUS_CHANGED };
        });
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Ask for approval' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Event status is now submitted')).toBeVisible();
        await expect(page.getByText('This event is under approval.')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/status').map((call) => call.body)).toEqual([{ status: 'submitted' }]);
    });

    test('an unknown event goes back to the list', async ({ page, api }) => {
        api.on('GET events /single/:id', { status: 404, json: notFound('Event with id does-not-exist not found') });
        api.json('GET events /', ok([]));

        await page.goto('/events/does-not-exist');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });

    test('shows the event\'s picture when it has one', async ({ page, api }) => {
        showEvent(api, event({ url: 'pic-1', name: 'Picture Event', image: 'head.png' }));
        api.url('GET', '/media/events/headimages/head.png', PICTURE);
        await page.goto('/events/pic-1');

        await expect(page.getByRole('img', { name: 'Picture Event' })).toHaveAttribute('src', '/media/events/headimages/head.png');
        expect(api.callsTo('GET url /media/events/headimages/head.png').length).toBeGreaterThan(0);
    });

    test('without a picture the AEGEE logo is shown as decoration', async ({ page, api }) => {
        showEvent(api, event({ url: 'pic-2', name: 'Plain Event', image: null }));
        await page.goto('/events/pic-2');

        await expect(page.getByRole('heading', { name: 'Plain Event' })).toBeVisible();
        await expect(page.getByRole('img')).toHaveCount(0);
    });

    test('the events approval team approves a submitted event', async ({ page, api }) => {
        let status: Event['status'] = 'submitted';
        api.on('GET events /single/:id', () => ({ json: ok(organizedEvent({ id: 9, url: 'nwm-1', type: 'nwm', status }), { permissions: eqacPermissions('nwm', status) }) }));
        api.on('PUT events /single/:id/status', ({ body }) => {
            status = (body as { status: Event['status'] }).status;
            return { json: STATUS_CHANGED };
        });
        await page.goto('/events/nwm-1');
        await expect(page.getByText('This event is under approval. Wait a little till EQAC approves it.')).toBeVisible();
        await expect(fact(page, 'Status')).toHaveText('Submitted');
        await expect(page.getByRole('button', { name: 'Ask for approval' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Approve event' }).click();
        const confirm = page.getByRole('alertdialog', { name: 'Change status' });
        await expect(confirm).toContainText('Are you sure you want to change this event status to "published"?');
        await confirm.getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Event status is now published')).toBeVisible();
        // The page asks again, and the answer brings the actions for a published event.
        await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Approve event' })).toHaveCount(0);
        await expect(fact(page, 'Status')).toHaveText('Published');
        await expect(page.getByText(/visible to EQAC and organisers only/)).toHaveCount(0);
        expect(api.callsTo('PUT events /single/:id/status').map((call) => [call.params.id, call.body])).toEqual([['9', { status: 'published' }]]);
        expect(api.callsTo('GET events /single/:id').map((call) => call.params.id)).toEqual(['nwm-1', 'nwm-1']);
    });

    test('the events approval team asks for changes to a submitted event', async ({ page, api }) => {
        let status: Event['status'] = 'submitted';
        api.on('GET events /single/:id', () => ({ json: ok(organizedEvent({ id: 9, url: 'nwm-1', type: 'nwm', status }), { permissions: eqacPermissions('nwm', status) }) }));
        api.on('PUT events /single/:id/status', ({ body }) => {
            status = (body as { status: Event['status'] }).status;
            return { json: STATUS_CHANGED };
        });
        await page.goto('/events/nwm-1');

        await page.getByRole('button', { name: 'Request changes' }).click();
        await page.getByRole('alertdialog', { name: 'Change status' }).getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Event status is now draft')).toBeVisible();
        await expect(page.getByText('This event is in the "draft" status.', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Request changes' })).toHaveCount(0);
        expect(api.callsTo('PUT events /single/:id/status').map((call) => call.body)).toEqual([{ status: 'draft' }]);
    });

    test('cancelling the status dialog changes nothing', async ({ page, api }) => {
        showEvent(api, organizedEvent({ id: 9, url: 'nwm-1', type: 'nwm', status: 'published' }), eqacPermissions('nwm', 'published'));
        await page.goto('/events/nwm-1');

        await page.getByRole('button', { name: 'Unpublish' }).click();
        await page.getByRole('alertdialog', { name: 'Change status' }).getByRole('button', { name: 'Cancel' }).click();

        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        expect(api.callsTo('PUT events /single/:id/status')).toHaveLength(0);
    });

    test('an online draft can be submitted with only a programme, and has no budget row', async ({ page, api }) => {
        showEvent(api, organizedEvent({ id: 9, url: 'online-1', status: 'draft', method: 'online', budget: null, programme: 'https://example.org/programme' }), eventOrganizerPermissions('draft'));
        api.json('PUT events /single/:id/status', STATUS_CHANGED);
        await page.goto('/events/online-1');

        await expect(fact(page, 'Program link')).toHaveText('https://example.org/programme');
        await expect(page.getByRole('rowheader', { name: 'Budget link' })).toHaveCount(0);

        await page.getByRole('button', { name: 'Ask for approval' }).click();
        await page.getByRole('alertdialog', { name: 'Change status' }).getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Event status is now submitted')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/status').map((call) => call.body)).toEqual([{ status: 'submitted' }]);
    });

    test('a draft with a budget but no programme is not sent for approval', async ({ page, api }) => {
        showEvent(api, organizedEvent({ id: 9, url: 'draft-2', status: 'draft', budget: 'https://example.org/budget', programme: null }), eventOrganizerPermissions('draft'));
        await page.goto('/events/draft-2');

        await page.getByRole('button', { name: 'Ask for approval' }).click();

        await expect(toast(page, 'Please set the program for the event in the event settings.')).toBeVisible();
        expect(await toast(page, 'Please set the budget for the event in the event settings.').count()).toBe(0);
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
    });

    test('a failed status change shows the error and keeps the event', async ({ page, api }) => {
        showEvent(api, organizedEvent({ id: 9, url: 'nwm-1', type: 'nwm', status: 'submitted' }), eqacPermissions('nwm', 'submitted'));
        api.on('PUT events /single/:id/status', { status: 403, json: forbidden('You are not allowed to change status.') });
        await page.goto('/events/nwm-1');

        await page.getByRole('button', { name: 'Approve event' }).click();
        await page.getByRole('alertdialog', { name: 'Change status' }).getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Could not change event status: You are not allowed to change status.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Approve event' })).toBeVisible();
        await expect(page).toHaveURL('/events/nwm-1');
        expect(api.callsTo('GET events /single/:id')).toHaveLength(1);
    });

    test('Content Directors make an event a European Event, and back', async ({ page, api }) => {
        let european = false;
        api.on('GET events /single/:id', () => ({ json: ok(organizedEvent({ id: 9, url: 'conf-1', type: 'conference', is_european_event: european }), { permissions: europeanStatusPermissions('conference') }) }));
        api.on('PUT events /single/:id/status/european_event', ({ body }) => {
            european = (body as { is_european_event: boolean }).is_european_event;
            return { json: { success: true, message: 'Successfully changed European Event status' } };
        });
        await page.goto('/events/conf-1');

        await page.getByRole('button', { name: 'Change European Event status' }).click();
        let confirm = page.getByRole('alertdialog', { name: 'Change European Event status' });
        await expect(confirm).toContainText('Are you sure you want to change this event\'s status to a European Event?');
        await confirm.getByRole('button', { name: 'Change European Event status' }).click();
        await expect(toast(page, 'European Event status is now true')).toBeVisible();
        await expect(confirm).toHaveCount(0);

        await page.getByRole('button', { name: 'Change European Event status' }).click();
        confirm = page.getByRole('alertdialog', { name: 'Change European Event status' });
        await expect(confirm).toContainText('Are you sure you want to change this event\'s status to not a European Event?');
        await confirm.getByRole('button', { name: 'Change European Event status' }).click();
        await expect(toast(page, 'European Event status is now false')).toBeVisible();

        expect(api.callsTo('PUT events /single/:id/status/european_event').map((call) => [call.params.id, call.body]))
            .toEqual([['9', { is_european_event: true }], ['9', { is_european_event: false }]]);
        expect(api.callsTo('GET events /single/:id')).toHaveLength(3);
    });

    test('the European Event status is only offered for the types the member may change', async ({ page, api }) => {
        showEvent(api, event({ url: 'training-1', type: 'training' }), europeanStatusPermissions('conference'));
        await page.goto('/events/training-1');

        await expect(page.getByRole('heading', { name: 'Training Course' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Change European Event status' })).toHaveCount(0);
    });

    test('a failed European Event change shows the error', async ({ page, api }) => {
        showEvent(api, organizedEvent({ id: 9, url: 'conf-1', type: 'conference' }), europeanStatusPermissions('conference'));
        api.on('PUT events /single/:id/status/european_event', { status: 403, json: forbidden('You are not allowed to change the European Event status.') });
        await page.goto('/events/conf-1');

        await page.getByRole('button', { name: 'Change European Event status' }).click();
        await page.getByRole('alertdialog', { name: 'Change European Event status' }).getByRole('button', { name: 'Change European Event status' }).click();

        await expect(toast(page, 'Could not change European Event status: You are not allowed to change the European Event status.')).toBeVisible();
        expect(api.callsTo('GET events /single/:id')).toHaveLength(1);
    });

    test('a failed delete shows the error and stays on the event', async ({ page, api }) => {
        showEvent(api, event({ id: 9, url: 'org-1' }), organizerPermissions());
        api.on('DELETE events /single/:id', { status: 403, json: forbidden('You are not permitted to delete this event.') });
        await page.goto('/events/org-1');

        await page.getByRole('button', { name: 'Delete event' }).click();
        await page.getByRole('alertdialog', { name: 'Deleting an event' }).getByRole('button', { name: 'Delete event' }).click();

        await expect(toast(page, 'Could not delete event: You are not permitted to delete this event.')).toBeVisible();
        await expect(page).toHaveURL('/events/org-1');
        expect(api.callsTo('DELETE events /single/:id').map((call) => call.params.id)).toEqual(['9']);
    });

    test('a member with an active ban sees the notice', async ({ page, api, me }) => {
        await freezeTime(page);
        me!.event_application_ban = { ban_until: '2027-04-01T08:00:00.000Z', reason: 'No-show' };
        showEvent(api, event({ url: 'ban-1' }));
        await page.goto('/events/ban-1');

        await expect(page.getByText('You are temporarily banned from submitting new event applications until 2027-04-01 10:00.')).toBeVisible();
        await expect(page.getByText('Existing applications can still be managed.')).toBeVisible();
    });

    test('a ban that has ended shows nothing', async ({ page, api, me }) => {
        await freezeTime(page);
        me!.event_application_ban = { ban_until: iso(-1, Date.parse(FIXED_NOW)), reason: 'No-show' };
        showEvent(api, event({ url: 'ban-2', name: 'After The Ban' }));
        await page.goto('/events/ban-2');

        await expect(page.getByRole('heading', { name: 'After The Ban' })).toBeVisible();
        await expect(page.getByText(/You are temporarily banned/)).toHaveCount(0);
    });

    test('an online event with applications only says it is online', async ({ page, api }) => {
        showEvent(api, event({ url: 'online-2', method: 'online', has_applications: true }));
        await page.goto('/events/online-2');

        await expect(page.getByText('This is an online event!', { exact: true })).toBeVisible();
        await expect(fact(page, 'Application status')).toHaveText('Open');
        await expect(page.getByRole('link', { name: 'Manage my application' })).toBeVisible();
        for (const row of ['Fee', 'Number of meals provided per day', 'Accommodation type']) {
            await expect(page.getByRole('rowheader', { name: row, exact: true })).toHaveCount(0);
        }
    });

    test('shows the optional programme', async ({ page, api }) => {
        showEvent(api, event({ url: 'opt-1', optional_programme: 'A city tour on the day after' }));
        await page.goto('/events/opt-1');

        await expect(fact(page, 'Optional programme')).toHaveText('A city tour on the day after');
    });

    test('shows a budget link without a programme link', async ({ page, api }) => {
        showEvent(api, organizedEvent({ url: 'budget-1', budget: 'https://example.org/budget', programme: null }), eventOrganizerPermissions());
        await page.goto('/events/budget-1');

        await expect(fact(page, 'Budget link').getByRole('link')).toHaveAttribute('href', 'https://example.org/budget');
        await expect(fact(page, 'Program link').getByRole('link')).toHaveCount(0);
    });

    test('a submitted event says it waits for the approval team', async ({ page, api }) => {
        showEvent(api, organizedEvent({ url: 'sub-1', status: 'submitted' }), eventOrganizerPermissions('submitted'));
        await page.goto('/events/sub-1');

        await expect(page.getByText('This event is visible to EQAC and organisers only because it\'s not approved yet.')).toBeVisible();
        await expect(page.getByText('This event is under approval. Wait a little till EQAC approves it.')).toBeVisible();
        await expect(page.getByText(/This event is in the "draft" status/)).toHaveCount(0);
        // Organisers can't touch a submitted event, and published-only actions are not offered.
        for (const action of ['Ask for approval', 'Approve event', 'Request changes', 'Change picture']) {
            await expect(page.getByRole('button', { name: action })).toHaveCount(0);
        }
        await expect(page.getByRole('link', { name: 'Manage my application' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'View applications' })).toBeVisible();
    });

    test('shows a map for an event with one location', async ({ page, api }) => {
        mockMap(api);
        showEvent(api, event({ url: 'map-1', locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }] }));
        await page.goto('/events/map-1');

        await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/maps/basic/style.json*').length).toBeGreaterThan(0);
    });

    test('shows a map for an event with several locations', async ({ page, api }) => {
        mockMap(api);
        showEvent(api, event({
            url: 'map-2',
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }, { name: 'Utrecht', position: { lat: 52.09, lng: 5.12 } }]
        }));
        await page.goto('/events/map-2');

        await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/maps/basic/style.json*').length).toBeGreaterThan(0);
    });

    test('leaving the page before the map library has loaded breaks nothing', async ({ page, api, layout }) => {
        mockMap(api);
        const arrived = delayMapLibrary(page, api);
        showEvent(api, event({ url: 'map-3', name: 'Map Event', locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }] }));
        api.fallback(mockEverything);
        await page.goto('/events/map-3');
        await expect(page.getByRole('heading', { name: 'Map Event', level: 1 })).toBeVisible();

        await (await openMenu(page, layout)).getByRole('link', { name: 'Events calendar' }).click();
        await expect(page).toHaveURL('/calendar');

        // The library arrives after the map is gone (an uncaught error would fail the test).
        await arrived;
        await expect(page).toHaveURL('/calendar');
    });

    test('an event without locations has no map', async ({ page, api }) => {
        showEvent(api, event({ url: 'nomap-1', name: 'No Map', locations: [] }));
        await page.goto('/events/nomap-1');

        await expect(page.getByRole('heading', { name: 'No Map' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Map' })).toHaveCount(0);
    });

    test('other load errors go back to the list with the message', async ({ page, api }) => {
        api.on('GET events /single/:id', { status: 403, json: forbidden('You cannot see this event.') });
        api.json('GET events /', ok([]));

        await page.goto('/events/hidden-1');

        await expect(toast(page, 'Some error happened: You cannot see this event.')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('visitors can see a published event', async ({ page, api, layout }) => {
            showEvent(api, event({ url: 'public-1', name: 'Public Event' }), eventPermissions({ apply: false, create_event: false }));

            await page.goto('/events/public-1');

            await expect(page.getByRole('heading', { name: 'Public Event', level: 1 })).toBeVisible();
            const account = await openAccountMenu(page, layout);
            await expect(account.getByRole('link', { name: 'Login' })).toBeVisible();
            // No ban notice without a member.
            await expect(page.getByText(/You are temporarily banned/)).toHaveCount(0);
        });
    });
    test('a load that fails after the member left the page neither shows an error nor moves them', async ({ page, api, layout }) => {
        api.on('GET events /single/:id', { status: 403, json: forbidden('You cannot see this event.'), delayMs: 1500 });
        api.fallback(mockEverything);
        const late = page.waitForResponse((response) => /^\/api\/events\/single\/hidden-1$/.test(new URL(response.url()).pathname));
        await page.goto('/events/hidden-1');

        await (await openMenu(page, layout)).getByRole('link', { name: 'Events calendar' }).click();
        await expect(page).toHaveURL('/calendar');

        await late;
        await settle(page);
        // The member stays where they went, without an error about the page they left (counted
        // at once: a retried assertion would wait until a toast is gone).
        await expect(page).toHaveURL('/calendar');
        expect(await toast(page, /Some error happened/).count()).toBe(0);
    });
});
