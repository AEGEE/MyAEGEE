// Event page (/events/:id): the facts about an event and what the viewer can do with it.
import type { Page } from '@playwright/test';

import { notFound, ok } from '../support/factories/base.ts';
import { event, eventPermissions, organizerPermissions, type Event, type EventPermissions } from '../support/factories/events.ts';
import { openAccountMenu, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// The value next to a label in the event's facts table.
const fact = (page: Page, label: string | RegExp) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: typeof label === 'string' }) })
    .getByRole('cell');

const showEvent = (api: import('../support/api-mock.ts').ApiMock, data: Event, permissions: EventPermissions = eventPermissions()) => {
    api.on('GET events /single/:id', ({ params }) => (params.id === data.url || params.id === String(data.id)
        ? { json: ok(data, { permissions }) }
        : { status: 404, json: notFound('Event is not found') }));
};

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
        api.json('DELETE events /single/:id', { success: true, message: 'Event is deleted.' });
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
            return { json: { success: true } };
        });
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Ask for approval' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Event status is now submitted')).toBeVisible();
        await expect(page.getByText('This event is under approval.')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/status').map((call) => call.body)).toEqual([{ status: 'submitted' }]);
    });

    test('an unknown event goes back to the list', async ({ page, api }) => {
        api.on('GET events /single/:id', { status: 404, json: notFound('Event is not found') });
        api.json('GET events /', ok([]));

        await page.goto('/events/does-not-exist');

        await expect(toast(page, 'Event is not found')).toBeVisible();
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
        });
    });
});
