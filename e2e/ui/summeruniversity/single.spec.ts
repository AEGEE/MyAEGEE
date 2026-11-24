// Summer University page (/summeruniversity/:id): the facts about an SU and what the viewer may
// do with it: apply, the organisers' actions and SUCT's status and publication changes.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, iso, notFound, ok, validationError } from '../support/factories/base.ts';
import {
    suctPermissions, suEvent, suEventFull, suEventMinimal, suLocation, suOrganizerPermissions, suPermissions,
    type SuEventMinimal, type SuPermissions, type SuStatus
} from '../support/factories/summeruniversity.ts';
import { mockMap } from '../support/map.ts';
import { dialog, openMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// What the service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';

// The value next to a label in the facts table.
const fact = (page: Page, label: string | RegExp) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: typeof label === 'string' }) })
    .getByRole('cell');

const factLabel = (page: Page, label: string) => page.getByRole('rowheader', { name: label, exact: true });

// Answers the SU's page with `data` and `permissions`, by its url or id.
const showSu = (api: ApiMock, data: SuEventMinimal, permissions: SuPermissions = suPermissions()) => {
    api.json('GET summeruniversity /single/:id', ok(data, { permissions }));
};

// The list the page sends the viewer back to.
const mockList = (api: ApiMock) => {
    api.json('GET summeruniversity /seasons', ok([]));
    api.json('GET summeruniversity /', ok([]));
};

const STATUS_ACTIONS = [
    'Submit first draft', 'Submit second draft', 'Submit event for second approval', 'Approve first submission',
    'Approve second submission', 'Reject first submission', 'Reject second submission'
];

const SUCT_ACTIONS = ['Publish minimal event', 'Publish full event', 'Unpublish event', 'Delete event'];

test.describe('Summer University page', () => {
    test('shows the facts of a fully published Summer University', async ({ page, api }) => {
        mockMap(api);
        showSu(api, suEventFull({
            id: 21,
            name: 'Mountains and Languages',
            url: 'mountains',
            email: 'mountains@example.org',
            description: 'Two weeks of **hiking**.',
            // 08:00 UTC is 10:00 in Brussels in summer time, 09:00 UTC is 10:00 in winter.
            application_starts: '2027-02-01T09:00:00.000Z',
            application_ends: '2027-03-15T09:00:00.000Z',
            starts: '2027-07-01T08:00:00.000Z',
            ends: '2027-07-14T15:30:00.000Z',
            locations: [suLocation({ name: 'Brussels', start: true, end: false })],
            organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }, { body_id: 2, body_name: 'AEGEE-Other' }],
            website: 'https://su.example.org/',
            social_media: [{ name: '', description: 'https://social.example.org/mountains' }]
        }));

        await page.goto('/summeruniversity/mountains');

        await expect(page).toHaveTitle('MyAEGEE | Display single event');
        await expect(page.getByRole('heading', { name: 'Mountains and Languages', level: 1 })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Mail organisers' })).toHaveAttribute('href', 'mailto:mountains@example.org');

        await expect(fact(page, 'Event name')).toHaveText('Mountains and Languages');
        await expect(fact(page, 'Description').getByText('hiking')).toHaveJSProperty('tagName', 'STRONG');
        await expect(fact(page, 'Event type')).toHaveText('Regular SU');
        await expect(fact(page, 'Theme category')).toHaveText('Leisure');
        await expect(fact(page, 'Theme')).toHaveText('Mountains and languages');
        await expect(fact(page, 'Max. participants')).toHaveText('25');
        await expect(fact(page, 'Application status')).toHaveText('Open');
        await expect(fact(page, /^Application period starts/)).toHaveText('2027-02-01 10:00');
        await expect(fact(page, /^Application period ends/)).toHaveText('2027-03-15 10:00');
        await expect(fact(page, /^Starts(?! in)/)).toHaveText('2027-07-01 10:00');
        await expect(fact(page, 'Starts in')).toHaveText('Brussels');
        await expect(fact(page, /^Ends(?! in)/)).toHaveText('2027-07-14 17:30');
        await expect(fact(page, 'Ends in')).toHaveText('Not specified');
        await expect(fact(page, 'Fee')).toHaveText('€150');
        await expect(fact(page, 'Optional fee')).toHaveText('€20');
        await expect(fact(page, 'Optional programme')).toHaveText('A day trip to the sea');
        await expect(fact(page, 'Accommodation type')).toHaveText('Hostel');
        await expect(fact(page, 'Ideal participant')).toHaveText('Somebody who likes walking');
        await expect(fact(page, 'Participant confirmation needed')).toHaveText('Payment');
        await expect(fact(page, 'List of activities')).toHaveText('Hiking, cooking, a city tour');
        await expect(fact(page, 'Special equipment needed')).toHaveText('Walking shoes');
        await expect(fact(page, 'Course level')).toHaveText('Beginner');
        await expect(fact(page, 'Courses')).toHaveText('Basic Spanish');
        await expect(fact(page, 'Trainers')).toHaveText('Two language trainers');
        await expect(fact(page, 'Has university support?')).toHaveText('Yes');
        await expect(fact(page, 'Payment and cancellation rules')).toHaveText('No refunds after the first of June');
        await expect(fact(page, 'SU specific regulations')).toHaveText('No smoking in the hostel');
        await expect(fact(page, 'Organising bodies').getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(fact(page, 'Organising bodies').getByRole('link', { name: 'AEGEE-Other' })).toHaveAttribute('href', '/bodies/2');

        const website = fact(page, 'Website').getByRole('link', { name: 'https://su.example.org/' });
        await expect(website).toHaveAttribute('href', 'https://su.example.org/');
        await expect(website).toHaveAttribute('target', '_blank');
        await expect(fact(page, 'Social media').getByRole('link', { name: 'https://social.example.org/mountains' }))
            .toHaveAttribute('href', 'https://social.example.org/mountains');

        // A member sees neither SUCT's rows nor the budget and programme links.
        for (const label of ['Status', 'Publication status', 'Budget link', 'Programme link']) {
            await expect(factLabel(page, label)).toHaveCount(0);
        }
        await expect(page.getByText('This event is visible to SUCT and organisers only')).toHaveCount(0);
    });

    test('a minimal Summer University leaves out the optional rows and says what is not set', async ({ page, api }) => {
        showSu(api, suEventMinimal({ name: 'Minimal Mountains', url: 'minimal', fee: 0, optional_fee: null, optional_programme: null, locations: [], application_status: 'closed' }), suPermissions({ apply: false }));

        await page.goto('/summeruniversity/minimal');

        await expect(page.getByRole('heading', { name: 'Minimal Mountains', level: 1 })).toBeVisible();
        await expect(fact(page, 'Fee')).toHaveText('Free');
        await expect(fact(page, 'Starts in')).toHaveText('Not specified');
        await expect(fact(page, 'Ends in')).toHaveText('Not specified');
        await expect(fact(page, 'Application status')).toHaveText('Closed');
        for (const label of [
            'Optional fee', 'Optional programme', 'Ideal participant', 'Participant confirmation needed', 'List of activities',
            'Special equipment needed', 'Course level', 'Courses', 'Trainers', 'Has university support?',
            'Payment and cancellation rules', 'SU specific regulations', 'Website', 'Social media', 'Spots available', 'Budget link'
        ]) {
            await expect(factLabel(page, label)).toHaveCount(0);
        }
        await expect(page.getByRole('rowheader', { name: /^Application period/ })).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Map' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    test('during an open call the spots replace the application period', async ({ page, api }) => {
        showSu(api, suEventFull({ url: 'island', open_call: true, available_spots: 4, locations: [] }));

        await page.goto('/summeruniversity/island');

        await expect(fact(page, 'Spots available')).toHaveText('4');
        await expect(page.getByRole('rowheader', { name: /^Application period/ })).toHaveCount(0);
    });

    test('a member can apply, or manage the application they have', async ({ page, api }) => {
        api.on('GET summeruniversity /single/:id', ({ params }) => ({
            json: ok(suEventFull({ url: params.id, locations: [] }), {
                permissions: params.id === 'open' ? suPermissions({ apply: true }) : suPermissions({ apply: false, see_own_application: true })
            })
        }));

        await page.goto('/summeruniversity/open');
        await expect(page.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/summeruniversity/open/applications/me');
        await expect(page.getByRole('link', { name: 'Manage application' })).toHaveCount(0);

        await page.goto('/summeruniversity/applied');
        await expect(page.getByRole('link', { name: 'Manage application' })).toHaveAttribute('href', '/summeruniversity/applied/applications/me');
        await expect(page.getByRole('link', { name: 'Apply' })).toHaveCount(0);

        // Members get none of the organisers' and SUCT's actions.
        for (const action of ['View applications', 'Edit event']) {
            await expect(page.getByRole('link', { name: action })).toHaveCount(0);
        }
        for (const action of ['Start open call', 'Close open call', 'Change picture', ...STATUS_ACTIONS, ...SUCT_ACTIONS]) {
            await expect(page.getByRole('button', { name: action })).toHaveCount(0);
        }
    });

    test('a member who is banned from applying sees why and no "Apply"', async ({ page, api, me }) => {
        me!.event_application_ban = { ban_until: iso(30), reason: 'No-show at the last SU' };
        showSu(api, suEventFull({ url: 'open', locations: [] }), suPermissions({ apply: true }));

        await page.goto('/summeruniversity/open');

        await expect(page.getByText(/You are temporarily banned from submitting new event applications until \d{4}-\d{2}-\d{2} \d{2}:\d{2}/)).toBeVisible();
        await expect(page.getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    test('a ban that is over doesn\'t keep a member from applying', async ({ page, api, me }) => {
        me!.event_application_ban = { ban_until: iso(-1), reason: 'No-show at the last SU' };
        showSu(api, suEventFull({ url: 'open', locations: [] }), suPermissions({ apply: true }));

        await page.goto('/summeruniversity/open');

        await expect(page.getByRole('link', { name: 'Apply' })).toBeVisible();
        await expect(page.getByText('You are temporarily banned')).toHaveCount(0);
    });

    test('organisers get the applications, the picture, editing and the open call, but not SUCT\'s actions', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', status: 'second draft', published: 'full', locations: [] }), suOrganizerPermissions('second draft'));

        await page.goto('/summeruniversity/mountains');

        await expect(page.getByRole('link', { name: 'View applications' })).toHaveAttribute('href', '/summeruniversity/mountains/participants');
        await expect(page.getByRole('link', { name: 'Edit event' })).toHaveAttribute('href', '/summeruniversity/mountains/edit');
        await expect(page.getByRole('button', { name: 'Change picture' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start open call' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Submit second draft' })).toBeVisible();
        // Organisers see the budget and programme links.
        await expect(fact(page, 'Budget link').getByRole('link')).toHaveAttribute('href', 'https://budget.example.org/su');
        await expect(fact(page, 'Programme link').getByRole('link')).toHaveAttribute('href', 'https://programme.example.org/su');

        for (const action of SUCT_ACTIONS) {
            await expect(page.getByRole('button', { name: action })).toHaveCount(0);
        }
        await expect(factLabel(page, 'Status')).toHaveCount(0);
        await expect(factLabel(page, 'Publication status')).toHaveCount(0);
    });

    // What SUCT may do in each status (helpers.js in summeruniversity), and the buttons for it.
    const TRANSITIONS: { status: SuStatus; shown: string[] }[] = [
        { status: 'first draft', shown: ['Submit first draft'] },
        { status: 'first submission', shown: ['Approve first submission', 'Reject first submission'] },
        { status: 'first approval', shown: ['Submit event for second approval'] },
        { status: 'second draft', shown: ['Submit second draft'] },
        { status: 'second submission', shown: ['Approve second submission', 'Reject second submission'] },
        { status: 'second approval', shown: [] }
    ];

    for (const { status, shown } of TRANSITIONS) {
        test(`SUCT gets the status changes of an SU in its ${status}`, async ({ page, api }) => {
            showSu(api, suEvent({ url: 'mountains', status, published: 'none', locations: [] }), suctPermissions(status));

            await page.goto('/summeruniversity/mountains');

            await expect(fact(page, 'Status')).toHaveText(status.charAt(0).toUpperCase() + status.slice(1));
            await expect(fact(page, 'Publication status')).toHaveText('None');
            await expect(page.getByRole('button', { name: 'Delete event' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Publish minimal event' })).toBeVisible();
            for (const action of STATUS_ACTIONS) {
                await expect(page.getByRole('button', { name: action })).toHaveCount(shown.includes(action) ? 1 : 0);
            }
        });
    }

    test('changing the status asks first, saves it and loads the new actions', async ({ page, api }) => {
        let status: SuStatus = 'first submission';
        api.on('GET summeruniversity /single/:id', () => ({ json: ok(suEvent({ id: 21, url: 'mountains', status, published: 'none', locations: [] }), { permissions: suctPermissions(status) }) }));
        api.on('PUT summeruniversity /single/:id/status', ({ body }) => {
            status = (body as { status: SuStatus }).status;
            return { json: { success: true, message: 'Successfully changed approval status' } };
        });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Approve first submission' }).click();

        const confirm = dialog(page, 'Change status');
        await expect(confirm).toContainText('Are you sure you want to change this event status to "first approval"?');
        await confirm.getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Event status is now first approval')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Submit event for second approval' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Approve first submission' })).toHaveCount(0);
        await expect(fact(page, 'Status')).toHaveText('First approval');
        expect(api.callsTo('PUT summeruniversity /single/:id/status').map((call) => [call.params.id, call.body])).toEqual([['21', { status: 'first approval' }]]);
        expect(api.callsTo('GET summeruniversity /single/:id')).toHaveLength(2);
    });

    test('a status change can be called off in the dialog', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', status: 'first submission', published: 'none', locations: [] }), suctPermissions('first submission'));

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Reject first submission' }).click();
        await dialog(page, 'Change status').getByRole('button', { name: 'Cancel' }).click();

        await expect(dialog(page, 'Change status')).toHaveCount(0);
        expect(api.callsTo('PUT summeruniversity /single/:id/status')).toEqual([]);
    });

    test('a failed status change shows the service\'s reason', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', status: 'first submission', published: 'none', locations: [] }), suctPermissions('first submission'));
        api.on('PUT summeruniversity /single/:id/status', { status: 403, json: { success: false, message: 'You are not allowed to change status.' } });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Reject first submission' }).click();
        await dialog(page, 'Change status').getByRole('button', { name: 'Change status' }).click();

        await expect(toast(page, 'Could not change event status: You are not allowed to change status.')).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/status').map((call) => call.body)).toEqual([{ status: 'first draft' }]);
        await expect(page.getByRole('button', { name: 'Reject first submission' })).toBeVisible();
    });

    test('SUCT publishes minimal, then full, then unpublishes', async ({ page, api }) => {
        let published: SuEventMinimal['published'] = 'none';
        api.on('GET summeruniversity /single/:id', () => ({ json: ok(suEvent({ id: 21, url: 'mountains', published, locations: [] }), { permissions: suctPermissions('second approval') }) }));
        api.on('PUT summeruniversity /single/:id/published', ({ body }) => {
            published = (body as { published: SuEventMinimal['published'] }).published;
            return { json: { success: true, message: 'Successfully changed publication status' } };
        });

        await page.goto('/summeruniversity/mountains');
        await expect(page.getByText('This event is visible to SUCT and organisers only because it\'s not published yet.')).toBeVisible();

        for (const [action, value, next] of [
            ['Publish minimal event', 'minimal', 'Publish full event'],
            ['Publish full event', 'full', 'Unpublish event'],
            ['Unpublish event', 'none', 'Publish minimal event']
        ]) {
            await page.getByRole('button', { name: action }).click();
            const confirm = dialog(page, 'Change status');
            await expect(confirm).toContainText(`Are you sure you want to change this event publication to "${value}"?`);
            await confirm.getByRole('button', { name: 'Change publication' }).click();
            await expect(toast(page, `Event publication is now ${value}`)).toBeVisible();
            await expect(fact(page, 'Publication status')).toHaveText(value.charAt(0).toUpperCase() + value.slice(1));
            await expect(page.getByRole('button', { name: next })).toBeVisible();
        }

        expect(api.callsTo('PUT summeruniversity /single/:id/published').map((call) => [call.params.id, call.body])).toEqual([
            ['21', { published: 'minimal' }], ['21', { published: 'full' }], ['21', { published: 'none' }]
        ]);
        await expect(page.getByRole('button', { name: 'Unpublish event' })).toHaveCount(0);
    });

    test('a failed publication change shows the service\'s reason', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', status: 'first approval', published: 'minimal', locations: [] }), suctPermissions('first approval'));
        api.on('PUT summeruniversity /single/:id/published', { status: 403, json: { success: false, message: 'This event status does not allow a full publication' } });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Publish full event' }).click();
        await dialog(page, 'Change status').getByRole('button', { name: 'Change publication' }).click();

        await expect(toast(page, 'Could not change event publication: This event status does not allow a full publication')).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/published').map((call) => call.body)).toEqual([{ published: 'full' }]);
    });

    test('starting an open call asks for the number of participants', async ({ page, api }) => {
        let openCall = false;
        api.on('GET summeruniversity /single/:id', () => ({
            json: ok(suEvent({ id: 21, url: 'mountains', max_participants: 25, open_call: openCall, locations: [] }), { permissions: suOrganizerPermissions() })
        }));
        api.on('PUT summeruniversity /single/:id/open_call', () => {
            openCall = true;
            return { json: { success: true, message: 'Successfully changed open call period' } };
        });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Start open call' }).click();

        const prompt = dialog(page, 'Start open call');
        await expect(prompt).toContainText('Set maximum amount of participants');
        const maximum = prompt.getByRole('spinbutton', { name: 'Maximum number of participants' });
        await expect(maximum).toHaveValue('25');
        await maximum.fill('30');
        await prompt.getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'Event open call is successfully changed')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Close open call' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start open call' })).toHaveCount(0);
        // The prompt gives the number as typed.
        expect(api.callsTo('PUT summeruniversity /single/:id/open_call').map((call) => [call.params.id, call.body])).toEqual([['21', { open_call: true, max_participants: '30' }]]);
    });

    test('the open call can\'t be started without a number', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', max_participants: null, locations: [] }), suOrganizerPermissions());

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Start open call' }).click();
        const prompt = dialog(page, 'Start open call');
        await expect(prompt.getByRole('spinbutton', { name: 'Maximum number of participants' })).toHaveValue('');
        await prompt.getByRole('button', { name: 'OK' }).click();

        // The browser keeps the prompt open: the number is required.
        await expect(prompt).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/open_call')).toEqual([]);
    });

    test('there is no "Start open call" when no spots are left', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', max_participants: 25, accepted_participants: 25, available_spots: 0, locations: [] }), suOrganizerPermissions());

        await page.goto('/summeruniversity/mountains');

        await expect(page.getByRole('link', { name: 'View applications' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start open call' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Close open call' })).toHaveCount(0);
    });

    test('closing an open call', async ({ page, api }) => {
        let openCall = true;
        api.on('GET summeruniversity /single/:id', () => ({
            json: ok(suEvent({ id: 21, url: 'mountains', open_call: openCall, available_spots: 3, locations: [] }), { permissions: suOrganizerPermissions() })
        }));
        api.on('PUT summeruniversity /single/:id/open_call', () => {
            openCall = false;
            return { json: { success: true, message: 'Successfully changed open call period' } };
        });

        await page.goto('/summeruniversity/mountains');
        await expect(fact(page, 'Spots available')).toHaveText('3');
        await page.getByRole('button', { name: 'Close open call' }).click();

        const confirm = dialog(page, 'Are you sure you want to close the open call.');
        await confirm.getByRole('button', { name: 'Close open call' }).click();

        await expect(toast(page, 'Event open call is successfully changed')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start open call' })).toBeVisible();
        await expect(factLabel(page, 'Spots available')).toHaveCount(0);
        expect(api.callsTo('PUT summeruniversity /single/:id/open_call').map((call) => call.body)).toEqual([{ open_call: false }]);
    });

    test('a failed open call change shows the service\'s reason', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', max_participants: 25, locations: [] }), suOrganizerPermissions());
        const message = 'The open call needs a free spot: max_participants should be more than the 25 accepted participants.';
        api.on('PUT summeruniversity /single/:id/open_call', { status: 422, json: { ...validationError({ open_call: [message] }), message } });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Start open call' }).click();
        await dialog(page, 'Start open call').getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, `Could not change event open call: ${message}`)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Start open call' })).toBeVisible();
    });

    test('an open call change while another change is saved asks to try again', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', open_call: true, locations: [] }), suOrganizerPermissions());
        api.on('PUT summeruniversity /single/:id/open_call', { status: 503, json: { success: false, message: 'Another change to this event is in progress. Please try again.' } });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Close open call' }).click();
        await dialog(page, 'Are you sure you want to close the open call.').getByRole('button', { name: 'Close open call' }).click();

        await expect(toast(page, 'Could not change event open call: Another change to this event is in progress. Please try again.')).toBeVisible();
    });

    test('deleting asks first and then goes back to the list', async ({ page, api }) => {
        showSu(api, suEvent({ id: 21, url: 'mountains', locations: [] }), suctPermissions());
        api.json('DELETE summeruniversity /single/:id', { success: true, message: 'Event successfully deleted' });
        mockList(api);

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Delete event' }).click();
        const confirm = dialog(page, 'Deleting an event');
        await expect(confirm).toContainText('Are you sure you want to delete this event?');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toHaveCount(0);
        expect(api.callsTo('DELETE summeruniversity /single/:id')).toEqual([]);

        await page.getByRole('button', { name: 'Delete event' }).click();
        await dialog(page, 'Deleting an event').getByRole('button', { name: 'Delete event' }).click();

        await expect(toast(page, 'Event is deleted.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
        expect(api.callsTo('DELETE summeruniversity /single/:id').map((call) => call.params)).toEqual([{ id: '21' }]);
    });

    test('a failed delete shows the service\'s reason and stays', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', locations: [] }), suctPermissions());
        api.on('DELETE summeruniversity /single/:id', { status: 403, json: { success: false, message: 'You are not permitted to delete this event.' } });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Delete event' }).click();
        await dialog(page, 'Deleting an event').getByRole('button', { name: 'Delete event' }).click();

        await expect(toast(page, 'Could not delete event: You are not permitted to delete this event.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/mountains');
    });

    test('the start and end cities stay after a status change', async ({ page, api }) => {
        mockMap(api);
        let status: SuStatus = 'second submission';
        const locations = [
            // The edit forms used to send the text 'true'.
            suLocation({ name: 'Brussels', start: 'true', end: 'false' }),
            suLocation({ name: 'Ghent', position: { lat: 51.05, lng: 3.72 }, start: false, end: true })
        ];
        api.on('GET summeruniversity /single/:id', () => ({ json: ok(suEvent({ url: 'mountains', status, locations }), { permissions: suctPermissions(status) }) }));
        api.on('PUT summeruniversity /single/:id/status', ({ body }) => {
            status = (body as { status: SuStatus }).status;
            return { json: { success: true, message: 'Successfully changed approval status' } };
        });

        await page.goto('/summeruniversity/mountains');
        await expect(fact(page, 'Starts in')).toHaveText('Brussels');
        await expect(fact(page, 'Ends in')).toHaveText('Ghent');

        await page.getByRole('button', { name: 'Approve second submission' }).click();
        await dialog(page, 'Change status').getByRole('button', { name: 'Change status' }).click();

        await expect(fact(page, 'Status')).toHaveText('Second approval');
        await expect(fact(page, 'Starts in')).toHaveText('Brussels');
        await expect(fact(page, 'Ends in')).toHaveText('Ghent');
    });

    test('an SU that is not published says who can see it', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', status: 'first submission', published: 'none', locations: [] }), suOrganizerPermissions('first submission'));

        await page.goto('/summeruniversity/mountains');

        await expect(page.getByText('This event is visible to SUCT and organisers only because it\'s not published yet.')).toBeVisible();
        await expect(page.getByText('Once the event will be published, others would be able to access it.')).toBeVisible();
    });

    test('SUCT sees the budget and programme links, also when only one is set', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', budget: null, locations: [] }), suctPermissions());

        await page.goto('/summeruniversity/mountains');

        const programme = fact(page, 'Programme link').getByRole('link', { name: 'https://programme.example.org/su' });
        await expect(programme).toHaveAttribute('href', 'https://programme.example.org/su');
        await expect(programme).toHaveAttribute('target', '_blank');
        await expect(fact(page, 'Budget link').getByRole('link')).toHaveCount(0);
    });

    test('the budget link alone is shown too', async ({ page, api }) => {
        showSu(api, suEvent({ url: 'mountains', programme_suct: '', locations: [] }), suctPermissions());

        await page.goto('/summeruniversity/mountains');

        await expect(fact(page, 'Budget link').getByRole('link', { name: 'https://budget.example.org/su' })).toHaveAttribute('href', 'https://budget.example.org/su');
        await expect(fact(page, 'Programme link').getByRole('link')).toHaveCount(0);
    });

    test('shows a map of the locations', async ({ page, api }) => {
        mockMap(api);
        showSu(api, suEventFull({
            url: 'mountains',
            locations: [suLocation({ name: 'Brussels' }), suLocation({ name: 'Ghent', position: { lat: 51.05, lng: 3.72 }, start: false, end: true })]
        }));

        await page.goto('/summeruniversity/mountains');

        await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/**')).toHaveLength(1);
    });

    test('a map with one location', async ({ page, api }) => {
        mockMap(api);
        showSu(api, suEventFull({ url: 'mountains', locations: [suLocation({ name: 'Brussels' })] }));

        await page.goto('/summeruniversity/mountains');

        await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/**')).toHaveLength(1);
    });

    test('an unknown Summer University goes back to the list', async ({ page, api }) => {
        api.on('GET summeruniversity /single/:id', { status: 404, json: notFound('Event with id nowhere not found') });
        mockList(api);

        await page.goto('/summeruniversity/nowhere');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('other errors go back to the list with the message', async ({ page, api }) => {
        api.on('GET summeruniversity /single/:id', { status: 500, json: { success: false, message: DATABASE_DOWN } });
        mockList(api);

        await page.goto('/summeruniversity/mountains');

        await expect(toast(page, `Some error happened: ${DATABASE_DOWN}`)).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('an SU the viewer may not see goes back to the list with the reason', async ({ page, api }) => {
        api.on('GET summeruniversity /single/:id', { status: 403, json: forbidden('You cannot see this event.') });
        mockList(api);

        await page.goto('/summeruniversity/mountains');

        await expect(toast(page, 'Some error happened: You cannot see this event.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('shows the SU\'s picture', async ({ page, api }) => {
        showSu(api, suEventFull({ name: 'Mountains and Languages', url: 'mountains', image: 'mountains.png', locations: [] }));
        api.url('GET', '/media/summeruniversity/headimages/mountains.png', {
            body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
            contentType: 'image/png'
        });

        await page.goto('/summeruniversity/mountains');

        await expect(page.getByRole('img', { name: 'Mountains and Languages' })).toHaveAttribute('src', '/media/summeruniversity/headimages/mountains.png');
    });

    test('every social media link is shown, without an error in the page', async ({ page, api, consoleErrors }) => {
        showSu(api, suEventFull({
            url: 'mountains',
            locations: [],
            social_media: [{ name: '', description: 'https://social.example.org/one' }, { name: '', description: 'https://social.example.org/two' }]
        }));

        await page.goto('/summeruniversity/mountains');

        await expect(fact(page, 'Social media').getByRole('link')).toHaveCount(2);
        expect(consoleErrors).toEqual([]);
    });

    test.describe('for a visitor', () => {
        test.use({ session: 'anonymous' });

        test('a published Summer University can be seen, without "Apply"', async ({ page, api }) => {
            showSu(api, suEventFull({ name: 'Mountains and Languages', url: 'mountains', locations: [] }), suPermissions({ apply_general: false, apply: undefined, see_own_application: undefined }));

            await page.goto('/summeruniversity/mountains');

            await expect(page.getByRole('heading', { name: 'Mountains and Languages', level: 1 })).toBeVisible();
            await expect(fact(page, 'Fee')).toHaveText('€150');
            await expect(page.getByRole('link', { name: 'Mail organisers' })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Apply' })).toHaveCount(0);
            await expect(page.getByText('You are temporarily banned')).toHaveCount(0);
        });
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
        await page.goto('/summeruniversity/mountains');
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
