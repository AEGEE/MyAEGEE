// Second submission editor (/summeruniversity/:id/edit_second): the logo and the fields of an
// SU's second submission. Only reachable by its address.
import type { Page } from '@playwright/test';

import type { ApiMock, MockResponse } from '../support/api-mock.ts';
import { notFound, ok, unprocessable, validationError } from '../support/factories/base.ts';
import { member, memberSearchResult, permission, type Member } from '../support/factories/core.ts';
import {
    suctPermissions, suEvent, suLocation, suOrganizerPermissions, suSeason, type SuEvent, type SuPermissions
} from '../support/factories/summeruniversity.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const SEASONS = [suSeason({ year: 2027, name: 'Summer University 2027', active: true }), suSeason({ year: 2026, name: 'Summer University 2026', active: false })];
const NAMES: Record<number, [string, string]> = { 2: ['Alex', 'Member'], 7: ['Olga', 'Organiser'], 8: ['Ada', 'Lovelace'] };
const PNG = { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) };

const SECOND = suEvent({
    id: 31,
    url: 'lake-su',
    name: 'Lake SU',
    status: 'first approval',
    published: 'minimal',
    organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
    cooperation: [{ body_id: 4, body_name: 'AEGEE-Partner' }],
    organizers: [{ user_id: 2, role: 'main_coordinator' }, { user_id: 7, role: 'treasurer' }],
    locations: [suLocation({ name: 'Brussels', start: true, end: false }), suLocation({ name: 'Ghent', position: { lat: 51.05, lng: 3.72 }, start: false, end: true })]
});

// What core answers for an organiser, by user id. `/members/me` is the app's own request for the
// logged-in member, which the harness answers: it is left to that handler.
const organizerLookup = (api: ApiMock, me: Member | null, answer: (userId: number) => MockResponse = (userId) => {
    const [firstName, lastName] = NAMES[userId] ?? ['Unknown', 'Member'];
    return { json: ok(member({ id: userId, first_name: firstName, last_name: lastName })) };
}) => {
    api.on('GET core /members/:id', ({ params }) => (params.id === 'me' ? { json: ok(me) } : answer(Number(params.id))));
};

const showForm = (api: ApiMock, me: Member | null, su: SuEvent = SECOND, permissions: SuPermissions = suOrganizerPermissions(su.status)) => {
    api.json('GET summeruniversity /seasons', ok(SEASONS));
    api.json('GET summeruniversity /single/:id', ok(su, { permissions }));
    organizerLookup(api, me);
    // The map's style, as showMap() answers it, so the map doesn't fail to load in the tests that
    // are not about it.
    api.url('GET', 'https://api.maptiler.com/maps/basic/style.json*', {
        json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8e8e8' } }] },
        delayMs: 300
    }, { optional: 'the map asks for its style only once it starts, which a short test does not wait for' });
};

const answerSave = (api: ApiMock) => {
    api.on('PUT summeruniversity /single/:id', ({ body: sent }) => ({ json: ok(suEvent({ ...(sent as Partial<SuEvent>), id: 31 })) }));
    api.fallback(mockEverything);
};

// The row of a list field that holds `control`.
const rowWith = (page: Page, control: string) => page.getByRole('row').filter({ has: page.getByRole('textbox', { name: control, exact: true }) });

// The map's style (see ui/support/map.ts), answered a little late, so the map loads after the
// SU and centres on its locations.
const STYLE = 'https://api.maptiler.com/maps/basic/style.json*';
const showMap = (api: ApiMock) => {
    api.url('GET', STYLE, {
        json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8e8e8' } }] },
        delayMs: 300
    });
};

// Drags the map's only marker 100 pixels up. Mapbox adds the marker once the map has loaded
// and centred on the location; a drag before that would move the map instead.
const dragTheMarker = async (page: Page) => {
    const map = page.getByRole('region', { name: 'Map' });
    await map.scrollIntoViewIfNeeded();
    // eslint-disable-next-line no-restricted-syntax -- a Mapbox marker has no role or name; it is only an image on the map
    const marker = map.locator('.mapboxgl-marker');
    await expect(marker).toBeVisible();
    const box = await marker.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 100, { steps: 5 });
    await page.mouse.up();
};

const save = async (page: Page) => {
    await page.getByRole('button', { name: 'Save event' }).click();
};

const loaded = async (page: Page) => {
    await expect(page.getByRole('combobox', { name: 'Role of Olga Organiser' })).toBeVisible();
};

test.describe('Summer University second submission editor', () => {
    test('loads the SU with its organisers and saves it with PUT', async ({ page, api, me }) => {
        showForm(api, me);
        answerSave(api);
        await page.goto('/summeruniversity/lake-su/edit_second');

        await loaded(page);
        await expect(page.getByLabel('List of activities')).toHaveValue('Hiking, cooking, a city tour');
        await expect(page.getByLabel('Course level')).toHaveValue('beginner');
        await expect(page.getByLabel('Courses')).toHaveValue('Basic Spanish');
        await expect(page.getByLabel('Trainers')).toHaveValue('Two language trainers');
        await expect(page.getByLabel('Website')).toHaveValue('https://su.example.org');
        await expect(page.getByRole('textbox', { name: 'Social media link 1' })).toHaveValue('https://social.example.org/su');
        await expect(page.getByRole('textbox', { name: 'Photo link 1' })).toHaveValue('https://photos.example.org/su');
        await expect(page.getByLabel('Video')).toHaveValue('https://video.example.org/su');
        await expect(page.getByLabel('Confirmation needed')).toHaveValue('payment');
        await expect(page.getByLabel('Ideal participant')).toHaveValue('Somebody who likes walking');
        await expect(page.getByLabel('Special equipment needed')).toHaveValue('Walking shoes');
        await expect(page.getByRole('textbox', { name: 'Question 1' })).toHaveValue('Why this SU?');
        await expect(page.getByLabel('Link to preliminary budget')).toHaveValue('https://budget.example.org/su');
        await expect(page.getByLabel('Link to preliminary programme')).toHaveValue('https://programme.example.org/su');
        await expect(page.getByRole('radio', { name: 'Location 1 is the starting city' })).toBeChecked();
        await expect(page.getByRole('combobox', { name: 'Role of Alex Member' })).toHaveValue('main_coordinator');
        await expect(page.getByRole('button', { name: 'Delete Alex Member' })).toHaveCount(0);
        // Without its own permissions the organiser doesn't choose the type or the season.
        await expect(page.getByLabel('Event type')).toHaveCount(0);
        await expect(page.getByLabel('Season')).toHaveCount(0);

        await page.getByLabel('List of activities').fill('Hiking and sailing');
        await page.getByLabel('Course level').selectOption({ label: 'Intermediate' });
        await page.getByRole('checkbox', { name: 'Our SU has university support' }).uncheck();
        await save(page);

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/lake-su');
        const [call] = api.callsTo('PUT summeruniversity /single/:id');
        expect(call.params.id).toBe('lake-su');
        // The form sends the SU back as it got it, with the changes.
        expect(call.body).toMatchObject({
            id: 31,
            name: 'Lake SU',
            activities_list: 'Hiking and sailing',
            course_level: 'intermediate',
            university_support: false,
            organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
            locations: SECOND.locations
        });
        expect((call.body as SuEvent).organizers).toEqual([{ user_id: 2, role: 'main_coordinator' }, { user_id: 7, role: 'treasurer' }]);
    });

    test('the type and the season follow the permissions of the member', async ({ page, api, me, myPermissions }) => {
        myPermissions.push(permission('global:edit:su_type'), permission('global:manage_summeruniversity:regular'));
        showForm(api, me, { ...SECOND, season: 2026 });
        await page.goto('/summeruniversity/lake-su/edit_second');

        await expect(page.getByLabel('Event type')).toHaveValue('regular');
        await expect(page.getByLabel('Season')).toHaveValue('2026');
        await expect(page.getByLabel('Season').getByRole('option')).toHaveText(['Summer University 2027', 'Summer University 2026']);
        await page.getByLabel('Event type').selectOption({ label: 'Pilot SU' });
        await expect(page.getByLabel('Season')).toHaveCount(0);
    });

    test('uploads a new logo', async ({ page, api, me }) => {
        showForm(api, me);
        api.json('POST summeruniversity /single/:id/upload', { success: true, message: 'File uploaded successfully', data: 'logo.png' });
        await page.goto('/summeruniversity/lake-su/edit_second');

        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Upload!' })).toBeDisabled();
        await page.getByLabel(/Choose a file/).setInputFiles(PNG);
        await expect(page.getByText('logo.png')).toBeVisible();
        await page.getByRole('button', { name: 'Upload!' }).click();

        await expect(toast(page, 'Event image is updated.')).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Upload!' })).toBeDisabled();
        const [upload] = api.callsTo('POST summeruniversity /single/:id/upload');
        expect(upload.params.id).toBe('lake-su');
        expect(upload.parts).toEqual([{ name: 'head_image', filename: 'logo.png', contentType: 'image/png' }]);
    });

    test('a refused logo shows the service\'s message', async ({ page, api, me }) => {
        showForm(api, me);
        api.on('POST summeruniversity /single/:id/upload', { status: 422, json: unprocessable('Malformed file content.') });
        await page.goto('/summeruniversity/lake-su/edit_second');

        await page.getByLabel(/Choose a file/).setInputFiles(PNG);
        await page.getByRole('button', { name: 'Upload!' }).click();

        await expect(toast(page, 'Could not update image: Malformed file content.')).toBeVisible();
        await expect(page.getByText('logo.png')).toBeVisible();
    });

    const LIMITS: [string, string, string, string, number][] = [
        ['social media links', 'Social media link', 'Add social media link', 'No social media links are set.', 3],
        ['links to photos', 'Photo link', 'Add link to photo', 'No links to photos are set.', 6],
        ['questions', 'Question', 'Add question', 'No questions are set.', 3]
    ];
    for (const [what, control, add, none, limit] of LIMITS) {
        test(`${what}: at most ${limit}`, async ({ page, api, me }) => {
            showForm(api, me, { ...SECOND, social_media: [], photos: [], questions: [] });
            await page.goto('/summeruniversity/lake-su/edit_second');

            await expect(page.getByText(none)).toBeVisible();
            await page.getByRole('button', { name: add }).click();
            for (let count = 1; count < limit; count++) {
                await rowWith(page, `${control} ${count}`).getByRole('button', { name: add }).click();
            }
            await expect(page.getByRole('textbox', { name: new RegExp(`^${control} \\d$`) })).toHaveCount(limit);
            await expect(page.getByText(`At most ${limit} ${what} can be set.`)).toBeVisible();
            await expect(page.getByRole('button', { name: add })).toHaveCount(0);

            for (let count = limit; count > 0; count--) {
                await page.getByRole('button', { name: `Delete ${control.toLowerCase()} ${count}` }).click();
            }
            await expect(page.getByText(none)).toBeVisible();
        });
    }

    test('organisers are found in the SU\'s bodies and get a role', async ({ page, api, me }) => {
        showForm(api, me);
        api.json('GET core /members_search', ok([memberSearchResult({ id: 8, first_name: 'Ada', last_name: 'Lovelace' })]));
        answerSave(api);
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');
        await page.getByRole('main').getByRole('button', { name: 'Ada Lovelace', exact: true }).click();
        await page.getByRole('combobox', { name: 'Role of Ada Lovelace' }).selectOption({ label: 'Incoming responsible' });
        // Adding the same person again only warns.
        await page.getByRole('textbox', { name: 'Add organiser' }).fill('Love');
        await page.getByRole('main').getByRole('button', { name: 'Ada Lovelace', exact: true }).click();
        await expect(toast(page, 'This user is already an organiser.')).toBeVisible();
        await save(page);

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        expect(api.callsTo('GET core /members_search').map((call) => call.query.get('body_id'))).toEqual(['1,4', '1,4']);
        expect(api.callsTo('PUT summeruniversity /single/:id').map((call) => (call.body as SuEvent).organizers)).toEqual([[
            { user_id: 2, role: 'main_coordinator' }, { user_id: 7, role: 'treasurer' }, { user_id: 8, role: 'incoming_responsible' }
        ]]);
    });

    test('a failed organiser search shows the error', async ({ page, api, me }) => {
        showForm(api, me);
        api.on('GET core /members_search', { abort: 'failed' });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');

        await expect(toast(page, 'Could not fetch members: Network Error')).toBeVisible();
    });

    test('the organiser search needs a body', async ({ page, api, me }) => {
        showForm(api, me, { ...SECOND, organizing_bodies: [], cooperation: null });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');

        await expect(toast(page, 'Please add an organising body first.')).toBeVisible();
        expect(api.callsTo('GET core /members_search')).toHaveLength(0);
    });

    test('deleting an organiser doesn\'t save the SU', async ({ page, api, me }) => {
        showForm(api, me, {
            ...SECOND,
            organizers: [{ user_id: 7, role: 'treasurer' }, { user_id: 8, role: 'content_manager' }, { user_id: 2, role: 'main_coordinator' }]
        });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        // Not the last row: the button of the first row stays in the page for the next organiser.
        await page.getByRole('button', { name: 'Delete Olga Organiser' }).click();

        await expect(page.getByRole('combobox', { name: 'Role of Olga Organiser' })).toHaveCount(0);
        await expect(page.getByRole('combobox', { name: 'Role of Ada Lovelace' })).toHaveValue('content_manager');
        await expect(page).toHaveURL('/summeruniversity/lake-su/edit_second');
        expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
    });

    test('adding and deleting locations doesn\'t save the SU', async ({ page, api, me }) => {
        showForm(api, me);
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await page.getByRole('button', { name: 'Add new location' }).click();
        await expect(page.getByRole('textbox', { name: 'Location 3 name' })).toHaveValue('');
        await page.getByRole('textbox', { name: 'Location 3 name' }).fill('Antwerp');
        await page.getByRole('button', { name: 'Delete location 1' }).click();

        await expect(page.getByRole('textbox', { name: 'Location 1 name' })).toHaveValue('Ghent');
        await expect(page.getByRole('textbox', { name: 'Location 2 name' })).toHaveValue('Antwerp');
        await expect(page.getByRole('textbox', { name: 'Location 3 name' })).toHaveCount(0);
        await expect(page).toHaveURL('/summeruniversity/lake-su/edit_second');
        expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
    });

    test('only one location is the starting city and only one the ending city', async ({ page, api, me }) => {
        showForm(api, me);
        answerSave(api);
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await page.getByRole('radio', { name: 'Location 2 is the starting city' }).check();
        await page.getByRole('radio', { name: 'Location 1 is the ending city' }).check();
        await save(page);

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        const [call] = api.callsTo('PUT summeruniversity /single/:id');
        expect((call.body as SuEvent).locations.map((location) => [location.name, location.start === true, location.end === true])).toEqual([
            ['Brussels', false, true],
            ['Ghent', true, false]
        ]);
    });

    test('an organiser\'s body is kept when saving', async ({ page, api, me }) => {
        showForm(api, me, { ...SECOND, organizers: [{ user_id: 2, role: 'main_coordinator', body_id: 1 }, { user_id: 7, role: 'treasurer' }] });
        answerSave(api);
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await save(page);

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id').map((call) => (call.body as SuEvent).organizers))
            .toEqual([[{ user_id: 2, role: 'main_coordinator', body_id: 1 }, { user_id: 7, role: 'treasurer' }]]);
    });

    test('an organiser whose name can\'t be fetched stays in the list', async ({ page, api, me }) => {
        showForm(api, me);
        organizerLookup(api, me, (userId) => (userId === 7
            ? { status: 404, json: notFound('User is not found.') }
            : { json: ok(member({ id: userId, first_name: 'Alex', last_name: 'Member' })) }));
        await page.goto('/summeruniversity/lake-su/edit_second');

        await expect(toast(page, 'Could not fetch an organiser: User is not found.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Member 7' })).toHaveAttribute('href', '/members/7');
        await expect(page.getByRole('combobox', { name: 'Role of Member 7' })).toHaveValue('treasurer');
    });

    test('SUCT can remove every organiser, and the form says one is needed', async ({ page, api, me }) => {
        showForm(api, me, { ...SECOND, organizers: [{ user_id: 7, role: 'treasurer' }] }, suctPermissions('first approval'));
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await page.getByRole('button', { name: 'Delete Olga Organiser' }).click();
        await save(page);

        await expect(toast(page, 'Please add at least one organiser.')).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
    });

    test('the browser requires the fields of the second submission', async ({ page, api, me }) => {
        showForm(api, me, {
            ...SECOND, activities_list: null, course_level: null, trainers: null, pax_description: null, budget: null, programme_suct: ''
        });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await save(page);

        for (const field of ['List of activities', 'Course level', 'Trainers', 'Ideal participant', 'Link to preliminary budget', 'Link to preliminary programme']) {
            expect(await page.getByLabel(field).evaluate((input: HTMLInputElement) => input.validity.valueMissing), field).toBe(true);
        }
        expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
    });

    test('the service\'s validation errors show under each field', async ({ page, api, me, myPermissions }) => {
        myPermissions.push(permission('global:edit:su_type'), permission('global:manage_summeruniversity:regular'));
        showForm(api, me);
        const TEXT = 'The value should be a text.';
        const LINK = 'The link should be a valid URL starting with http:// or https://.';
        // Every field the form shows a message for, at once.
        const errors = {
            type: ['SU type should be one of these: regular, pilot.'],
            season: ['Season should be a year.'],
            university_support: ['The value should be true or false.'],
            activities_list: [TEXT],
            course_level: ['SU course level should be one of these: beginner, intermediate, advanced.'],
            courses: [TEXT],
            trainers: [TEXT],
            website: [LINK],
            social_media: ['Every social media entry should have a link.'],
            photos: ['Photos should be a list.'],
            video: ['This text should be at most 255 characters long.'],
            organizers: ['Organizers should be members of one of the organizing or cooperation bodies (user ID 8).'],
            organizing_bodies: ['These bodies do not exist: 99.'],
            cooperation: ['These bodies do not exist: 98.'],
            application_ends: ['Application period cannot end before or at the same time the event starts.'],
            pax_confirmation: ['Pax confirmation should be one of these: no_confirmation, payment, ticket, payment_or_ticket, payment_and_ticket.'],
            pax_description: [TEXT],
            special_equipment: [TEXT],
            questions: ['Every question should have a description.'],
            budget: [LINK],
            programme_suct: ['The programme for SUCT should be set.']
        };
        api.on('PUT summeruniversity /single/:id', { status: 422, json: validationError(errors) });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);
        await save(page);

        await expect(toast(page, 'Some of the event data is invalid.')).toBeVisible();
        const once = Object.values(errors).flat().filter((message) => message !== TEXT && message !== LINK);
        expect(once).toHaveLength(14);
        for (const message of once) {
            await expect(page.getByText(message, { exact: true })).toBeVisible();
        }
        await expect(page.getByText(TEXT, { exact: true })).toHaveCount(5);
        await expect(page.getByText(LINK, { exact: true })).toHaveCount(2);
        await expect(page.getByRole('button', { name: 'Save event' })).toBeEnabled();
    });

    test('other save errors show the message', async ({ page, api, me }) => {
        showForm(api, me);
        api.on('PUT summeruniversity /single/:id', { status: 403, json: { success: false, message: 'You cannot edit this event' } });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);
        await save(page);

        await expect(toast(page, 'Could not save event: You cannot edit this event')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/lake-su/edit_second');
    });

    test('a failed seasons request shows an error and the form still loads', async ({ page, api, me }) => {
        api.on('GET summeruniversity /seasons', { abort: 'failed' });
        api.json('GET summeruniversity /single/:id', ok(SECOND, { permissions: suOrganizerPermissions('first approval') }));
        organizerLookup(api, me);
        showMap(api);
        await page.goto('/summeruniversity/lake-su/edit_second');

        await expect(toast(page, 'Could not fetch seasons: Network Error')).toBeVisible();
        await loaded(page);
    });

    test('an unknown SU goes back to the list', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /single/:id', { status: 404, json: notFound('Event with id nowhere not found') });
        api.fallback(mockEverything);
        await page.goto('/summeruniversity/nowhere/edit_second');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('another loading error goes back to the list with the message', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /single/:id', { status: 403, json: { success: false, message: 'You cannot see this event.' } });
        api.fallback(mockEverything);
        await page.goto('/summeruniversity/lake-su/edit_second');

        await expect(toast(page, 'Some error happened: You cannot see this event.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('the map centres on the only location, and dragging its marker moves it', async ({ page, api, me }) => {
        showMap(api);
        showForm(api, me, { ...SECOND, locations: [suLocation({ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } })] });
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);
        await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);

        const row = rowWith(page, 'Location 1 name');
        await expect(row).toContainText(/^50\.85\s*4\.35/);
        await dragTheMarker(page);
        // Up is north: the latitude grows, the longitude stays (give or take the float).
        await expect(row).toContainText(/^50\.(8[6-9]|9)\d*\s*4\.3[45]\d*/);
    });

    test('the map shows every location', async ({ page, api, me }) => {
        showMap(api);
        showForm(api, me);
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);
    });

    test('the map of an SU without locations stays where it is', async ({ page, api, me }) => {
        showMap(api);
        showForm(api, me, { ...SECOND, locations: [] });
        await page.goto('/summeruniversity/lake-su/edit_second');

        await expect(page.getByText('No locations added.')).toBeVisible();
        await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);
    });

    test('typing on drops the earlier organiser search', async ({ page, api, me }) => {
        showForm(api, me);
        api.on('GET core /members_search', ({ query }) => (query.get('query') === 'Lo'
            ? { json: ok([memberSearchResult({ id: 9, first_name: 'Lo', last_name: 'Late' })]), delayMs: 1500 }
            : { json: ok([memberSearchResult({ id: 8, first_name: 'Ada', last_name: 'Lovelace' })]) }));
        await page.goto('/summeruniversity/lake-su/edit_second');
        await loaded(page);

        // The page gives the earlier search up, so its late answer can't arrive.
        const givenUp = page.waitForEvent('requestfailed', (request) => new URL(request.url()).searchParams.get('query') === 'Lo');
        await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lo');
        await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');

        await expect(page.getByRole('main').getByRole('button', { name: 'Ada Lovelace', exact: true })).toBeVisible();
        await givenUp;
        expect(api.callsTo('GET core /members_search').map((call) => call.query.get('query')).sort()).toEqual(['Lo', 'Lov']);
        // Counted at once: a retrying matcher would only wait until a toast has gone.
        expect(await toast(page, 'Could not fetch members').count()).toBe(0);
        await expect(page.getByRole('main').getByRole('button', { name: 'Lo Late' })).toHaveCount(0);
    });
});
