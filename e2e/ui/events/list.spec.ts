// Events list (/events, /events/participating, /events/organizing): what a member sees and
// can do.
import type { Page } from '@playwright/test';

import { FIXED_NOW, iso, ok } from '../support/factories/base.ts';
import { eventSummary, participatingEvent } from '../support/factories/events.ts';
import { freezeTime, openMenu, toast } from '../support/shell.ts';
import { test, expect, type Layout } from '../support/test.ts';

const NOW = Date.parse(FIXED_NOW);

// The sidebar with the events part opened.
const eventsMenu = async (page: Page, layout: Layout) => {
    const menu = await openMenu(page, layout);
    const listing = menu.getByRole('button', { name: 'Events listing' });
    if (await listing.getAttribute('aria-expanded') !== 'true') await listing.click();
    return menu;
};
const PICTURE = { body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), contentType: 'image/png' };

test.describe('events list', () => {
    test('shows upcoming published events with their key facts', async ({ page, api }) => {
        api.json('GET events /', ok([
            eventSummary({ id: 1, name: 'Spring Training', url: 'spring-training', type: 'training', fee: 50, optional_fee: 10 }),
            eventSummary({ id: 2, name: 'Network Meeting', url: 'nwm-1', type: 'nwm', fee: 0, application_status: 'closed', application_starts: iso(-20), application_ends: iso(-1) })
        ]));

        await page.goto('/events');

        await expect(page.getByRole('heading', { name: 'Events list' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List all events');

        const training = page.getByRole('article', { name: 'Spring Training' });
        await expect(training.getByText('Training Event', { exact: true })).toBeVisible();
        await expect(training.getByText('€50')).toBeVisible();
        await expect(training.getByText('(+ €10)')).toBeVisible();
        await expect(training.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(training.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/events/spring-training');
        await expect(training.getByRole('link', { name: 'Apply!' })).toHaveAttribute('href', '/events/spring-training/applications/me');

        const nwm = page.getByRole('article', { name: 'Network Meeting' });
        await expect(nwm.getByText('Free')).toBeVisible();
        await expect(nwm.getByText('Applications are closed')).toBeVisible();
        await expect(nwm.getByRole('link', { name: 'Apply!' })).toHaveCount(0);

        // Only upcoming events are asked for, 30 at a time.
        const [list] = api.callsTo('GET events /');
        expect(list.query.get('limit')).toBe('30');
        expect(list.query.get('offset')).toBe('0');
        expect(list.query.get('starts')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('searching asks the API again and replaces the results', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => ({
            json: ok(query.get('search') === 'winter'
                ? [eventSummary({ name: 'Winter School' })]
                : [eventSummary({ name: 'Spring Training' })])
        }));

        await page.goto('/events');
        await expect(page.getByText('Spring Training')).toBeVisible();

        await page.getByRole('textbox', { name: 'Search by name or description' }).fill('winter');

        await expect(page.getByText('Winter School')).toBeVisible();
        await expect(page.getByText('Spring Training')).toHaveCount(0);
        expect(api.callsTo('GET events /').at(-1)?.query.get('search')).toBe('winter');
    });

    test('filters by event type', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        await page.getByRole('checkbox', { name: 'Training Event' }).check();
        await page.getByRole('checkbox', { name: 'Network Meeting' }).check();

        await expect.poll(() => api.callsTo('GET events /').at(-1)?.query.getAll('type[]')).toEqual(['training', 'nwm']);
    });

    test('can include past events', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        await page.getByRole('button', { name: 'Display past events' }).click();

        await expect(page.getByRole('button', { name: 'Display only future events' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET events /').length).toBe(2);
        expect(api.callsTo('GET events /').at(-1)?.query.has('starts')).toBe(false);
    });

    test('says so when there are no events', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('loads the next page on request while full pages come back', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => {
            const offset = Number(query.get('offset'));
            const count = offset === 0 ? 30 : 5;
            return { json: ok(Array.from({ length: count }, (_, i) => eventSummary({ name: `Event ${offset + i + 1}` }))) };
        });

        await page.goto('/events');
        await expect(page.getByText('Event 30', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Load more events' }).click();

        await expect(page.getByText('Event 35', { exact: true })).toBeVisible();
        await expect(page.getByText('Event 1', { exact: true })).toBeVisible();
        expect(api.callsTo('GET events /').at(-1)?.query.get('offset')).toBe('30');
        // Fewer than a full page: nothing more to load.
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('shows "Create event" only to members who may create events', async ({ page, api, myPermissions }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        // The sidebar menu may link there too; this is the button on the page.
        const main = page.getByRole('main');
        await expect(main.getByRole('link', { name: 'Create event' })).toHaveAttribute('href', '/events/new');

        myPermissions.splice(0, myPermissions.length, ...myPermissions.filter((permission) => permission.combined !== 'global:create:event'));
        await page.reload();
        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(main.getByRole('link', { name: 'Create event' })).toHaveCount(0);
    });

    test('lists the events I take part in without paging', async ({ page, api }) => {
        api.json('GET events /mine/participating', ok(Array.from({ length: 30 }, (_, i) => eventSummary({ name: `Mine ${i + 1}` }))));

        await page.goto('/events/participating');

        await expect(page).toHaveTitle('MyAEGEE | List events I\'m participating at');
        await expect(page.getByText('Mine 30', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('shows an error when the events cannot be loaded', async ({ page, api }) => {
        api.on('GET events /', { status: 422, json: { success: false, message: 'The type filter should be one or more of: training, nwm, conference, cultural, thematic.' } });

        await page.goto('/events');

        await expect(toast(page, 'Could not fetch events list: The type filter should be one or more of: training, nwm, conference, cultural, thematic.')).toBeVisible();
    });

    test('lists the events I organise without paging', async ({ page, api }) => {
        api.json('GET events /mine/organizing', ok(Array.from({ length: 30 }, (_, i) => eventSummary({ name: `Organised ${i + 1}` }))));

        await page.goto('/events/organizing');

        await expect(page).toHaveTitle('MyAEGEE | List events I\'m organising');
        await expect(page.getByText('Organised 30', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
        const [list] = api.callsTo('GET events /mine/organizing');
        expect(list.query.get('limit')).toBe('30');
    });

    test('the classic view shows the description, period, organisers and "My application"', async ({ page, api }) => {
        api.json('GET events /', ok([eventSummary({
            id: 4,
            name: 'Spring Training',
            url: 'spring-training',
            description: 'Learn **project management**.',
            application_starts: '2027-02-01T09:00:00.000Z',
            application_ends: '2027-02-15T09:00:00.000Z',
            starts: '2027-03-01T09:00:00.000Z',
            ends: '2027-03-07T09:00:00.000Z',
            organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }, { body_id: 2, body_name: 'AEGEE-Other' }]
        })]));
        await page.goto('/events');

        await page.getByRole('checkbox', { name: 'Display classic list view' }).check({ force: true });

        const card = page.getByRole('article', { name: 'Spring Training' });
        await expect(card.getByText('project management')).toHaveJSProperty('tagName', 'STRONG');
        await expect(card.getByRole('listitem').filter({ hasText: 'Type:' })).toHaveText('Type: Training Event');
        await expect(card.getByRole('listitem').filter({ hasText: 'From:' })).toHaveText('From: 2027-03-01');
        await expect(card.getByRole('listitem').filter({ hasText: 'To:' })).toHaveText('To: 2027-03-07');
        await expect(card.getByRole('listitem').filter({ hasText: 'Application period:' })).toHaveText('Application period: 2027-02-01 - 2027-02-15');
        await expect(card.getByRole('link', { name: 'AEGEE-Other' })).toHaveAttribute('href', '/bodies/2');
        await expect(card.getByRole('link', { name: 'Spring Training' })).toHaveAttribute('href', '/events/spring-training');
        await expect(card.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/events/spring-training');
        await expect(card.getByRole('link', { name: 'My application' })).toHaveAttribute('href', '/events/spring-training/applications/me');
    });

    test('the classic view leaves out the period and "My application" for events without applications', async ({ page, api }) => {
        api.json('GET events /', ok([eventSummary({ name: 'Online Talk', method: 'online', has_applications: false })]));
        await page.goto('/events');

        await page.getByRole('checkbox', { name: 'Display classic list view' }).check({ force: true });

        const card = page.getByRole('article', { name: /^Online Talk/ });
        await expect(card.getByText('Online, no applications')).toBeVisible();
        await expect(card.getByText('Application period:')).toHaveCount(0);
        await expect(card.getByRole('link', { name: 'My application' })).toHaveCount(0);
        await expect(card.getByRole('link', { name: 'Go to event page' })).toBeVisible();
    });

    test('online events are tagged in both views', async ({ page, api }) => {
        api.json('GET events /', ok([
            eventSummary({ id: 1, name: 'Online Course', method: 'online', has_applications: true }),
            eventSummary({ id: 2, name: 'Online Talk', method: 'online', has_applications: false }),
            eventSummary({ id: 3, name: 'Spring Training' })
        ]));
        await page.goto('/events');

        for (const view of ['grid', 'classic']) {
            await expect(page.getByRole('article', { name: /^Online Course/ }).getByText('Online', { exact: true }), view).toBeVisible();
            await expect(page.getByRole('article', { name: /^Online Talk/ }).getByText('Online, no applications'), view).toBeVisible();
            await expect(page.getByRole('article', { name: 'Spring Training' }).getByText(/^Online/), view).toHaveCount(0);
            await page.getByRole('checkbox', { name: 'Display classic list view' }).check({ force: true });
        }
    });

    test('an event with a picture shows it in both views, others the logo', async ({ page, api }) => {
        api.json('GET events /', ok([
            eventSummary({ id: 1, name: 'With Picture', image: 'head.png' }),
            eventSummary({ id: 2, name: 'Without Picture', image: null })
        ]));
        api.url('GET', '/media/events/headimages/head.png', PICTURE);
        await page.goto('/events');

        for (const view of ['grid', 'classic']) {
            await expect(page.getByRole('article', { name: 'With Picture' }).getByRole('img', { name: 'With Picture' }), view).toHaveAttribute('src', '/media/events/headimages/head.png');
            // The AEGEE logo instead is decoration: the card's title says what it is about.
            await expect(page.getByRole('article', { name: 'Without Picture' }).getByRole('img'), view).toHaveCount(0);
            await page.getByRole('checkbox', { name: 'Display classic list view' }).check({ force: true });
        }
        expect(api.callsTo('GET url /media/events/headimages/head.png').length).toBeGreaterThan(0);
    });

    test('says when applications open, are open and are closed', async ({ page, api }) => {
        await freezeTime(page);
        api.json('GET events /', ok([
            eventSummary({ id: 1, name: 'Not Yet', application_status: 'closed', application_starts: '2027-03-05T09:00:00.000Z', application_ends: '2027-03-20T09:00:00.000Z' }),
            eventSummary({ id: 2, name: 'Open Now', application_status: 'open', application_starts: iso(-2, NOW), application_ends: '2027-03-10T09:00:00.000Z' }),
            eventSummary({ id: 3, name: 'Too Late', application_status: 'closed', application_starts: iso(-20, NOW), application_ends: iso(-2, NOW) }),
            eventSummary({ id: 4, name: 'No Applications', method: 'online', has_applications: false, application_status: 'closed', application_starts: iso(-20, NOW), application_ends: iso(-2, NOW) })
        ]));
        await page.goto('/events');

        await expect(page.getByRole('article', { name: 'Not Yet' }).getByText('Apply after 2027-03-05')).toBeVisible();
        await expect(page.getByRole('article', { name: 'Not Yet' }).getByRole('link', { name: 'Apply!' })).toHaveCount(0);
        await expect(page.getByRole('article', { name: 'Open Now' }).getByText('Apply before 2027-03-10')).toBeVisible();
        await expect(page.getByRole('article', { name: 'Open Now' }).getByRole('link', { name: 'Apply!' })).toBeVisible();
        await expect(page.getByRole('article', { name: 'Too Late' }).getByText('Applications are closed')).toBeVisible();
        const none = page.getByRole('article', { name: /^No Applications/ });
        await expect(none.getByText(/^Apply|Applications are closed/)).toHaveCount(0);
        await expect(none.getByRole('link', { name: 'Apply!' })).toHaveCount(0);
    });

    test('a one-day event shows one date, a longer one the range', async ({ page, api }) => {
        api.json('GET events /', ok([
            eventSummary({ id: 1, name: 'One Day', starts: '2027-04-10T08:00:00.000Z', ends: '2027-04-10T16:00:00.000Z' }),
            eventSummary({ id: 2, name: 'Long One', starts: '2027-04-10T08:00:00.000Z', ends: '2027-04-12T16:00:00.000Z' })
        ]));
        await page.goto('/events');

        await expect(page.getByRole('article', { name: 'One Day' }).getByRole('cell', { name: /2027/ })).toHaveText('2027-04-10');
        await expect(page.getByRole('article', { name: 'Long One' }).getByRole('cell', { name: /2027/ })).toHaveText('2027-04-10 - 2027-04-12');
    });

    test('links fall back to the event id when it has no URL', async ({ page, api }) => {
        api.json('GET events /', ok([eventSummary({ id: 42, name: 'No Url', url: '' })]));
        await page.goto('/events');

        const card = page.getByRole('article', { name: 'No Url' });
        await expect(card.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/events/42');
        await expect(card.getByRole('link', { name: 'Apply!' })).toHaveAttribute('href', '/events/42/applications/me');

        await page.getByRole('checkbox', { name: 'Display classic list view' }).check({ force: true });
        await expect(card.getByRole('link', { name: 'No Url' })).toHaveAttribute('href', '/events/42');
        await expect(card.getByRole('link', { name: 'My application' })).toHaveAttribute('href', '/events/42/applications/me');
    });

    test('warns when permissions can\'t be loaded but still lists the events', async ({ page, api, myPermissions }) => {
        // The app asks once when it starts (that one has to work, or the member is logged out),
        // the list asks again for its own button.
        let asked = 0;
        api.on('GET core /my_permissions', () => (asked++ === 0 ? { json: ok(myPermissions) } : { abort: 'failed' }));
        api.json('GET events /', ok([eventSummary({ name: 'Spring Training' })]));

        await page.goto('/events');

        // The warning has no details of the error.
        await expect(toast(page, 'Could not fetch permissions')).toBeVisible();
        await expect(page.getByRole('article', { name: 'Spring Training' })).toBeVisible();
        await expect(page.getByRole('main').getByRole('link', { name: 'Create event' })).toHaveCount(0);
    });

    test('typing again drops the earlier search', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => {
            if (query.get('search') === 'w') return { json: ok([eventSummary({ name: 'Wrong Result' })]), delayMs: 1500 };
            if (query.get('search') === 'wi') return { json: ok([eventSummary({ name: 'Winter School' })]) };
            return { json: ok([]) };
        });
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();

        const search = page.getByRole('textbox', { name: 'Search by name or description' });
        await search.press('w');
        await expect.poll(() => api.callsTo('GET events /').length).toBe(2);
        await search.press('i');

        await expect(page.getByRole('article', { name: 'Winter School' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET events /').map((call) => call.query.get('search'))).toEqual([null, 'w', 'wi']);
        // The first answer would have come in by now; it was dropped, and no error is shown.
        await expect.poll(() => api.callsTo('GET events /').find((call) => call.query.get('search') === 'w')?.status).toBeDefined();
        await expect(page.getByRole('article', { name: 'Wrong Result' })).toHaveCount(0);
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('moving between all, participating and organising events in the menu reloads the list', async ({ page, api, layout }) => {
        api.json('GET events /', ok([eventSummary({ name: 'Everybody\'s Event' })]));
        api.json('GET events /mine/participating', ok([participatingEvent({ name: 'My Application Event' })]));
        api.json('GET events /mine/organizing', ok([eventSummary({ name: 'My Organised Event' })]));
        await page.goto('/events');
        await expect(page.getByRole('article', { name: 'Everybody\'s Event' })).toBeVisible();

        await (await eventsMenu(page, layout)).getByRole('link', { name: 'Participating' }).click();
        await expect(page).toHaveURL('/events/participating');
        await expect(page.getByRole('article', { name: 'My Application Event' })).toBeVisible();
        await expect(page.getByRole('article', { name: 'Everybody\'s Event' })).toHaveCount(0);

        await (await eventsMenu(page, layout)).getByRole('link', { name: 'Organising' }).click();
        await expect(page).toHaveURL('/events/organizing');
        await expect(page.getByRole('article', { name: 'My Organised Event' })).toBeVisible();
        await expect(page.getByRole('article', { name: 'My Application Event' })).toHaveCount(0);
    });

    test('"Load more events" is disabled while the next page loads', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => (query.get('offset') === '0'
            ? { json: ok(Array.from({ length: 30 }, (_, i) => eventSummary({ name: `Event ${i + 1}` }))) }
            : { json: ok([eventSummary({ name: 'Event 31' })]), delayMs: 1000 }));
        await page.goto('/events');
        const more = page.getByRole('button', { name: 'Load more events' });
        await expect(page.getByText('Event 30', { exact: true })).toBeVisible();

        await more.click();

        await expect(more).toBeDisabled();
        await expect(page.getByText('Event 31', { exact: true })).toBeVisible();
        await expect(more).toBeHidden();
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('visitors see the list without "Create event" and without asking for permissions', async ({ page, api }) => {
            api.json('GET events /', ok([eventSummary({ name: 'Spring Training' })]));

            await page.goto('/events');

            await expect(page.getByRole('article', { name: 'Spring Training' })).toBeVisible();
            await expect(page.getByRole('main').getByRole('link', { name: 'Create event' })).toHaveCount(0);
            expect(api.callsTo('GET core /my_permissions')).toHaveLength(0);
        });
    });
});
