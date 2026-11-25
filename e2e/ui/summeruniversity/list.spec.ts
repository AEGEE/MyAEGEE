// Summer University lists (/summeruniversity, /summeruniversity/participating,
// /summeruniversity/organizing): the seasons, the filters, the two views and what a member may do.
import type { Page } from '@playwright/test';

import { FIXED_NOW, iso, ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { suEvent, suEventFull, suEventMinimal, suParticipatingEvent, suSeason } from '../support/factories/summeruniversity.ts';
import { freezeTime, openMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// What the service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';

// A picture of one pixel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const now = Date.parse(FIXED_NOW);

// An answer the test lets through when it wants to: the handler waits until `release()`.
const held = () => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    return { release, released };
};

// Two frames: the page has handled an answer that arrived by then.
const settle = (page: Page) => page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));

// A request of the page to this path of the API (the mock records a call only once it has
// answered it, so a test waits for the request itself).
const isTo = (path: string) => (request: { url: () => string }) => new URL(request.url()).pathname.replace(/\/$/, '') === `/api${path}`;

// The member goes to the list of all events (another area's page) through the menu.
const goToAllEvents = async (page: Page, layout: 'desktop' | 'phone') => {
    const menu = await openMenu(page, layout);
    await menu.getByRole('button', { name: 'Events listing' }).click();
    await menu.getByRole('link', { name: 'All events' }).click();
    await expect(page).toHaveURL('/events');
};

const mountains = () => suEventFull({
    id: 11,
    name: 'Mountains and Languages',
    url: 'mountains',
    type: 'regular',
    starts: '2027-07-01T08:00:00.000Z',
    ends: '2027-07-14T08:00:00.000Z',
    application_ends: '2027-03-11T09:00:00.000Z',
    organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }]
});

const seaside = () => suEventFull({
    id: 12,
    name: 'Seaside Pilot',
    url: null,
    type: 'pilot',
    application_status: 'closed',
    application_starts: iso(-40, now),
    application_ends: iso(-10, now),
    organizing_bodies: [{ body_id: 5, body_name: 'AEGEE-Coast' }]
});

test.describe('Summer University list', () => {
    test('shows the Summer Universities of the active season with their facts', async ({ page, api }) => {
        await freezeTime(page);
        api.json('GET summeruniversity /seasons', ok([suSeason({ year: 2027, active: true }), suSeason({ year: 2026, active: false })]));
        api.json('GET summeruniversity /', ok([mountains(), seaside()]));

        await page.goto('/summeruniversity');

        await expect(page).toHaveTitle('MyAEGEE | List all events');
        await expect(page.getByRole('heading', { name: 'List of Summer Universities' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Select year' })).toHaveValue('2027');

        const open = page.getByRole('article', { name: 'Mountains and Languages' });
        await expect(open.getByText('Regular SU')).toBeVisible();
        await expect(open.getByText('Applications open')).toBeVisible();
        await expect(open.getByText('2027-07-01 - 2027-07-14')).toBeVisible();
        await expect(open.getByText('Apply before 2027-03-11 10:00')).toBeVisible();
        // The SU has no picture of its own: the logo, which is only decoration.
        await expect(open.getByRole('img')).toHaveCount(0);
        await expect(open.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(open.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/summeruniversity/mountains');
        await expect(open.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/summeruniversity/mountains/applications/me');

        const closed = page.getByRole('article', { name: 'Seaside Pilot' });
        await expect(closed.getByText('Pilot SU')).toBeVisible();
        await expect(closed.getByText('Applications closed')).toBeVisible();
        await expect(closed.getByText('Applications are closed')).toBeVisible();
        await expect(closed.getByRole('link', { name: 'AEGEE-Coast' })).toHaveAttribute('href', '/bodies/5');
        // Without a url the page is reached by the id.
        await expect(closed.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/summeruniversity/12');
        await expect(closed.getByRole('link', { name: 'Apply' })).toHaveCount(0);

        // The list of the active season, upcoming SUs only, 30 at a time.
        const [list] = api.callsTo('GET summeruniversity /');
        expect(Object.fromEntries(list.query)).toEqual({ limit: '30', offset: '0', season: '2027', starts: '2027-03-01' });
        expect(api.callsTo('GET core /my_permissions').length).toBeGreaterThan(0);
    });

    test('without an active season every season is asked for', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([suSeason({ year: 2026, active: false })]));
        api.json('GET summeruniversity /', ok([mountains()]));

        await page.goto('/summeruniversity');

        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
        // An empty season, which the service reads as no filter.
        expect(api.callsTo('GET summeruniversity /')[0].query.get('season')).toBe('');
    });

    test('choosing another year reloads the list', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([suSeason({ year: 2027, active: true }), suSeason({ year: 2026, active: false })]));
        api.on('GET summeruniversity /', ({ query }) => ({
            json: ok(query.get('season') === '2026' ? [suEventFull({ name: 'Last Year' })] : [mountains()])
        }));

        await page.goto('/summeruniversity');
        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();

        await page.getByRole('combobox', { name: 'Select year' }).selectOption('2026');

        await expect(page.getByRole('article', { name: 'Last Year' })).toBeVisible();
        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toHaveCount(0);
        expect(api.callsTo('GET summeruniversity /').map((call) => call.query.get('season'))).toEqual(['2027', '2026']);
    });

    test('a failing seasons request shows an error and still lists', async ({ page, api }) => {
        api.on('GET summeruniversity /seasons', { status: 500, json: { success: false, message: DATABASE_DOWN } });
        api.json('GET summeruniversity /', ok([mountains()]));

        await page.goto('/summeruniversity');

        await expect(toast(page, `Could not fetch seasons: ${DATABASE_DOWN}`)).toBeVisible();
        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
        // An empty season, which the service reads as no filter.
        expect(api.callsTo('GET summeruniversity /')[0].query.get('season')).toBe('');
    });

    test('search, type and application status filters are sent', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([]));
        await page.goto('/summeruniversity');
        await expect(page.getByText('No events found.')).toBeVisible();

        await page.getByRole('textbox', { name: 'Search by name or description' }).fill('mountain');
        await expect.poll(() => api.callsTo('GET summeruniversity /').at(-1)?.query.get('search')).toBe('mountain');

        await page.getByRole('checkbox', { name: 'Regular SU' }).check();
        await page.getByRole('checkbox', { name: 'Pilot SU' }).check();
        await expect.poll(() => api.callsTo('GET summeruniversity /').at(-1)?.query.getAll('type[]')).toEqual(['regular', 'pilot']);

        await page.getByRole('checkbox', { name: 'Open', exact: true }).check();
        await page.getByRole('checkbox', { name: 'Closed', exact: true }).check();
        await expect.poll(() => api.callsTo('GET summeruniversity /').at(-1)?.query.getAll('application_status[]')).toEqual(['open', 'closed']);

        const last = api.callsTo('GET summeruniversity /').at(-1);
        expect(last?.query.get('search')).toBe('mountain');
        expect(last?.query.get('offset')).toBe('0');
    });

    test('past events can be included and left out again', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([]));
        await page.goto('/summeruniversity');
        await expect(page.getByText('No events found.')).toBeVisible();

        await page.getByRole('button', { name: 'Display past events' }).click();
        await expect(page.getByRole('button', { name: 'Display only future events' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET summeruniversity /').length).toBe(2);
        expect(api.callsTo('GET summeruniversity /')[1].query.has('starts')).toBe(false);

        await page.getByRole('button', { name: 'Display only future events' }).click();
        await expect(page.getByRole('button', { name: 'Display past events' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET summeruniversity /').length).toBe(3);
        expect(api.callsTo('GET summeruniversity /')[2].query.has('starts')).toBe(true);
    });

    test('the classic view shows the open status, the deadline or the spots, the picture and Apply', async ({ page, api }) => {
        await freezeTime(page);
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([
            mountains(),
            suEventFull({ id: 13, name: 'Open Call Island', url: 'island', open_call: true, available_spots: 4, image: 'island.png' }),
            seaside()
        ]));
        api.url('GET', '/media/summeruniversity/headimages/island.png', { body: PNG, contentType: 'image/png' });

        await page.goto('/summeruniversity');
        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
        await page.getByText('Display classic list view').click();

        const open = page.getByRole('article', { name: 'Mountains and Languages' });
        await expect(open.getByText('Applications are open!')).toBeVisible();
        await expect(open.getByText('Two weeks of hiking and language courses.')).toBeVisible();
        await expect(open.getByRole('listitem').filter({ hasText: 'Type:' })).toHaveText(/Regular SU/);
        await expect(open.getByRole('listitem').filter({ hasText: 'From:' })).toHaveText(/2027-07-01/);
        await expect(open.getByRole('listitem').filter({ hasText: 'To:' })).toHaveText(/2027-07-14/);
        await expect(open.getByRole('listitem').filter({ hasText: 'Application deadline:' })).toHaveText(/2027-03-11 10:00/);
        await expect(open.getByText('Spots available:')).toHaveCount(0);
        await expect(open.getByRole('link', { name: 'Mountains and Languages' })).toHaveAttribute('href', '/summeruniversity/mountains');
        await expect(open.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(open.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/summeruniversity/mountains/applications/me');

        const openCall = page.getByRole('article', { name: 'Open Call Island' });
        await expect(openCall.getByRole('img', { name: 'Open Call Island' })).toHaveAttribute('src', '/media/summeruniversity/headimages/island.png');
        await expect(openCall.getByRole('listitem').filter({ hasText: 'Spots available:' })).toHaveText(/4/);
        await expect(openCall.getByText('Application deadline:')).toHaveCount(0);
        await expect(openCall.getByRole('link', { name: 'Apply' })).toBeVisible();

        const closed = page.getByRole('article', { name: 'Seaside Pilot' });
        await expect(closed.getByText('Applications are open!')).toHaveCount(0);
        await expect(closed.getByText('Application deadline:')).toHaveCount(0);
        await expect(closed.getByRole('link', { name: 'Seaside Pilot' })).toHaveAttribute('href', '/summeruniversity/12');
        await expect(closed.getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    test('the grid tags open calls, shows their spots and the picture, and minimal SUs say they are closed', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([
            suEventFull({ id: 13, name: 'Open Call Island', url: 'island', open_call: true, available_spots: 4, image: 'island.png' }),
            // Published as minimal: the list has no application period for it.
            suEventMinimal({ id: 14, name: 'Minimal Mountains', application_status: 'closed' })
        ]));
        api.url('GET', '/media/summeruniversity/headimages/island.png', { body: PNG, contentType: 'image/png' });

        await page.goto('/summeruniversity');

        const openCall = page.getByRole('article', { name: 'Open Call Island' });
        await expect(openCall.getByText('Open call', { exact: true })).toBeVisible();
        await expect(openCall.getByText('Spots available: 4')).toBeVisible();
        await expect(openCall.getByText('Applications open')).toHaveCount(0);
        await expect(openCall.getByRole('img', { name: 'Open Call Island' })).toHaveAttribute('src', '/media/summeruniversity/headimages/island.png');

        const minimal = page.getByRole('article', { name: 'Minimal Mountains' });
        await expect(minimal.getByText('Applications closed')).toBeVisible();
        await expect(minimal.getByText('Applications are closed')).toBeVisible();
    });

    test('"Create event" and "Apply" follow the member\'s permissions', async ({ page, api, myPermissions }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([mountains()]));
        const main = page.getByRole('main');

        // A member may apply, but not create Summer Universities.
        await page.goto('/summeruniversity');
        await expect(main.getByRole('link', { name: 'Apply' })).toBeVisible();
        await expect(main.getByRole('link', { name: 'Create event' })).toHaveCount(0);

        myPermissions.splice(0, myPermissions.length, ...myPermissions.filter((item) => item.combined !== 'global:apply:summeruniversity'));
        myPermissions.push(permission('global:create:summeruniversity'));
        await page.reload();

        await expect(main.getByRole('link', { name: 'Create event' })).toHaveAttribute('href', '/summeruniversity/new');
        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
        await expect(main.getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    test.describe('for a visitor', () => {
        test.use({ session: 'anonymous' });

        test('there is no permission request and no Create or Apply', async ({ page, api }) => {
            api.json('GET summeruniversity /seasons', ok([]));
            api.json('GET summeruniversity /', ok([mountains()]));

            await page.goto('/summeruniversity');

            const open = page.getByRole('article', { name: 'Mountains and Languages' });
            await expect(open.getByRole('link', { name: 'Go to event page' })).toBeVisible();
            await expect(open.getByRole('link', { name: 'Apply' })).toHaveCount(0);
            await expect(page.getByRole('main').getByRole('link', { name: 'Create event' })).toHaveCount(0);
            expect(api.callsTo('GET core /my_permissions')).toEqual([]);
        });
    });

    test('warns when the permissions can\'t be loaded', async ({ page, api, myPermissions }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([mountains()]));
        // The app asks for the permissions when it starts too: only the list's own request fails.
        let calls = 0;
        api.on('GET core /my_permissions', () => {
            calls += 1;
            return calls === 1 ? { json: ok(myPermissions) } : { status: 500, json: { success: false, message: DATABASE_DOWN } };
        });

        await page.goto('/summeruniversity');

        await expect(toast(page, 'Could not fetch permissions')).toBeVisible();
        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
        await expect(page.getByRole('main').getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    test('says so when there is nothing, and loads more while full pages come back', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.on('GET summeruniversity /', ({ query }) => {
            const offset = Number(query.get('offset'));
            if (query.get('search') === 'nothing') return { json: ok([]) };
            const count = offset === 0 ? 30 : 2;
            return { json: ok(Array.from({ length: count }, (_, index) => suEventFull({ name: `SU number ${offset + index + 1}` }))) };
        });

        await page.goto('/summeruniversity');
        await expect(page.getByRole('article', { name: 'SU number 30', exact: true })).toBeVisible();
        await expect(page.getByText('No events found.')).toBeHidden();

        await page.getByRole('button', { name: 'Load more events' }).click();

        await expect(page.getByRole('article', { name: 'SU number 32', exact: true })).toBeVisible();
        await expect(page.getByRole('article', { name: 'SU number 1', exact: true })).toBeVisible();
        expect(api.callsTo('GET summeruniversity /').at(-1)?.query.get('offset')).toBe('30');
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();

        await page.getByRole('textbox', { name: 'Search by name or description' }).fill('nothing');
        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('lists the SUs I take part in and organise, and the menu switches between them', async ({ page, api, layout }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /mine/participating', ok(Array.from({ length: 30 }, (_, index) => suParticipatingEvent({ name: `Applied ${index + 1}` }))));
        api.json('GET summeruniversity /mine/organizing', ok([suEvent({ name: 'Organised by me', status: 'first submission', published: 'none' })]));

        await page.goto('/summeruniversity/participating');

        await expect(page).toHaveTitle('MyAEGEE | List events I\'m participating');
        await expect(page.getByRole('article', { name: 'Applied 30', exact: true })).toBeVisible();
        // These lists have no pages.
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();

        const menu = await openMenu(page, layout);
        await menu.getByRole('button', { name: 'SU listing' }).click();
        // The events have an "Organising" link too, in their own group, which stays closed.
        await menu.getByRole('link', { name: 'Organising' }).click();

        await expect(page).toHaveURL('/summeruniversity/organizing');
        await expect(page.getByRole('article', { name: 'Organised by me' })).toBeVisible();
        await expect(page.getByRole('article', { name: 'Applied 1', exact: true })).toHaveCount(0);
        expect(api.callsTo('GET summeruniversity /mine/organizing')).toHaveLength(1);
    });

    test('shows an error when the list can\'t be loaded', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.on('GET summeruniversity /', { status: 500, json: { success: false, message: DATABASE_DOWN } });

        await page.goto('/summeruniversity');

        await expect(toast(page, `Could not fetch events list: ${DATABASE_DOWN}`)).toBeVisible();
    });

    test('typing on drops the answer to the earlier search', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        let release: () => void = () => undefined;
        const later = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET summeruniversity /', async ({ query }) => {
            if (query.get('search') === 'm') {
                await later;
                return { json: ok([suEventFull({ name: 'Stale answer' })]) };
            }
            return { json: ok(query.get('search') === 'mo' ? [mountains()] : []) };
        });

        await page.goto('/summeruniversity');
        await expect(page.getByText('No events found.')).toBeVisible();
        const search = page.getByRole('textbox', { name: 'Search by name or description' });
        // The page gives the earlier search up, so its late answer can't arrive.
        const givenUp = page.waitForEvent('requestfailed', (request) => new URL(request.url()).searchParams.get('search') === 'm');
        await search.fill('m');
        await search.fill('mo');

        await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
        await givenUp;
        release();
        // No error for the earlier request (counted at once: a retrying matcher would only wait
        // until a toast has gone), and its answer is not shown.
        expect(await toast(page, 'Could not fetch events list').count()).toBe(0);
        await expect(page.getByRole('article', { name: 'Stale answer' })).toHaveCount(0);
    });

    test('a Summer University published as minimal has no "Apply", even while applications are open', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        api.json('GET summeruniversity /', ok([suEventMinimal({ name: 'Minimal Mountains', application_status: 'open' })]));

        await page.goto('/summeruniversity');
        const minimal = page.getByRole('article', { name: 'Minimal Mountains' });
        await expect(minimal.getByText('Applications open')).toBeVisible();
        await expect(minimal.getByRole('link', { name: 'Apply' })).toHaveCount(0);

        await page.getByText('Display classic list view').click();
        await expect(minimal.getByText('Applications are open!')).toBeVisible();
        await expect(minimal.getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    test.describe('while a request is still running', () => {
        test('a member who goes on to all events sees no error from the list they left', async ({ page, api, layout }) => {
            api.json('GET summeruniversity /seasons', ok([]));
            const list = held();
            api.on('GET summeruniversity /', async () => {
                await list.released;
                return { json: ok([mountains()]) };
            });
            api.fallback(mockEverything);

            const asked = page.waitForRequest(isTo('/summeruniversity'));
            await page.goto('/summeruniversity');
            const request = await asked;
            await goToAllEvents(page, layout);

            list.release();
            // The late answer, or nothing if the page gave the request up when the member left.
            await request.response();
            await settle(page);

            // Counted at once: a retrying matcher would only wait until a toast has gone.
            expect(await toast(page, /Could not fetch events list/).count()).toBe(0);
            await expect(page).toHaveURL('/events');
        });

        test('a member who leaves before the seasons have loaded is not followed by the list', async ({ page, api, layout }) => {
            const seasons = held();
            api.on('GET summeruniversity /seasons', async () => {
                await seasons.released;
                return { json: ok([suSeason({ year: 2027, active: true })]) };
            });
            api.fallback(mockEverything);

            const asked = page.waitForRequest(isTo('/summeruniversity/seasons'));
            await page.goto('/summeruniversity');
            await asked;
            await goToAllEvents(page, layout);

            const late = page.waitForResponse((response) => isTo('/summeruniversity/seasons')(response.request()));
            seasons.release();
            await late;
            await settle(page);

            // The list it left is not asked for any more.
            expect(api.callsTo('GET summeruniversity /')).toEqual([]);
            expect(await toast(page, /Could not fetch events list/).count()).toBe(0);
            await expect(page).toHaveURL('/events');
        });

        test('a member who leaves before the seasons have loaded sees no error for them', async ({ page, api, layout }) => {
            const seasons = held();
            api.on('GET summeruniversity /seasons', async () => {
                await seasons.released;
                return { status: 500, json: { success: false, message: DATABASE_DOWN } };
            });
            api.fallback(mockEverything);

            const asked = page.waitForRequest(isTo('/summeruniversity/seasons'));
            await page.goto('/summeruniversity');
            await asked;
            await goToAllEvents(page, layout);

            const late = page.waitForResponse((response) => isTo('/summeruniversity/seasons')(response.request()));
            seasons.release();
            await late;
            await settle(page);

            // Counted at once: a retrying matcher would only wait until a toast has gone.
            expect(await toast(page, /Could not fetch seasons/).count()).toBe(0);
            expect(api.callsTo('GET summeruniversity /')).toEqual([]);
            await expect(page).toHaveURL('/events');
        });

        test('a member who leaves while the permissions load sees no warning for them', async ({ page, api, layout, myPermissions }) => {
            api.json('GET summeruniversity /seasons', ok([]));
            api.json('GET summeruniversity /', ok([mountains()]));
            // The app asks for the permissions when it starts too: only the list's own request waits.
            const permissions = held();
            let calls = 0;
            api.on('GET core /my_permissions', async () => {
                calls += 1;
                if (calls !== 2) return { json: ok(myPermissions) };
                await permissions.released;
                return { status: 500, json: { success: false, message: DATABASE_DOWN } };
            });
            api.fallback(mockEverything);

            await page.goto('/summeruniversity');
            await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
            await expect.poll(() => calls).toBe(2);
            await goToAllEvents(page, layout);

            const late = page.waitForResponse((response) => isTo('/core/my_permissions')(response.request()) && response.status() === 500);
            permissions.release();
            await late;
            await settle(page);

            expect(await toast(page, /Could not fetch permissions/).count()).toBe(0);
            await expect(page).toHaveURL('/events');
        });

        test('the list keeps loading, and says nothing about "no events", while a later search runs', async ({ page, api }) => {
            api.json('GET summeruniversity /seasons', ok([]));
            const earlier = held();
            const later = held();
            api.on('GET summeruniversity /', async ({ query }) => {
                if (query.get('search') === 'm') {
                    await earlier.released;
                    return { json: ok([seaside()]) };
                }
                if (query.get('search') === 'mo') {
                    await later.released;
                    return { json: ok([mountains()]) };
                }
                return { json: ok([]) };
            });

            await page.goto('/summeruniversity');
            await expect(page.getByText('No events found.')).toBeVisible();
            const search = page.getByRole('textbox', { name: 'Search by name or description' });
            const givenUp = page.waitForEvent('requestfailed', (request) => new URL(request.url()).searchParams.get('search') === 'm');
            const asked = page.waitForRequest((request) => new URL(request.url()).searchParams.get('search') === 'mo');
            await search.fill('m');
            await search.fill('mo');
            await asked;
            await givenUp;
            await settle(page);

            // The search the page gave up doesn't end the loading of the one that runs.
            await expect(page.getByText('No events found.')).toBeHidden();
            await expect(page.getByRole('button', { name: 'Load more events' })).toBeDisabled();

            later.release();
            await expect(page.getByRole('article', { name: 'Mountains and Languages' })).toBeVisible();
            earlier.release();
        });
    });
});
