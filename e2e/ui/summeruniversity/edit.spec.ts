// Summer University editor (/summeruniversity/new and /summeruniversity/:id/edit).
import type { Page } from '@playwright/test';

import type { ApiMock, MockResponse } from '../support/api-mock.ts';
import { notFound, ok, validationError } from '../support/factories/base.ts';
import { body, member, memberSearchResult, permission, type Member } from '../support/factories/core.ts';
import {
    suctPermissions, suEvent, suLocation, suOrganizerPermissions, suSeason, type SuEvent, type SuPermissions
} from '../support/factories/summeruniversity.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { fillDate, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const BODIES = [body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 4, name: 'AEGEE-Partner' }), body({ id: 5, name: 'AEGEE-Third' })];
const SEASONS = [suSeason({ year: 2027, name: 'Summer University 2027', active: true }), suSeason({ year: 2026, name: 'Summer University 2026', active: false })];

// Names core gives for the organisers' user ids.
const NAMES: Record<number, [string, string]> = { 2: ['Alex', 'Member'], 7: ['Olga', 'Organiser'], 8: ['Ada', 'Lovelace'] };

// What both forms ask for when they open.
const showForm = (api: ApiMock) => {
    api.json('GET summeruniversity /seasons', ok(SEASONS));
    api.json('GET core /bodies', ok(BODIES));
};

const EDITED = suEvent({
    id: 30,
    url: 'mountain-su',
    name: 'Mountain SU',
    status: 'first draft',
    published: 'none',
    // 08:00 UTC is 10:00 in Brussels in summer.
    starts: '2027-07-01T08:00:00.000Z',
    ends: '2027-07-14T16:00:00.000Z',
    organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
    cooperation: [{ body_id: 4, body_name: 'AEGEE-Partner' }],
    organizers: [{ user_id: 2, role: 'main_coordinator' }, { user_id: 7, role: 'treasurer' }],
    learning_objectives: [{ name: '', description: 'Speak a new language' }, { name: '', description: 'Hike safely' }],
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

// The edit form of `su`, with the organisers' names from core.
const showEdit = (api: ApiMock, me: Member | null, su: SuEvent = EDITED, permissions: SuPermissions = suOrganizerPermissions(su.status)) => {
    showForm(api);
    api.json('GET summeruniversity /single/:id', ok(su, { permissions }));
    organizerLookup(api, me);
};

// An option of the organiser search.
const option = (page: Page, name: string) => page.getByRole('main').getByRole('button', { name, exact: true });

// The answer of a successful save, and the SU's page it opens.
const answerSave = (api: ApiMock, route: 'POST summeruniversity /' | 'PUT summeruniversity /single/:id') => {
    api.on(route, ({ body: sent }) => ({
        status: route.startsWith('POST') ? 201 : 200,
        json: { success: true, message: 'Event successfully created', data: suEvent({ ...(sent as Partial<SuEvent>), id: 30 }) }
    }));
    api.fallback(mockEverything);
};

// The row of a list field (learning objectives, links, questions, locations) that holds `control`.
const rowWith = (page: Page, control: string) => page.getByRole('row').filter({ has: page.getByRole('textbox', { name: control, exact: true }) });

// Fills what the browser requires of a new SU, its end and an organising body.
const fillRequired = async (page: Page, { ends = true } = {}) => {
    await page.getByLabel('Title').fill('Mountain Summer University');
    await page.getByLabel(/^Description/).fill('Two weeks in the **mountains**.');
    await fillDate(page.getByLabel('Event start date'), '2027-07-01 10:00');
    if (ends) await fillDate(page.getByLabel('Event end date'), '2027-07-14 18:00');
    await page.getByLabel(/^Fee/).fill('150');
    await page.getByLabel('Email').fill('mountain@example.org');
    await page.getByLabel('Accommodation type').fill('Hostel');
    await page.getByLabel('Theme (including explanation)').fill('Mountains and languages');
    await page.getByLabel('Theme implementation').fill('Every day starts with a walk.');
    await page.getByLabel('List of activities').fill('Hiking, cooking');
    await page.getByLabel('Payment and cancellation rules').fill('No refunds after June');
    await page.getByLabel('SU specific regulations').fill('No smoking');
    await page.getByLabel('Link to preliminary programme').fill('https://programme.example.org/su');
    await page.getByRole('checkbox', { name: /I agree with the general SU terms/ }).check();
    await page.getByRole('combobox', { name: 'Add organising body' }).selectOption({ label: 'AEGEE-Antenna' });
    await page.getByRole('button', { name: 'Add organising body' }).click();
};

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

test.describe('Summer University editor', () => {
    test.describe('creating', () => {
        test('shows the notes, the creator as organiser and a URL from the title', async ({ page, api }) => {
            showForm(api);
            showMap(api);
            await page.goto('/summeruniversity/new');
            await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);

            await expect(page.getByText('If you want to upload an image, please do it from the event page after creating the event.')).toBeVisible();
            await expect(page.getByRole('link', { name: 'booklets' })).toHaveAttribute('target', '_blank');
            await expect(page.getByRole('link', { name: 'SUCT', exact: true })).toHaveAttribute('href', 'mailto:suct@aegee.eu');
            await expect(page.getByText('Event URL is the "short name of the event"')).toBeVisible();

            // The creator is an organiser who can't be removed.
            await expect(page.getByRole('link', { name: 'Alex Member' })).toHaveAttribute('href', '/members/2');
            await expect(page.getByRole('combobox', { name: 'Role of Alex Member' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Delete Alex Member' })).toHaveCount(0);

            await page.getByLabel('Title').fill('Mountain Summer University 2027');
            await expect(page.getByLabel('Event URL')).toHaveValue('mountain-summer-university-2027');

            // Without its own permissions the member doesn't choose the type or the season.
            await expect(page.getByLabel('Event type')).toHaveCount(0);
            await expect(page.getByLabel('Season')).toHaveCount(0);
            await expect(page.getByText('No organizing bodies.')).toBeVisible();
            await expect(page.getByText('No cooperation with bodies.')).toBeVisible();
            await expect(page.getByText('No locations added.')).toBeVisible();
        });

        test('sends every field and opens the new SU', async ({ page, api }) => {
            showForm(api);
            api.json('GET core /members_search', ok([memberSearchResult({ id: 8, first_name: 'Ada', last_name: 'Lovelace' })]));
            answerSave(api, 'POST summeruniversity /');
            await page.goto('/summeruniversity/new');

            await fillRequired(page);
            await page.getByLabel('Max. participants').fill('25');
            await page.getByRole('checkbox', { name: 'Our SU has university support' }).check();
            await page.getByLabel('Theme category').selectOption({ label: 'Leisure' });
            await page.getByRole('button', { name: 'Add learning objective' }).click();
            await page.getByRole('textbox', { name: 'Learning objective 1' }).fill('Speak a new language');
            await rowWith(page, 'Learning objective 1').getByRole('button', { name: 'Add learning objective' }).click();
            await page.getByRole('textbox', { name: 'Learning objective 2' }).fill('Hike safely');
            await page.getByLabel('Trainers').fill('Two language trainers');
            await page.getByLabel('Optional Fee').fill('20');
            await page.getByLabel('Optional Programme').fill('A day at the sea');
            await page.getByLabel('Website').fill('https://su.example.org');
            await page.getByRole('button', { name: 'Add social media link' }).click();
            await page.getByRole('textbox', { name: 'Social media link 1' }).fill('https://social.example.org/su');
            await page.getByRole('button', { name: 'Add link to photo' }).click();
            await page.getByRole('textbox', { name: 'Photo link 1' }).fill('https://photos.example.org/su');
            await page.getByLabel('Video').fill('https://video.example.org/su');
            await page.getByRole('combobox', { name: 'Add cooperation' }).selectOption({ label: 'AEGEE-Partner' });
            await page.getByRole('button', { name: 'Add cooperation body' }).click();

            await page.getByRole('combobox', { name: 'Role of Alex Member' }).selectOption({ label: 'Main coordinator' });
            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');
            await option(page, 'Ada Lovelace').click();
            await page.getByRole('combobox', { name: 'Role of Ada Lovelace' }).selectOption({ label: 'Treasurer' });

            await page.getByRole('button', { name: 'Add new location' }).click();
            await page.getByRole('button', { name: 'Add new location' }).click();
            await page.getByRole('textbox', { name: 'Location 1 name' }).fill('Brussels');
            await page.getByRole('textbox', { name: 'Location 1 description' }).fill('Where we meet');
            await page.getByRole('textbox', { name: 'Location 2 name' }).fill('Ghent');
            await page.getByRole('radio', { name: 'Location 1 is the starting city' }).check();
            await page.getByRole('radio', { name: 'Location 2 is the ending city' }).check();

            await page.getByLabel('Confirmation needed').selectOption({ label: 'Payment' });
            await page.getByLabel('Ideal participant').fill('Somebody who likes walking');
            await page.getByLabel('Special equipment needed').fill('Walking shoes');
            await page.getByRole('button', { name: 'Add question' }).click();
            await page.getByRole('textbox', { name: 'Question 1' }).fill('Why this SU?');
            await page.getByLabel('Link to preliminary budget').fill('https://budget.example.org/su');
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            await expect(page).toHaveURL('/summeruniversity/mountain-summer-university');
            const centre = { lat: 50.8503396, lng: 4.3517103 };
            expect(api.callsTo('POST summeruniversity /').map((call) => call.body)).toEqual([{
                id: null,
                name: 'Mountain Summer University',
                url: 'mountain-summer-university',
                image: null,
                photos: [{ name: '', description: 'https://photos.example.org/su' }],
                video: 'https://video.example.org/su',
                description: 'Two weeks in the **mountains**.',
                email: 'mountain@example.org',
                website: 'https://su.example.org',
                social_media: [{ name: '', description: 'https://social.example.org/su' }],
                starts: '2027-07-01T08:00:00.000Z',
                ends: '2027-07-14T16:00:00.000Z',
                fee: '150',
                optional_fee: '20',
                organizing_bodies: [{ body_id: 1 }],
                cooperation: [{ body_id: 4 }],
                locations: [
                    { name: 'Brussels', description: 'Where we meet', position: centre, start: true },
                    { name: 'Ghent', description: '', position: centre, end: true }
                ],
                theme_category: 'leisure',
                theme: 'Mountains and languages',
                theme_implementation: 'Every day starts with a walk.',
                learning_objectives: [{ name: '', description: 'Speak a new language' }, { name: '', description: 'Hike safely' }],
                questions: [{ name: '', description: 'Why this SU?', required: false }],
                organizers: [{ user_id: 2, role: 'main_coordinator' }, { user_id: 8, role: 'treasurer' }],
                max_participants: '25',
                budget: 'https://budget.example.org/su',
                programme_suct: 'https://programme.example.org/su',
                activities_list: 'Hiking, cooking',
                optional_programme: 'A day at the sea',
                accommodation_type: 'Hostel',
                university_support: true,
                course_level: null,
                courses: null,
                trainers: 'Two language trainers',
                pax_confirmation: 'payment',
                pax_description: 'Somebody who likes walking',
                special_equipment: 'Walking shoes',
                cancellation_rules: 'No refunds after June',
                additional_regulation: 'No smoking',
                agreed_to_su_terms: true
            }]);
        });

        test('the event type can only be chosen with the permission to change it', async ({ page, api, myPermissions }) => {
            myPermissions.push(permission('global:edit:su_type'));
            showForm(api);
            answerSave(api, 'POST summeruniversity /');
            await page.goto('/summeruniversity/new');

            const type = page.getByLabel('Event type');
            await expect(type.getByRole('option')).toHaveText(['Regular SU', 'Pilot SU']);
            await type.selectOption({ label: 'Pilot SU' });
            await fillRequired(page);
            await page.getByRole('combobox', { name: 'Role of Alex Member' }).selectOption({ label: 'Main coordinator' });
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            expect(api.callsTo('POST summeruniversity /').map((call) => (call.body as SuEvent).type)).toEqual(['pilot']);
        });

        test('the season can only be chosen by managers of the SU\'s type', async ({ page, api, myPermissions }) => {
            myPermissions.push(permission('global:edit:su_type'), permission('global:manage_summeruniversity:regular'));
            showForm(api);
            answerSave(api, 'POST summeruniversity /');
            await page.goto('/summeruniversity/new');

            // A new SU is regular until another type is chosen.
            const season = page.getByLabel('Season');
            await expect(season.getByRole('option')).toHaveText(['Summer University 2027', 'Summer University 2026']);
            await page.getByLabel('Event type').selectOption({ label: 'Pilot SU' });
            await expect(season).toHaveCount(0);
            await page.getByLabel('Event type').selectOption({ label: 'Regular SU' });
            await season.selectOption({ label: 'Summer University 2026' });

            await fillRequired(page);
            await page.getByRole('combobox', { name: 'Role of Alex Member' }).selectOption({ label: 'Main coordinator' });
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            expect(api.callsTo('POST summeruniversity /').map((call) => (call.body as SuEvent).season)).toEqual([2026]);
        });

        test('learning objectives: at least 2, at most 5', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await expect(page.getByText('No learning objectives are set.')).toBeVisible();
            await page.getByRole('button', { name: 'Add learning objective' }).click();
            await expect(page.getByText('At least 2 learning objectives have to be set.')).toBeVisible();
            await expect(page.getByText('No learning objectives are set.')).toHaveCount(0);

            for (const count of [1, 2, 3, 4]) {
                await rowWith(page, `Learning objective ${count}`).getByRole('button', { name: 'Add learning objective' }).click();
            }
            await expect(page.getByRole('textbox', { name: /^Learning objective \d$/ })).toHaveCount(5);
            await expect(page.getByText('At most 5 learning objectives can be set.')).toBeVisible();
            await expect(page.getByText('At least 2 learning objectives have to be set.')).toHaveCount(0);
            await expect(rowWith(page, 'Learning objective 5').getByRole('button', { name: 'Add learning objective' })).toHaveCount(0);

            await page.getByRole('textbox', { name: 'Learning objective 2' }).fill('The second one');
            await page.getByRole('button', { name: 'Delete learning objective 1' }).click();
            await expect(page.getByRole('textbox', { name: /^Learning objective \d$/ })).toHaveCount(4);
            await expect(page.getByRole('textbox', { name: 'Learning objective 1' })).toHaveValue('The second one');
            await expect(page.getByText('At most 5 learning objectives can be set.')).toHaveCount(0);
            await expect(rowWith(page, 'Learning objective 4').getByRole('button', { name: 'Add learning objective' })).toBeVisible();
        });

        const LIMITS: [string, string, string, string, number][] = [
            ['social media links', 'Social media link', 'Add social media link', 'No social media links are set.', 3],
            ['links to photos', 'Photo link', 'Add link to photo', 'No links to photos are set.', 6],
            ['questions', 'Question', 'Add question', 'No questions are set.', 3]
        ];
        for (const [what, control, add, none, limit] of LIMITS) {
            test(`${what}: at most ${limit}`, async ({ page, api }) => {
                showForm(api);
                await page.goto('/summeruniversity/new');

                await expect(page.getByText(none)).toBeVisible();
                await page.getByRole('button', { name: add }).click();
                await expect(page.getByText(none)).toHaveCount(0);
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
                await expect(page.getByText(`At most ${limit} ${what} can be set.`)).toHaveCount(0);
            });
        }

        test('adding organising bodies warns when none is chosen or it is already there', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await page.getByRole('button', { name: 'Add organising body' }).click();
            await expect(toast(page, 'Please select a body.')).toBeVisible();

            const organising = page.getByRole('combobox', { name: 'Add organising body' });
            await organising.selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Add organising body' }).click();
            await expect(page.getByText('No organizing bodies.')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Antenna' })).toBeVisible();
            // The select is reset after adding.
            await expect(organising.getByRole('option', { selected: true })).toHaveText('--');
            await organising.selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Add organising body' }).click();
            await expect(toast(page, 'This body is already presented in the organizing bodies list.')).toBeVisible();

            await page.getByRole('button', { name: 'Remove AEGEE-Antenna' }).click();
            await expect(page.getByText('No organizing bodies.')).toBeVisible();
        });

        test('adding cooperation bodies warns when none is chosen or it is already there', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await page.getByRole('button', { name: 'Add cooperation body' }).click();
            await expect(toast(page, 'Please select a body.')).toBeVisible();
            const cooperation = page.getByRole('combobox', { name: 'Add cooperation' });
            await cooperation.selectOption({ label: 'AEGEE-Partner' });
            await page.getByRole('button', { name: 'Add cooperation body' }).click();
            await expect(page.getByText('No cooperation with bodies.')).toHaveCount(0);
            await cooperation.selectOption({ label: 'AEGEE-Partner' });
            await page.getByRole('button', { name: 'Add cooperation body' }).click();
            await expect(toast(page, 'This body is already presented in the cooperation list.')).toBeVisible();

            await page.getByRole('button', { name: 'Remove AEGEE-Partner' }).click();
            await expect(page.getByText('No cooperation with bodies.')).toBeVisible();
        });

        test('the organiser search covers the organising and the cooperation bodies', async ({ page, api }) => {
            showForm(api);
            api.json('GET core /members_search', ok([memberSearchResult({ id: 8, first_name: 'Ada', last_name: 'Lovelace' })]));
            await page.goto('/summeruniversity/new');

            for (const [select, button, name] of [['Add organising body', 'Add organising body', 'AEGEE-Antenna'], ['Add cooperation', 'Add cooperation body', 'AEGEE-Partner']]) {
                await page.getByRole('combobox', { name: select }).selectOption({ label: name });
                await page.getByRole('button', { name: button }).click();
            }
            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');
            await option(page, 'Ada Lovelace').click();

            await expect(page.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', '/members/8');
            await expect(page.getByRole('button', { name: 'Delete Ada Lovelace' })).toBeVisible();
            expect(api.callsTo('GET core /members_search').map((call) => call.query.toString())).toEqual(['query=Lov&body_id=1%2C4']);
        });

        test('the organiser search needs a body first, and says when it fails', async ({ page, api }) => {
            showForm(api);
            api.on('GET core /members_search', { abort: 'failed' });
            await page.goto('/summeruniversity/new');

            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');
            await expect(toast(page, 'Please add an organising body first.')).toBeVisible();

            await page.getByRole('combobox', { name: 'Add organising body' }).selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Add organising body' }).click();
            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Love');
            await expect(toast(page, 'Could not fetch members: Network Error')).toBeVisible();
            expect(api.callsTo('GET core /members_search')).toHaveLength(1);
        });

        test('adding someone who is an organiser already warns', async ({ page, api }) => {
            showForm(api);
            api.json('GET core /members_search', ok([memberSearchResult({ id: 2, first_name: 'Alex', last_name: 'Member' })]));
            await page.goto('/summeruniversity/new');

            await page.getByRole('combobox', { name: 'Add organising body' }).selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Add organising body' }).click();
            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Alex');
            await option(page, 'Alex Member').click();

            await expect(toast(page, 'This user is already an organiser.')).toBeVisible();
            await expect(page.getByRole('combobox', { name: /^Role of / })).toHaveCount(1);
        });

        test('checks the end date and the organising bodies before sending', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await fillRequired(page, { ends: false });
            await page.getByRole('button', { name: 'Remove AEGEE-Antenna' }).click();
            await save(page);
            await expect(toast(page, 'Please set the date when the event will end.')).toBeVisible();

            await fillDate(page.getByLabel('Event end date'), '2027-07-14 18:00');
            await save(page);
            await expect(toast(page, 'Please select at least one organising body.')).toBeVisible();
            expect(api.callsTo('POST summeruniversity /')).toHaveLength(0);
        });

        test('the programme link and the SU terms are required', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await fillRequired(page);
            await page.getByLabel('Link to preliminary programme').fill('');
            await save(page);
            expect(await page.getByLabel('Link to preliminary programme').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

            await page.getByLabel('Link to preliminary programme').fill('https://programme.example.org/su');
            await page.getByRole('checkbox', { name: /I agree with the general SU terms/ }).uncheck();
            await save(page);
            expect(await page.getByRole('checkbox', { name: /I agree with the general SU terms/ }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
            expect(api.callsTo('POST summeruniversity /')).toHaveLength(0);
        });

        test('the email is required', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await fillRequired(page);
            await page.getByLabel('Email').fill('');
            await save(page);

            expect(await page.getByLabel('Email').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
            expect(api.callsTo('POST summeruniversity /')).toHaveLength(0);
        });

        test('the description preview renders markdown', async ({ page, api }) => {
            showForm(api);
            await page.goto('/summeruniversity/new');

            await page.getByLabel(/^Description/).fill('Two weeks in the **mountains**.');

            await expect(page.getByText('mountains', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        });

        test('the service\'s validation errors show under each field', async ({ page, api, myPermissions }) => {
            myPermissions.push(permission('global:edit:su_type'), permission('global:manage_summeruniversity:regular'));
            showForm(api);
            const TEXT = 'The value should be a text.';
            const LINK = 'The link should be a valid URL starting with http:// or https://.';
            // Every field the form shows a message for, at once.
            const errors = {
                name: ['Event name should be set.'],
                description: ['Event description should be set.'],
                url: ['Event URL should have at least 1 letter.'],
                type: ['SU type should be one of these: regular, pilot.'],
                season: ['Season should be a year.'],
                starts: ['Event start date should be valid.'],
                application_ends: ['Application period cannot end before or at the same time the event starts.'],
                ends: ['Event cannot start after or at the same time it ends.'],
                fee: ['Event fee cannot be negative'],
                max_participants: ['Max amount of participants cannot be negative'],
                accommodation_type: ['The type of accommodation should be set.'],
                university_support: ['The value should be true or false.'],
                theme_category: ['Theme should be one of these: arts_creativity, sustainability, local_culture, sports, social_equity, political_activism, mental_health, leisure, personal_development, volunteering.'],
                theme: ['Theme explanation should be set.'],
                theme_implementation: ['Explanation of theme implementation should be set.'],
                learning_objectives: ['Learning objectives should be set.'],
                activities_list: [TEXT],
                trainers: [TEXT],
                optional_fee: ['Optional fee cannot be more than 50 euros.'],
                optional_programme: [TEXT],
                email: ['Given email is not valid.'],
                website: [LINK],
                social_media: ['Every social media entry should have a link.'],
                photos: ['Photos should be a list.'],
                video: ['This text should be at most 255 characters long.'],
                organizing_bodies: ['These bodies do not exist: 99.'],
                cooperation: ['These bodies do not exist: 98.'],
                organizers: ['Organizers should be members of one of the organizing or cooperation bodies (user ID 8).'],
                pax_confirmation: ['Pax confirmation should be one of these: no_confirmation, payment, ticket, payment_or_ticket, payment_and_ticket.'],
                pax_description: [TEXT],
                special_equipment: [TEXT],
                questions: ['Every question should have a description.'],
                cancellation_rules: [TEXT],
                additional_regulation: [TEXT],
                budget: [LINK],
                programme_suct: ['The programme for SUCT should be set.'],
                agreed_to_su_terms: ['You should agree to the SU terms.']
            };
            api.on('POST summeruniversity /', { status: 422, json: validationError(errors) });
            await page.goto('/summeruniversity/new');

            await fillRequired(page);
            await page.getByRole('combobox', { name: 'Role of Alex Member' }).selectOption({ label: 'Main coordinator' });
            await save(page);

            await expect(toast(page, 'Some of the event data is invalid.')).toBeVisible();
            const once = Object.values(errors).flat().filter((message) => message !== TEXT && message !== LINK);
            expect(once).toHaveLength(28);
            for (const message of once) {
                await expect(page.getByText(message, { exact: true })).toBeVisible();
            }
            await expect(page.getByText(TEXT, { exact: true })).toHaveCount(7);
            await expect(page.getByText(LINK, { exact: true })).toHaveCount(2);
            await expect(page).toHaveURL('/summeruniversity/new');
            await expect(page.getByRole('button', { name: 'Save event' })).toBeEnabled();
        });

        test('a refused SU shows the service\'s message', async ({ page, api }) => {
            showForm(api);
            api.on('POST summeruniversity /', { status: 403, json: { success: false, message: 'You are not allowed to create summer university events.' } });
            await page.goto('/summeruniversity/new');

            await fillRequired(page);
            await save(page);

            await expect(toast(page, 'Could not save event: You are not allowed to create summer university events.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Save event' })).toBeEnabled();
        });

        test('a body the service can\'t read shows its message', async ({ page, api }) => {
            showForm(api);
            // What summeruniversity answers for a text with the character U+0000 in it.
            api.on('POST summeruniversity /', ({ raw }) => (raw?.toString().includes('\\u0000')
                ? { status: 400, json: { success: false, message: 'The body should not contain the character U+0000.' } }
                : { status: 413, json: { success: false, message: 'The request body could not be read.' } }));
            await page.goto('/summeruniversity/new');

            await fillRequired(page);
            await page.getByLabel('Theme (including explanation)').fill('Mountains\u0000');
            await save(page);
            await expect(toast(page, 'Could not save event: The body should not contain the character U+0000.')).toBeVisible();

            // More than the 1 MB the service reads.
            await page.getByLabel('Theme (including explanation)').fill('x'.repeat(1024 * 1024));
            await save(page);
            await expect(toast(page, 'Could not save event: The request body could not be read.')).toBeVisible();
        });

        test('a failed seasons request shows an error and the form still works', async ({ page, api, myPermissions }) => {
            myPermissions.push(permission('global:manage_summeruniversity:regular'));
            api.on('GET summeruniversity /seasons', { abort: 'failed' });
            api.json('GET core /bodies', ok(BODIES));
            answerSave(api, 'POST summeruniversity /');
            await page.goto('/summeruniversity/new');

            await expect(toast(page, 'Could not fetch seasons: Network Error')).toBeVisible();
            await expect(page.getByLabel('Season').getByRole('option')).toHaveCount(0);
            await fillRequired(page);
            await page.getByRole('combobox', { name: 'Role of Alex Member' }).selectOption({ label: 'Main coordinator' });
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
        });
    });

    test.describe('editing', () => {
        test('loads the SU with the organisers\' names and saves it with PUT', async ({ page, api, me }) => {
            showEdit(api, me);
            answerSave(api, 'PUT summeruniversity /single/:id');
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByText('If you want to upload an image, please do it from the event page.')).toBeVisible();
            await expect(page.getByText('Event URL is the "short name of the event"')).toHaveCount(0);
            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');
            await expect(page.getByLabel('Event start date')).toHaveValue('2027-07-01 10:00');
            await expect(page.getByLabel('Event end date')).toHaveValue('2027-07-14 18:00');
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Antenna' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Partner' })).toBeVisible();
            await expect(page.getByRole('textbox', { name: 'Learning objective 2' })).toHaveValue('Hike safely');
            await expect(page.getByRole('textbox', { name: 'Location 2 name' })).toHaveValue('Ghent');
            await expect(page.getByRole('radio', { name: 'Location 1 is the starting city' })).toBeChecked();
            await expect(page.getByRole('radio', { name: 'Location 2 is the ending city' })).toBeChecked();

            // Names come from core; the member can't remove themselves.
            await expect(page.getByRole('combobox', { name: 'Role of Olga Organiser' })).toHaveValue('treasurer');
            await expect(page.getByRole('combobox', { name: 'Role of Alex Member' })).toHaveValue('main_coordinator');
            await expect(page.getByRole('button', { name: 'Delete Alex Member' })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Delete Olga Organiser' })).toBeVisible();
            // The URL doesn't follow the title of an existing SU.
            await page.getByLabel('Title').fill('Mountain SU, renamed');
            await expect(page.getByLabel('Event URL')).toHaveValue('mountain-su');
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            await expect(page).toHaveURL('/summeruniversity/mountain-su');
            const [call] = api.callsTo('PUT summeruniversity /single/:id');
            expect(call.params.id).toBe('mountain-su');
            expect(call.body).toMatchObject({
                name: 'Mountain SU, renamed',
                starts: '2027-07-01T08:00:00.000Z',
                ends: '2027-07-14T16:00:00.000Z',
                organizing_bodies: [{ body_id: 1 }],
                cooperation: [{ body_id: 4 }],
                organizers: [{ user_id: 2, role: 'main_coordinator' }, { user_id: 7, role: 'treasurer' }]
            });
            expect(api.callsTo('GET core /members/:id').map((lookup) => lookup.params.id).filter((userId) => userId !== 'me').sort()).toEqual(['2', '7']);
        });

        test('the fee can be changed in the first draft, after it only with the permission', async ({ page, api, me, myPermissions }) => {
            showEdit(api, me, { ...EDITED, status: 'first submission' });
            await page.goto('/summeruniversity/mountain-su/edit');
            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');
            await expect(page.getByLabel(/^Fee/)).toHaveCount(0);

            myPermissions.push(permission('global:edit:su_fee'));
            await page.reload();
            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');
            await expect(page.getByLabel(/^Fee/)).toHaveValue('150');
        });

        test('the fee is shown for an SU in its first draft', async ({ page, api, me }) => {
            showEdit(api, me);
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByLabel(/^Fee/)).toHaveValue('150');
        });

        test('the type and the season follow the permissions of the member', async ({ page, api, me, myPermissions }) => {
            myPermissions.push(permission('global:edit:su_type'), permission('global:manage_summeruniversity:pilot'));
            showEdit(api, me, { ...EDITED, type: 'pilot', season: 2026 });
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByLabel('Event type')).toHaveValue('pilot');
            await expect(page.getByLabel('Season')).toHaveValue('2026');
            // Managers of pilot SUs only don't choose the season of a regular one.
            await page.getByLabel('Event type').selectOption({ label: 'Regular SU' });
            await expect(page.getByLabel('Season')).toHaveCount(0);
        });

        test('an emptied max. participants is sent as null', async ({ page, api, me }) => {
            showEdit(api, me);
            answerSave(api, 'PUT summeruniversity /single/:id');
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByLabel('Max. participants')).toHaveValue('25');
            await page.getByLabel('Max. participants').fill('');
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id').map((call) => (call.body as SuEvent).max_participants)).toEqual([null]);
        });

        test('an emptied optional fee is sent as null', async ({ page, api, me }) => {
            showEdit(api, me);
            // What summeruniversity answers for an optional fee that is an empty text.
            api.on('PUT summeruniversity /single/:id', ({ body: sent }) => ((sent as SuEvent).optional_fee === ('' as unknown)
                ? { status: 422, json: validationError({ optional_fee: ['Optional fee should be valid.'] }) }
                : { json: ok(suEvent({ ...(sent as Partial<SuEvent>), id: 30 })) }));
            api.fallback(mockEverything);
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByLabel('Optional Fee')).toHaveValue('20');
            await page.getByLabel('Optional Fee').fill('');
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id').map((call) => (call.body as SuEvent).optional_fee)).toEqual([null]);
        });

        test('an emptied end date is refused before sending', async ({ page, api, me }) => {
            showEdit(api, me);
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByLabel('Event end date')).toHaveValue('2027-07-14 18:00');
            await page.getByLabel('Event end date').fill('');
            await page.getByLabel('Event end date').press('Enter');
            await save(page);

            await expect(toast(page, 'Please set the date when the event will end.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
        });

        test('deleting an organiser doesn\'t save the SU', async ({ page, api, me }) => {
            showEdit(api, me, {
                ...EDITED,
                organizers: [{ user_id: 7, role: 'treasurer' }, { user_id: 8, role: 'content_manager' }, { user_id: 2, role: 'main_coordinator' }]
            });
            await page.goto('/summeruniversity/mountain-su/edit');

            // Not the last row: the button of the first row stays in the page for the next organiser.
            await page.getByRole('button', { name: 'Delete Olga Organiser' }).click();

            await expect(page.getByRole('combobox', { name: 'Role of Olga Organiser' })).toHaveCount(0);
            await expect(page.getByRole('combobox', { name: 'Role of Ada Lovelace' })).toHaveValue('content_manager');
            await expect(page.getByRole('combobox', { name: 'Role of Alex Member' })).toBeVisible();
            await expect(page).toHaveURL('/summeruniversity/mountain-su/edit');
            expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
        });

        test('deleting a location doesn\'t save the SU', async ({ page, api, me }) => {
            showEdit(api, me);
            await page.goto('/summeruniversity/mountain-su/edit');

            await page.getByRole('button', { name: 'Delete location 1' }).click();

            await expect(page.getByRole('textbox', { name: 'Location 1 name' })).toHaveValue('Ghent');
            await expect(page.getByRole('textbox', { name: 'Location 2 name' })).toHaveCount(0);
            await expect(page).toHaveURL('/summeruniversity/mountain-su/edit');
            expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
        });

        test('only one location is the starting city and only one the ending city', async ({ page, api, me }) => {
            showEdit(api, me);
            answerSave(api, 'PUT summeruniversity /single/:id');
            await page.goto('/summeruniversity/mountain-su/edit');

            await page.getByRole('radio', { name: 'Location 2 is the starting city' }).check();
            await page.getByRole('radio', { name: 'Location 1 is the ending city' }).check();
            await expect(page.getByRole('radio', { name: 'Location 1 is the starting city' })).not.toBeChecked();
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            const [call] = api.callsTo('PUT summeruniversity /single/:id');
            const locations = (call.body as SuEvent).locations;
            expect(locations.map((location) => [location.name, location.start === true, location.end === true])).toEqual([
                ['Brussels', false, true],
                ['Ghent', true, false]
            ]);
        });

        test('SUCT can remove every organiser, and the form says one is needed', async ({ page, api, me }) => {
            showEdit(api, me, { ...EDITED, organizers: [{ user_id: 7, role: 'treasurer' }] }, suctPermissions('first draft'));
            await page.goto('/summeruniversity/mountain-su/edit');

            await page.getByRole('button', { name: 'Delete Olga Organiser' }).click();
            await expect(page.getByRole('combobox', { name: /^Role of / })).toHaveCount(0);
            await save(page);

            await expect(toast(page, 'Please add at least one organiser.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id')).toHaveLength(0);
        });

        test('an organiser\'s body is kept when saving', async ({ page, api, me }) => {
            showEdit(api, me, { ...EDITED, organizers: [{ user_id: 2, role: 'main_coordinator', body_id: 1 }, { user_id: 7, role: 'treasurer' }] });
            answerSave(api, 'PUT summeruniversity /single/:id');
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByRole('combobox', { name: 'Role of Olga Organiser' })).toBeVisible();
            await save(page);

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id').map((call) => (call.body as SuEvent).organizers))
                .toEqual([[{ user_id: 2, role: 'main_coordinator', body_id: 1 }, { user_id: 7, role: 'treasurer' }]]);
        });

        test('a body that core doesn\'t list any more shows its stored name', async ({ page, api, me }) => {
            showEdit(api, me, {
                ...EDITED,
                organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }, { body_id: 99, body_name: 'AEGEE-Closed' }],
                cooperation: [{ body_id: 98, body_name: 'AEGEE-Former' }]
            });
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByRole('button', { name: 'Remove AEGEE-Closed' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Former' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Antenna' })).toBeVisible();
        });

        test('an organiser whose name can\'t be fetched stays in the list', async ({ page, api, me }) => {
            showEdit(api, me);
            organizerLookup(api, me, (userId) => (userId === 7
                ? { status: 404, json: notFound('User is not found.') }
                : { json: ok(member({ id: userId, first_name: 'Alex', last_name: 'Member' })) }));
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(toast(page, 'Could not fetch an organiser: User is not found.')).toBeVisible();
            await expect(page.getByRole('combobox', { name: 'Role of Alex Member' })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Member 7' })).toHaveAttribute('href', '/members/7');
            await expect(page.getByRole('combobox', { name: 'Role of Member 7' })).toHaveValue('treasurer');
        });

        test('an unknown SU goes back to the list', async ({ page, api }) => {
            showForm(api);
            api.on('GET summeruniversity /single/:id', { status: 404, json: notFound('Event with id nowhere not found') });
            api.fallback(mockEverything);
            await page.goto('/summeruniversity/nowhere/edit');

            await expect(toast(page, 'Event is not found')).toBeVisible();
            await expect(page).toHaveURL('/summeruniversity');
        });

        test('another loading error goes back to the list with the message', async ({ page, api }) => {
            showForm(api);
            api.on('GET summeruniversity /single/:id', { status: 403, json: { success: false, message: 'You cannot see this event.' } });
            api.fallback(mockEverything);
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(toast(page, 'Some error happened: You cannot see this event.')).toBeVisible();
            await expect(page).toHaveURL('/summeruniversity');
        });

        test('a refused edit shows the service\'s message', async ({ page, api, me }) => {
            showEdit(api, me, { ...EDITED, status: 'second approval' });
            api.on('PUT summeruniversity /single/:id', { status: 403, json: { success: false, message: 'You cannot edit this event' } });
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');
            await save(page);

            await expect(toast(page, 'Could not save event: You cannot edit this event')).toBeVisible();
            await expect(page).toHaveURL('/summeruniversity/mountain-su/edit');
        });

        test('the map centres on the only location, and dragging its marker moves it', async ({ page, api, me }) => {
            showMap(api);
            showEdit(api, me, { ...EDITED, locations: [suLocation({ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } })] });
            await page.goto('/summeruniversity/mountain-su/edit');
            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');
            await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);

            const row = rowWith(page, 'Location 1 name');
            await expect(row).toContainText(/^50\.85\s*4\.35/);
            await dragTheMarker(page);
            // Up is north: the latitude grows, the longitude stays (give or take the float).
            await expect(row).toContainText(/^50\.(8[6-9]|9)\d*\s*4\.3[45]\d*/);
        });

        test('the map shows every location', async ({ page, api, me }) => {
            showMap(api);
            showEdit(api, me);
            await page.goto('/summeruniversity/mountain-su/edit');
            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');

            await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
            await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);
        });

        test('the map of an SU without locations stays where it is', async ({ page, api, me }) => {
            showMap(api);
            showEdit(api, me, { ...EDITED, locations: [] });
            await page.goto('/summeruniversity/mountain-su/edit');

            await expect(page.getByText('No locations added.')).toBeVisible();
            await expect.poll(() => api.callsTo('GET url ' + STYLE)).toHaveLength(1);
        });

        test('typing on drops the earlier organiser search', async ({ page, api, me }) => {
            showEdit(api, me);
            api.on('GET core /members_search', ({ query }) => (query.get('query') === 'Lo'
                ? { json: ok([memberSearchResult({ id: 9, first_name: 'Lo', last_name: 'Late' })]), delayMs: 1500 }
                : { json: ok([memberSearchResult({ id: 8, first_name: 'Ada', last_name: 'Lovelace' })]) }));
            await page.goto('/summeruniversity/mountain-su/edit');
            await expect(page.getByLabel('Title')).toHaveValue('Mountain SU');

            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lo');
            await page.getByRole('textbox', { name: 'Add organiser' }).fill('Lov');

            await expect(page.getByRole('main').getByRole('button', { name: 'Ada Lovelace', exact: true })).toBeVisible();
            await expect.poll(() => api.callsTo('GET core /members_search').map((call) => call.query.get('query')).sort()).toEqual(['Lo', 'Lov']);
            await expect(page.getByRole('main').getByRole('button', { name: 'Lo Late' })).toHaveCount(0);
            await expect(toast(page, 'Could not fetch members')).toHaveCount(0);
        });
    });
});
