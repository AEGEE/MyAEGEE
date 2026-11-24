// Event editor (/events/new, /events/:id/edit): creating an event, and changing one.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, unprocessable, validationError } from '../support/factories/base.ts';
import { body, memberSearchResult } from '../support/factories/core.ts';
import { eventOrganizerPermissions, organizedEvent, organizer, question, type Event } from '../support/factories/events.ts';
import { mockMap } from '../support/map.ts';
import { cellOf, fillDate, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna' });
const OTHER = body({ id: 4, name: 'AEGEE-Other' });

// The bodies to choose from, and the map of in-person events.
const bodies = (api: ApiMock) => {
    api.json('GET core /bodies', ok([ANTENNA, OTHER]));
    mockMap(api);
};

const created = (data: Partial<Event> = {}) => ({ success: true, message: 'Event successfully created', data: organizedEvent({ id: 30, url: 'spring-training', ...data }) });

// The page the editor goes to after saving.
const eventPage = (api: ApiMock, data: Event) => api.json('GET events /single/:id', ok(data, { permissions: eventOrganizerPermissions(data.status) }));

const textbox = (page: Page, name: RegExp | string) => page.getByRole('textbox', { name });

// Types the four dates of an event with an application period.
const fillDates = async (page: Page) => {
    await fillDate(page.getByLabel(/^Application period starts/), '2027-04-01 10:00');
    await fillDate(page.getByLabel(/^Application period ends/), '2027-04-15 18:00');
    await fillDate(page.getByLabel(/^Event start date/), '2027-05-01 09:00');
    await fillDate(page.getByLabel(/^Event end date/), '2027-05-05 17:00');
};

const addBody = async (page: Page, name: string) => {
    await page.getByRole('combobox', { name: 'Add organising body' }).selectOption({ label: name });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
};

// The fields every new in-person event needs, apart from the dates.
const fillRequired = async (page: Page) => {
    await textbox(page, /^Title/).fill('Spring Training');
    await textbox(page, /^Description/).fill('Learn **things**.');
    await page.getByRole('spinbutton', { name: /^Fee/ }).fill('50');
    await page.getByRole('spinbutton', { name: /^Number of meals provided per day/ }).fill('3');
    await textbox(page, /^Accommodation type/).fill('Hostel');
};

// The organisers are the table with links to members.
const organisers = (page: Page) => page.getByRole('table').filter({ has: page.getByRole('link', { name: 'Alex Member' }) });

test.describe('event editor', () => {
    test.describe('creating an event', () => {
        test.beforeEach(({ api }) => bodies(api));

        test('shows the creation notes, the creator as organiser and a URL made from the title', async ({ page, api }) => {
            await page.goto('/events/new');

            await expect(page).toHaveTitle('MyAEGEE | Create event');
            await expect(page.getByText('PLEASE KEEP IN MIND THAT THE APPROVAL OF YOUR SUBMITTED EVENT WILL TAKE 3-4 DAYS.')).toBeVisible();
            await expect(page.getByText('Please select the event type wisely.', { exact: false })).toBeVisible();

            const creator = tableRows(organisers(page)).filter({ hasText: 'Alex Member' });
            await expect(creator).toBeVisible();
            await expect(creator.getByRole('textbox', { name: 'Comment for Alex Member' })).toHaveValue('Event creator.');
            await expect(creator.getByRole('button', { name: /^Delete organiser/ })).toHaveCount(0);
            await expect(creator.getByRole('link', { name: 'Alex Member' })).toHaveAttribute('href', '/members/2');
            await expect(page.getByText('No organising bodies.')).toBeVisible();

            await textbox(page, /^Title/).fill('Spring Training 2027');
            await expect(textbox(page, /^Event URL/)).toHaveValue('spring-training-2027');
            expect(api.callsTo('GET core /bodies')).toHaveLength(1);
        });

        test('creating an in-person event sends every field and opens the new event', async ({ page, api }) => {
            test.slow();
            api.on('GET core /members_search', { json: ok([memberSearchResult({ id: 7, first_name: 'Chris', last_name: 'Organiser' })]) });
            api.on('POST events /', { status: 201, json: created() });
            eventPage(api, organizedEvent({ id: 30, url: 'spring-training', name: 'Spring Training', status: 'draft' }));
            await page.goto('/events/new');

            await fillRequired(page);
            await page.getByRole('combobox', { name: /^Event type/ }).selectOption({ label: 'Network Meeting' });
            await page.getByRole('spinbutton', { name: 'Max. participants' }).fill('25');
            await page.getByRole('checkbox', { name: 'Yes, the event will be without any meat' }).check();
            await page.getByRole('spinbutton', { name: 'Optional Fee' }).fill('10');
            await textbox(page, 'Optional Programme').fill('City tour');
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Antenna' })).toBeVisible();
            await expect(page.getByRole('combobox', { name: 'Add organising body' })).toHaveValue('');

            await textbox(page, 'Add organiser').fill('Chr');
            await page.getByRole('main').getByRole('button', { name: /Chris\s+Organiser/ }).click();
            const added = tableRows(organisers(page)).filter({ hasText: 'Chris Organiser' });
            await added.getByRole('textbox', { name: 'Comment for Chris Organiser' }).fill('Treasurer');

            await page.getByRole('button', { name: 'Add new question' }).click();
            await textbox(page, 'Question 1 description').fill('Why do you want to join?');
            await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Text' });
            await page.getByRole('checkbox', { name: 'Question 1 is required' }).check();
            await page.getByRole('button', { name: 'Add new question' }).click();
            await textbox(page, 'Question 2 description').fill('T-shirt size');
            await page.getByRole('combobox', { name: 'Question 2 type' }).selectOption({ label: 'Select' });
            await textbox(page, 'Add a value').fill('S');
            await textbox(page, 'Add a value').press('Enter');
            await textbox(page, 'Add a value').fill('M');
            await textbox(page, 'Add a value').press('Enter');

            await page.getByRole('button', { name: 'Add new location' }).click();
            await textbox(page, 'Location 1 name').fill('Main square');
            await page.getByRole('textbox', { name: 'How to travel to your country' }).fill('https://example.org/travel');
            await textbox(page, 'Link to event budget').fill('https://example.org/budget');
            await textbox(page, 'Link to event program').fill('https://example.org/programme');

            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            await expect(page).toHaveURL('/events/spring-training');
            await expect(page.getByRole('heading', { name: 'Spring Training' })).toBeVisible();
            expect(api.callsTo('GET core /members_search').map((call) => [call.query.get('query'), call.query.get('body_id')])).toEqual([['Chr', '1']]);
            expect(api.callsTo('POST events /').map((call) => call.body)).toEqual([{
                id: null,
                name: 'Spring Training',
                description: 'Learn **things**.',
                url: 'spring-training',
                method: 'in person',
                has_applications: true,
                type: 'nwm',
                // Number fields are sent as the text typed; the service reads numbers from text.
                fee: '50',
                max_participants: '25',
                meals_per_day: '3',
                vegetarian: true,
                accommodation_type: 'Hostel',
                optional_fee: '10',
                optional_programme: 'City tour',
                // Typed in Brussels summer time.
                application_starts: '2027-04-01T08:00:00.000Z',
                application_ends: '2027-04-15T16:00:00.000Z',
                starts: '2027-05-01T07:00:00.000Z',
                ends: '2027-05-05T15:00:00.000Z',
                organizing_bodies: [{ body_id: 1 }],
                organizers: [{ user_id: 2, comment: 'Event creator.' }, { user_id: 7, comment: 'Treasurer' }],
                questions: [
                    { name: '', description: 'Why do you want to join?', type: 'text', required: true },
                    { name: '', description: 'T-shirt size', type: 'select', required: false, values: ['S', 'M'] }
                ],
                locations: [{ name: 'Main square', position: { lat: 50.8503396, lng: 4.3517103 } }],
                link_info_travel_country: 'https://example.org/travel',
                budget: 'https://example.org/budget',
                programme: 'https://example.org/programme'
            }]);
        });

        test('an online event without applications hides the in-person fields', async ({ page, api }) => {
            await page.goto('/events/new');
            // The map of the in-person form has to have started before it is taken away again.
            await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/maps/basic/style.json*').length).toBeGreaterThan(0);

            await page.getByRole('combobox', { name: /^How will the event take place/ }).selectOption({ label: 'Online' });
            await page.getByRole('combobox', { name: /^Do you want people to apply/ }).selectOption({ label: 'No' });

            for (const field of [/^Fee/, 'Max. participants', /^Number of meals/, 'Optional Fee']) {
                await expect(page.getByRole('spinbutton', { name: field })).toHaveCount(0);
            }
            for (const field of [/^Accommodation type/, 'Link to event budget', 'Location 1 name']) {
                await expect(textbox(page, field)).toHaveCount(0);
            }
            await expect(page.getByLabel(/^Application period starts/)).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Add new question' })).toHaveCount(0);
            await expect(page.getByRole('region', { name: 'Map' })).toHaveCount(0);
            await expect(page.getByText('Please provide the link to Google spreadsheets for the event program.')).toBeVisible();
            await expect(page.getByRole('link', { name: 'You can take the template for the program here.' })).toBeVisible();
        });

        test('an online event with applications asks for the period, participants and questions', async ({ page, api }) => {
            await page.goto('/events/new');
            await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/maps/basic/style.json*').length).toBeGreaterThan(0);

            await page.getByRole('combobox', { name: /^How will the event take place/ }).selectOption({ label: 'Online' });
            await expect(page.getByRole('combobox', { name: /^Do you want people to apply/ })).toHaveValue('true');

            await expect(page.getByRole('spinbutton', { name: 'Max. participants' })).toBeVisible();
            await expect(page.getByLabel(/^Application period starts/)).toBeVisible();
            await expect(page.getByLabel(/^Application period ends/)).toBeVisible();
            await expect(page.getByRole('button', { name: 'Add new question' })).toBeVisible();
            await expect(page.getByRole('spinbutton', { name: /^Fee/ })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Add new location' })).toHaveCount(0);
        });

        test('checks the dates, bodies and select values before sending', async ({ page, api }) => {
            test.slow();
            await page.goto('/events/new');
            await fillRequired(page);
            const save = page.getByRole('button', { name: 'Save event' });

            // The browser asks for the first three dates itself.
            await save.click();
            for (const field of [/^Application period starts/, /^Application period ends/, /^Event start date/]) {
                expect(await page.getByLabel(field).evaluate((input: HTMLInputElement) => input.validity.valueMissing), String(field)).toBe(true);
            }
            await fillDate(page.getByLabel(/^Application period starts/), '2027-04-01 10:00');
            await fillDate(page.getByLabel(/^Application period ends/), '2027-04-15 18:00');
            await fillDate(page.getByLabel(/^Event start date/), '2027-05-01 09:00');

            await save.click();
            await expect(toast(page, 'Please set the date when the event will end.')).toBeVisible();
            await fillDate(page.getByLabel(/^Event end date/), '2027-05-05 17:00');

            await save.click();
            await expect(toast(page, 'Please select at least one organizing body.')).toBeVisible();
            await addBody(page, 'AEGEE-Antenna');

            await page.getByRole('button', { name: 'Add new question' }).click();
            await textbox(page, 'Question 1 description').fill('Size');
            await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Select' });
            await save.click();
            await expect(toast(page, 'Please set values for select questions.')).toBeVisible();
            expect(api.callsTo('POST events /')).toHaveLength(0);
        });

        test('adding no body or the same body twice warns', async ({ page }) => {
            await page.goto('/events/new');

            await page.getByRole('button', { name: 'Add', exact: true }).click();
            await expect(toast(page, 'Please select a body.')).toBeVisible();

            await addBody(page, 'AEGEE-Antenna');
            await addBody(page, 'AEGEE-Antenna');
            await expect(toast(page, 'This body is already presented in the organizing bodies list.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Antenna' })).toHaveCount(1);
        });

        test('removing an organising body shows that there are none', async ({ page }) => {
            await page.goto('/events/new');
            await addBody(page, 'AEGEE-Other');
            await expect(page.getByText('No organising bodies.')).toHaveCount(0);

            await page.getByRole('button', { name: 'Remove AEGEE-Other' }).click();

            await expect(page.getByText('No organising bodies.')).toBeVisible();
        });

        test('the organiser search needs an organising body and only searches those bodies', async ({ page, api }) => {
            api.on('GET core /members_search', ({ query }) => (query.get('query') === 'C'
                ? { json: ok([memberSearchResult({ id: 8, first_name: 'Wrong', last_name: 'Answer' })]), delayMs: 1500 }
                : { json: ok([memberSearchResult({ id: 7, first_name: 'Chris', last_name: 'Organiser' })]) }));
            await page.goto('/events/new');
            const search = textbox(page, 'Add organiser');

            await search.fill('Chr');
            await expect(toast(page, 'Please add an organising body first.')).toBeVisible();
            expect(api.callsTo('GET core /members_search')).toHaveLength(0);

            await addBody(page, 'AEGEE-Antenna');
            await addBody(page, 'AEGEE-Other');
            await search.fill('');
            await search.press('C');
            await expect.poll(() => api.callsTo('GET core /members_search').length).toBe(1);
            await search.press('h');

            await expect(page.getByRole('main').getByRole('button', { name: /Chris\s+Organiser/ })).toBeVisible();
            await expect.poll(() => api.callsTo('GET core /members_search').map((call) => [call.query.get('query'), call.query.get('body_id')]))
                .toEqual([['C', '1,4'], ['Ch', '1,4']]);
            // The earlier, slower answer was dropped.
            await expect.poll(() => api.callsTo('GET core /members_search')[0].status).toBeDefined();
            await expect(page.getByRole('main').getByRole('button', { name: /Wrong\s+Answer/ })).toHaveCount(0);
        });

        test('adding someone who already organises warns', async ({ page, api }) => {
            api.on('GET core /members_search', { json: ok([memberSearchResult({ id: 2, first_name: 'Alex', last_name: 'Member' })]) });
            await page.goto('/events/new');
            await addBody(page, 'AEGEE-Antenna');

            await textbox(page, 'Add organiser').fill('Ale');
            await page.getByRole('main').getByRole('button', { name: /Alex\s+Member/ }).click();

            await expect(toast(page, 'This user is already an organiser.')).toBeVisible();
            await expect(tableRows(organisers(page))).toHaveCount(1);
        });

        test('a failed member search shows the error', async ({ page, api }) => {
            api.on('GET core /members_search', { status: 403, json: forbidden('You can only search members of bodies you are a member of.') });
            await page.goto('/events/new');
            await addBody(page, 'AEGEE-Antenna');

            await textbox(page, 'Add organiser').fill('Chr');

            await expect(toast(page, 'Could not fetch members: You can only search members of bodies you are a member of.')).toBeVisible();
        });

        test('deleting a question and a location removes their rows without saving the event', async ({ page, api }) => {
            await page.goto('/events/new');
            // A form that could be sent as it is.
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');

            await page.getByRole('button', { name: 'Add new question' }).click();
            await textbox(page, 'Question 1 description').fill('Why?');
            await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Text' });
            await page.getByRole('button', { name: 'Add new location' }).click();
            await textbox(page, 'Location 1 name').fill('Main square');
            await expect(page.getByText('No questions are set.')).toHaveCount(0);
            await expect(page.getByText('No locations added.')).toHaveCount(0);

            await page.getByRole('button', { name: 'Delete question 1' }).click();
            await page.getByRole('button', { name: 'Delete location 1' }).click();

            await expect(page.getByText('No questions are set.')).toBeVisible();
            await expect(page.getByText('No locations added.')).toBeVisible();
            await expect(page).toHaveURL('/events/new');
            await expect(page.getByRole('alert')).toHaveCount(0);
            expect(api.callsTo('POST events /')).toHaveLength(0);
        });

        test('a select question gets values, other types drop them', async ({ page, api }) => {
            api.on('POST events /', { status: 201, json: created() });
            eventPage(api, organizedEvent({ id: 30, url: 'spring-training', status: 'draft' }));
            await page.goto('/events/new');
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');

            await page.getByRole('button', { name: 'Add new question' }).click();
            await textbox(page, 'Question 1 description').fill('Size');
            await expect(textbox(page, 'Add a value')).toHaveCount(0);
            await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Select' });
            await textbox(page, 'Add a value').fill('S');
            await textbox(page, 'Add a value').press('Enter');
            await textbox(page, 'Add a value').fill('XL');
            await textbox(page, 'Add a value').press('Enter');
            // Backspace in the empty field removes the last value.
            await textbox(page, 'Add a value').press('Backspace');
            await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Number' });
            await expect(textbox(page, 'Add a value')).toHaveCount(0);
            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(page).toHaveURL('/events/spring-training');
            expect(api.callsTo('POST events /').map((call) => (call.body as { questions: unknown }).questions))
                .toEqual([[{ name: '', description: 'Size', type: 'number', required: false }]]);
        });

        test('the description preview shows the formatted text', async ({ page }) => {
            await page.goto('/events/new');

            await textbox(page, /^Description/).fill('Learn **project management**.');

            await expect(page.getByRole('region', { name: 'Preview of the description' }).getByText('project management')).toHaveJSProperty('tagName', 'STRONG');
        });

        test('the service\'s validation errors show under each field', async ({ page, api }) => {
            test.slow();
            const message = (field: string) => `${field} is not right.`;
            const fields = [
                'name', 'description', 'url', 'type', 'fee', 'max_participants', 'meals_per_day', 'accommodation_type', 'optional_fee',
                'optional_programme', 'application_starts', 'application_ends', 'starts', 'ends', 'organizing_bodies', 'organizers',
                'link_info_travel_country', 'is_budget_set', 'budget', 'is_programme_set', 'programme'
            ];
            // Real messages of the events service for a few fields; the rest only has to show up.
            const errors: Record<string, string[]> = Object.fromEntries(fields.map((field) => [field, [message(field)]]));
            errors.name = ['Event name should be set.'];
            errors.url = ['Event URL should only contain numbers, letters and dashes.', 'Event URL cannot contain numbers only.'];
            errors.questions = ['Event questions should be an array of strings.'];
            api.on('POST events /', { status: 422, json: validationError(errors) });
            await page.goto('/events/new');
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');
            await page.getByRole('button', { name: 'Add new question' }).click();
            await textbox(page, 'Question 1 description').fill('Why?');
            await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Text' });

            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, 'Some of the event data is invalid.')).toBeVisible();
            await expect(page.getByText('Event name should be set.')).toBeVisible();
            await expect(page.getByText('Event URL should only contain numbers, letters and dashes., Event URL cannot contain numbers only.')).toBeVisible();
            await expect(page.getByText('Could not create/edit event because of these reasons:')).toBeVisible();
            await expect(page.getByRole('listitem').filter({ hasText: 'Event questions should be an array of strings.' })).toBeVisible();
            for (const field of fields.filter((item) => !['name', 'url'].includes(item))) {
                await expect(page.getByText(message(field), { exact: true }), field).toBeVisible();
            }
            await expect(page).toHaveURL('/events/new');
        });

        test('other save errors show the message', async ({ page, api }) => {
            let answer = 0;
            api.on('POST events /', () => (answer++ === 0
                ? { status: 403, json: forbidden('You are not allowed to create events.') }
                : { status: 422, json: unprocessable('No valid field changes requested') }));
            await page.goto('/events/new');
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');

            await page.getByRole('button', { name: 'Save event' }).click();
            await expect(toast(page, 'Could not save event: You are not allowed to create events.')).toBeVisible();

            // A 422 with only a message is shown as it is.
            await page.getByRole('button', { name: 'Save event' }).click();
            await expect(toast(page, 'Could not save event: No valid field changes requested')).toBeVisible();
            await expect(page).toHaveURL('/events/new');
        });

        test('"Save event" is disabled while saving', async ({ page, api }) => {
            api.on('POST events /', { status: 201, json: created(), delayMs: 1000 });
            eventPage(api, organizedEvent({ id: 30, url: 'spring-training', status: 'draft' }));
            await page.goto('/events/new');
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');

            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(page.getByRole('button', { name: 'Save event' })).toBeDisabled();
            await expect(page).toHaveURL('/events/spring-training');
        });

        test('an emptied max. participants and optional fee are sent as empty', async ({ page, api }) => {
            api.on('POST events /', { status: 201, json: created() });
            eventPage(api, organizedEvent({ id: 30, url: 'spring-training', status: 'draft' }));
            await page.goto('/events/new');
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');
            await page.getByRole('spinbutton', { name: 'Max. participants' }).fill('25');
            await page.getByRole('spinbutton', { name: 'Max. participants' }).fill('');
            await page.getByRole('spinbutton', { name: 'Optional Fee' }).fill('10');
            await page.getByRole('spinbutton', { name: 'Optional Fee' }).fill('');

            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(page).toHaveURL('/events/spring-training');
            expect(api.callsTo('POST events /').map((call) => call.body)).toEqual([expect.objectContaining({ max_participants: null, optional_fee: null })]);
        });

        test('a cleared end date is asked for again', async ({ page, api }) => {
            await page.goto('/events/new');
            await fillRequired(page);
            await fillDates(page);
            await addBody(page, 'AEGEE-Antenna');

            await page.getByLabel(/^Event end date/).fill('');
            await page.getByLabel(/^Event end date/).press('Enter');
            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, 'Please set the date when the event will end.')).toBeVisible();
            expect(api.callsTo('POST events /')).toHaveLength(0);
        });
    });

    test.describe('editing an event', () => {
        const stored = (overrides: Partial<Event> = {}) => organizedEvent({
            id: 12,
            url: 'spring-training',
            name: 'Spring Training',
            status: 'draft',
            starts: '2027-05-01T07:00:00.000Z',
            ends: '2027-05-05T15:00:00.000Z',
            application_starts: '2027-04-01T08:00:00.000Z',
            application_ends: '2027-04-15T16:00:00.000Z',
            organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
            organizers: [organizer({ user_id: 2, first_name: 'Alex', last_name: 'Member', comment: 'Main organiser' }), organizer({ user_id: 7, first_name: 'Chris', last_name: 'Organiser', comment: 'Treasurer' })],
            questions: [question({ type: 'string', description: 'Why?', required: true })],
            ...overrides
        });

        test.beforeEach(({ api }) => bodies(api));

        test('loads the event, keeps its URL and hides the fields that can\'t change', async ({ page, api }) => {
            api.json('GET events /single/:id', ok(stored(), { permissions: eventOrganizerPermissions('draft') }));
            await page.goto('/events/spring-training/edit');

            await expect(page).toHaveTitle('MyAEGEE | Edit single event');
            await expect(page.getByText('If you want to upload an image, please do it from the event page.', { exact: true })).toBeVisible();
            await expect(textbox(page, /^Title/)).toHaveValue('Spring Training');
            await expect(page.getByLabel(/^Event start date/)).toHaveValue('2027-05-01 09:00');
            await expect(page.getByLabel(/^Application period ends/)).toHaveValue('2027-04-15 18:00');
            await expect(textbox(page, 'Question 1 description')).toHaveValue('Why?');
            await expect(page.getByRole('button', { name: 'Remove AEGEE-Antenna' })).toBeVisible();

            await textbox(page, /^Title/).fill('Spring Training Renamed');
            await expect(textbox(page, /^Event URL/)).toHaveValue('spring-training');
            for (const field of [/^How will the event take place/, /^Event type/]) {
                await expect(page.getByRole('combobox', { name: field })).toHaveCount(0);
            }
            await expect(page.getByRole('checkbox', { name: 'Yes, the event will be without any meat' })).toHaveCount(0);
            await expect(page.getByText('PLEASE KEEP IN MIND THAT THE APPROVAL OF YOUR SUBMITTED EVENT WILL TAKE 3-4 DAYS.')).toHaveCount(0);
            expect(api.callsTo('GET events /single/:id').map((call) => call.params.id)).toEqual(['spring-training']);
        });

        test('the current member can\'t remove themselves as organiser, others can be removed', async ({ page, api }) => {
            api.json('GET events /single/:id', ok(stored(), { permissions: eventOrganizerPermissions('draft') }));
            await page.goto('/events/spring-training/edit');

            const rows = tableRows(organisers(page));
            await expect(rows).toHaveCount(2);
            await expect(rows.filter({ hasText: 'Alex Member' }).getByRole('button', { name: /^Delete organiser/ })).toHaveCount(0);
            const chris = rows.filter({ hasText: 'Chris Organiser' });
            await expect(await cellOf(organisers(page), chris, 'Comment')).toBeVisible();
            await expect(chris.getByRole('textbox', { name: 'Comment for Chris Organiser' })).toHaveValue('Treasurer');

            await page.getByRole('button', { name: 'Delete organiser Chris Organiser' }).click();

            await expect(rows).toHaveCount(1);
            await expect(page).toHaveURL('/events/spring-training/edit');
            expect(api.callsTo('PUT events /single/:id')).toHaveLength(0);
        });

        test('saving sends the changes and goes back to the event', async ({ page, api }) => {
            api.json('GET events /single/:id', ok(stored(), { permissions: eventOrganizerPermissions('draft') }));
            api.on('PUT events /single/:id', ({ body: sent }) => ({ json: ok(stored({ ...(sent as Partial<Event>), organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }], organizers: stored().organizers })) }));
            await page.goto('/events/spring-training/edit');
            await expect(textbox(page, /^Title/)).toHaveValue('Spring Training');

            await textbox(page, /^Title/).fill('Spring Training 2027');
            await page.getByRole('textbox', { name: 'Comment for Chris Organiser' }).fill('Treasurer and driver');
            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, 'Event is saved.')).toBeVisible();
            await expect(page).toHaveURL('/events/spring-training');
            const [call] = api.callsTo('PUT events /single/:id');
            expect(call.params.id).toBe('spring-training');
            expect(call.body).toMatchObject({
                name: 'Spring Training 2027',
                url: 'spring-training',
                starts: '2027-05-01T07:00:00.000Z',
                ends: '2027-05-05T15:00:00.000Z',
                application_starts: '2027-04-01T08:00:00.000Z',
                application_ends: '2027-04-15T16:00:00.000Z',
                organizing_bodies: [{ body_id: 1 }],
                organizers: [{ user_id: 2, comment: 'Main organiser' }, { user_id: 7, comment: 'Treasurer and driver' }]
            });
        });

        test('an event left without organisers is not sent', async ({ page, api }) => {
            // A manager of the type edits an event they don't organise, so every organiser can be removed.
            api.json('GET events /single/:id', ok(stored({ organizers: [organizer({ user_id: 7, first_name: 'Chris', last_name: 'Organiser' })] }), { permissions: eventOrganizerPermissions('draft') }));
            await page.goto('/events/spring-training/edit');

            await page.getByRole('button', { name: 'Delete organiser Chris Organiser' }).click();
            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, 'Please add at least one organizer.')).toBeVisible();
            expect(api.callsTo('PUT events /single/:id')).toHaveLength(0);
        });

        test('an organising body that is no longer listed is shown by its stored name', async ({ page, api }) => {
            api.json('GET events /single/:id', ok(stored({ organizing_bodies: [{ body_id: 99, body_name: 'AEGEE-Closed' }] }), { permissions: eventOrganizerPermissions('draft') }));
            await page.goto('/events/spring-training/edit');

            await expect(page.getByRole('button', { name: 'Remove AEGEE-Closed' })).toBeVisible();
            await expect(page.getByText('AEGEE-Closed', { exact: true })).toBeVisible();
            await expect(textbox(page, /^Title/)).toHaveValue('Spring Training');
        });

        test('an unknown event goes back to the list', async ({ page, api }) => {
            api.on('GET events /single/:id', { status: 404, json: notFound('Event with id nope not found') });
            api.json('GET events /', ok([]));
            await page.goto('/events/nope/edit');

            await expect(toast(page, 'Event is not found')).toBeVisible();
            await expect(page).toHaveURL('/events');
        });

        test('other load errors go back to the list with the message', async ({ page, api }) => {
            api.on('GET events /single/:id', { status: 403, json: forbidden('You cannot see this event.') });
            api.json('GET events /', ok([]));
            await page.goto('/events/hidden/edit');

            await expect(toast(page, 'Some error happened: You cannot see this event.')).toBeVisible();
            await expect(page).toHaveURL('/events');
        });
    });
});
