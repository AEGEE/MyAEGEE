// Creating a statutory event (/statutory/new) and editing one (/statutory/:id/edit): the form,
// its dates and the deadlines it suggests, the organising body, questions and locations, and
// what is sent.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { statutoryEvent, statutoryOrganiserPermissions, type StatutoryEvent } from '../support/factories/statutory-events.ts';
import { mockMap } from '../support/map.ts';
import { fillDate, freezeTime, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ALPHA = body({ id: 10, name: 'AEGEE-Alpha', description: 'The antenna of Alpha' });
const BETA = body({ id: 11, name: 'AEGEE-Beta', description: 'The antenna of Beta' });

// The date fields, by their label. All dates of these tests are in summer time (UTC+2).
const DATE_FIELDS = {
    starts: 'Event start date',
    ends: 'Event end date',
    application_period_starts: 'Application period starts',
    application_period_ends: 'Application period ends',
    board_approve_deadline: 'Board approve deadline',
    participants_list_publish_deadline: 'Participants list publish deadline',
    memberslist_submission_deadline: 'Members list submission deadline',
    draft_proposal_deadline: 'Draft proposals deadline',
    final_proposal_deadline: 'Final proposals deadline',
    candidature_deadline: 'Candidatures deadline',
    booklet_publication_deadline: /^Documents publication deadline/,
    updated_booklet_publication_deadline: 'Updated documents publication deadline'
} as const;
type DateField = keyof typeof DATE_FIELDS;

const dateField = (page: Page, field: DateField) => page.getByLabel(DATE_FIELDS[field]);

// What the form sends for the dates typed in by fillDates().
const SENT_DATES = {
    starts: '2027-07-15T08:00:00.000Z',
    ends: '2027-07-18T14:00:00.000Z',
    application_period_starts: '2027-05-01T08:00:00.000Z',
    application_period_ends: '2027-05-31T21:00:00.000Z',
    board_approve_deadline: '2027-06-05T10:00:00.000Z',
    // The board deadline plus a day.
    participants_list_publish_deadline: '2027-06-06T10:00:00.000Z',
    memberslist_submission_deadline: '2027-06-20T10:00:00.000Z',
    // Suggested from the start, at 23:59 of the day: 45 days, a month, two weeks and five days before.
    draft_proposal_deadline: '2027-05-31T21:59:00.000Z',
    final_proposal_deadline: '2027-06-15T21:59:00.000Z',
    candidature_deadline: '2027-07-01T21:59:00.000Z',
    booklet_publication_deadline: '2027-07-01T21:59:00.000Z',
    updated_booklet_publication_deadline: '2027-07-10T21:59:00.000Z'
};
const AGORA_ONLY = ['memberslist_submission_deadline', 'draft_proposal_deadline', 'final_proposal_deadline', 'candidature_deadline', 'booklet_publication_deadline', 'updated_booklet_publication_deadline'] as const;
const NO_AGORA_DEADLINES = Object.fromEntries(AGORA_ONLY.map((field) => [field, null]));

const fillDates = async (page: Page, { memberslist = true } = {}): Promise<void> => {
    await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
    await fillDate(dateField(page, 'ends'), '2027-07-18 16:00');
    await fillDate(dateField(page, 'application_period_starts'), '2027-05-01 10:00');
    await fillDate(dateField(page, 'application_period_ends'), '2027-05-31 23:00');
    await fillDate(dateField(page, 'board_approve_deadline'), '2027-06-05 12:00');
    if (memberslist) await fillDate(dateField(page, 'memberslist_submission_deadline'), '2027-06-20 12:00');
};

const answerBodies = (api: ApiMock): void => {
    api.on('GET core /bodies', ({ query }) => ({
        json: ok([ALPHA, BETA].filter((item) => item.name.toLowerCase().includes((query.get('query') ?? '').toLowerCase())))
    }));
};

const pickBody = async (page: Page, typed = 'alpha', name = 'AEGEE-Alpha'): Promise<void> => {
    await page.getByLabel('Organising body').fill(typed);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole('button', { name: `${name} (Click to unset)` })).toBeVisible();
};

// The fields the browser checks itself, filled in.
const fillTexts = async (page: Page): Promise<void> => {
    await page.getByLabel('Title').fill('Agora Évora 2027');
    await page.getByRole('textbox', { name: /^Description/ }).fill('The **Spring Agora** of the network.');
    await page.getByLabel('Fee').fill('75');
};

const addStringQuestion = async (page: Page, description = 'Why do you want to go?'): Promise<void> => {
    await page.getByRole('button', { name: 'Add new question' }).click();
    const count = await page.getByRole('textbox', { name: /^Question \d+ description$/ }).count();
    await page.getByRole('textbox', { name: `Question ${count} description` }).fill(description);
};

// After saving, the page of the event: its own spec checks it.
const answerEventPage = (api: ApiMock, data: StatutoryEvent): void => {
    api.json('GET statutory /events/:id', ok(data));
    api.json('GET core /bodies/:id', ok(ALPHA));
};

test.describe('creating a statutory event', () => {
    test.beforeEach(({ api }) => {
        mockMap(api);
    });

    test('an organiser creates an Agora with questions and a location', async ({ page, api }) => {
        answerBodies(api);
        api.json('POST statutory /', ok(statutoryEvent()));
        answerEventPage(api, statutoryEvent({ url: 'agora-evora-2027', name: 'Agora Évora 2027' }));

        await page.goto('/statutory/new');
        await expect(page).toHaveTitle('MyAEGEE | Create event');
        await expect(page.getByText('It can\'t be changed later.').first()).toBeVisible();

        await fillTexts(page);
        await page.getByLabel('Link to KMS page').fill('https://wiki.example.org/agora');
        await expect(page.getByLabel('Event type')).toHaveValue('agora');
        await fillDates(page);
        await pickBody(page);

        await addStringQuestion(page);
        await page.getByRole('button', { name: 'Add new question' }).click();
        await page.getByRole('textbox', { name: 'Question 2 description' }).fill('Your meal');
        await page.getByRole('combobox', { name: 'Question 2 type' }).selectOption({ label: 'Select' });
        const values = page.getByRole('textbox', { name: 'Question 2 values' });
        await values.fill('Meat');
        await values.press('Enter');
        await values.fill(' Vegan ');
        await values.press('Enter');
        await page.getByRole('checkbox', { name: 'Question 2 required' }).uncheck();

        await page.getByRole('button', { name: 'Add new location' }).click();
        await page.getByRole('textbox', { name: 'Location 1 name' }).fill('Plenary hall');

        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-evora-2027');
        expect(api.callsTo('POST statutory /').map((call) => call.body)).toEqual([{
            name: 'Agora Évora 2027',
            description: 'The **Spring Agora** of the network.',
            url: 'agora-evora-2027',
            type: 'agora',
            vegetarian: false,
            body_id: 10,
            fee: 75,
            booklet_folder: 'https://wiki.example.org/agora',
            ...SENT_DATES,
            questions: [
                { description: 'Why do you want to go?', type: 'string', required: true },
                { description: 'Your meal', type: 'select', required: false, values: ['Meat', 'Vegan'] }
            ],
            locations: [{ name: 'Plenary hall', position: { lat: 50.8503396, lng: 4.3517103 } }]
        }]);
    });

    test('a new event starts without questions, locations or a body, and asks for nothing', async ({ page, api }) => {
        await page.goto('/statutory/new');

        await expect(page.getByText('No questions are set.')).toBeVisible();
        await expect(page.getByText('No locations added.')).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByRole('checkbox', { name: 'Yes, the event will be without any meat' })).not.toBeChecked();
        await expect(page.getByText('Consider if you want to make the event fully vegetarian / vegan!')).toBeVisible();
        expect(api.callsTo('* * *').filter((call) => call.service === 'statutory')).toEqual([]);
        expect(api.callsTo('GET core /bodies')).toEqual([]);
    });

    test('the start date suggests the Agora deadlines, and the board deadline the participants list', async ({ page }) => {
        await page.goto('/statutory/new');

        await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
        await expect(dateField(page, 'draft_proposal_deadline')).toHaveValue('2027-05-31 23:59');
        await expect(dateField(page, 'final_proposal_deadline')).toHaveValue('2027-06-15 23:59');
        await expect(dateField(page, 'candidature_deadline')).toHaveValue('2027-07-01 23:59');
        await expect(dateField(page, 'booklet_publication_deadline')).toHaveValue('2027-07-01 23:59');
        await expect(dateField(page, 'updated_booklet_publication_deadline')).toHaveValue('2027-07-10 23:59');

        await fillDate(dateField(page, 'board_approve_deadline'), '2027-06-05 12:00');
        await expect(dateField(page, 'participants_list_publish_deadline')).toHaveValue('2027-06-06 12:00');
        await expect(dateField(page, 'memberslist_submission_deadline')).toHaveValue('');
    });

    test('a later start moves the suggested deadlines, and a chosen participants list deadline stays', async ({ page }) => {
        await page.goto('/statutory/new');

        await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
        await fillDate(dateField(page, 'starts'), '2027-08-20 10:00');
        await expect(dateField(page, 'draft_proposal_deadline')).toHaveValue('2027-07-06 23:59');
        await expect(dateField(page, 'updated_booklet_publication_deadline')).toHaveValue('2027-08-15 23:59');

        await fillDate(dateField(page, 'participants_list_publish_deadline'), '2027-06-20 12:00');
        await fillDate(dateField(page, 'board_approve_deadline'), '2027-06-05 12:00');
        await expect(dateField(page, 'participants_list_publish_deadline')).toHaveValue('2027-06-20 12:00');
    });

    test('a date can be picked in the calendar', async ({ page }) => {
        // The calendar opens on the month of today: March 2027.
        await freezeTime(page);
        await page.goto('/statutory/new');

        await dateField(page, 'ends').click();
        await page.getByLabel('March 15, 2027').filter({ visible: true }).click();

        await expect(dateField(page, 'ends')).toHaveValue('2027-03-15 12:00');
    });

    test('warns when the participants list would be published before the board approve deadline', async ({ page }) => {
        const warning = page.getByText('Suggested: keep participants list publish deadline after board approve deadline.');
        await page.goto('/statutory/new');

        await fillDate(dateField(page, 'board_approve_deadline'), '2027-06-05 12:00');
        await expect(warning).toBeHidden();

        await fillDate(dateField(page, 'participants_list_publish_deadline'), '2027-06-05 12:00');
        await expect(warning).toBeVisible();

        await fillDate(dateField(page, 'participants_list_publish_deadline'), '2027-06-07 12:00');
        await expect(warning).toBeHidden();
    });

    for (const type of ['epm', 'spm'] as const) {
        test(`an ${type.toUpperCase()} has none of the Agora deadlines, and sends them empty`, async ({ page, api }) => {
            answerBodies(api);
            api.json('POST statutory /', ok(statutoryEvent({ type })));
            answerEventPage(api, statutoryEvent({ type, url: 'agora-evora-2027' }));

            await page.goto('/statutory/new');
            await page.getByLabel('Event type').selectOption({ label: type.toUpperCase() });
            for (const field of AGORA_ONLY) {
                await expect(dateField(page, field)).toHaveCount(0);
            }

            await fillTexts(page);
            await page.getByRole('checkbox', { name: 'Yes, the event will be without any meat' }).check();
            await fillDates(page, { memberslist: false });
            await pickBody(page);
            await addStringQuestion(page);
            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(page).toHaveURL('/statutory/agora-evora-2027');
            expect(api.callsTo('POST statutory /').map((call) => call.body)).toEqual([expect.objectContaining({
                type,
                vegetarian: true,
                ...NO_AGORA_DEADLINES
            })]);
        });
    }

    test('the URL follows the title until it is typed in', async ({ page }) => {
        await page.goto('/statutory/new');

        await page.getByLabel('Title').fill('Agora Évora 2027');
        await expect(page.getByLabel('Event URL')).toHaveValue('agora-evora-2027');

        await page.getByLabel('Title').fill('Агора Подъезд');
        await expect(page.getByLabel('Event URL')).toHaveValue('agora-podezd');

        await page.getByLabel('Event URL').fill('my-agora');
        await expect(page.getByLabel('Event URL')).toHaveValue('my-agora');
    });

    // The page names what is missing, one thing at a time, and sends nothing.
    const missing: [string, (page: Page) => Promise<void>, string][] = [
        ['a question', async () => undefined, 'Please set at least 1 application question.'],
        ['the start', async (page) => { await addStringQuestion(page); }, 'Please set the date when the event will start.'],
        ['the end', async (page) => {
            await addStringQuestion(page);
            await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
        }, 'Please set the date when the event will end.'],
        ['the application start', async (page) => {
            await addStringQuestion(page);
            await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
            await fillDate(dateField(page, 'ends'), '2027-07-18 16:00');
        }, 'Please set the date when applications period will start.'],
        ['the application end', async (page) => {
            await addStringQuestion(page);
            await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
            await fillDate(dateField(page, 'ends'), '2027-07-18 16:00');
            await fillDate(dateField(page, 'application_period_starts'), '2027-05-01 10:00');
        }, 'Please set the date when applications period will end.'],
        ['the board deadline', async (page) => {
            await addStringQuestion(page);
            await fillDate(dateField(page, 'starts'), '2027-07-15 10:00');
            await fillDate(dateField(page, 'ends'), '2027-07-18 16:00');
            await fillDate(dateField(page, 'application_period_starts'), '2027-05-01 10:00');
            await fillDate(dateField(page, 'application_period_ends'), '2027-05-31 23:00');
        }, 'Please set the board approve deadline.'],
        ['the members list deadline of an Agora', async (page) => {
            await addStringQuestion(page);
            await fillDates(page, { memberslist: false });
        }, 'Please set the members list submission deadline.'],
        ['the body', async (page) => {
            await addStringQuestion(page);
            await fillDates(page);
        }, 'Please select a body.'],
        // A date that was filled in, or suggested, and then emptied again.
        ...([
            ['starts', 'Please set the date when the event will start.'],
            ['board_approve_deadline', 'Please set the board approve deadline.'],
            ['participants_list_publish_deadline', 'Please set the participants list publish deadline.'],
            ['draft_proposal_deadline', 'Please set the draft proposal deadline.'],
            ['final_proposal_deadline', 'Please set the final proposal deadline.'],
            ['candidature_deadline', 'Please set the candidature deadline.'],
            ['booklet_publication_deadline', 'Please set the documents publication deadline.'],
            ['updated_booklet_publication_deadline', 'Please set the updated documents publication deadline.']
        ] as const).map(([field, message]): [string, (page: Page) => Promise<void>, string] => [`the cleared ${field.replaceAll('_', ' ')}`, async (page) => {
            await addStringQuestion(page);
            await fillDates(page);
            await fillDate(dateField(page, field), '');
        }, message])
    ];
    for (const [what, fill, message] of missing) {
        test(`without ${what} it says so and sends nothing`, async ({ page, api }) => {
            await page.goto('/statutory/new');
            await fillTexts(page);
            await fill(page);

            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, message)).toBeVisible();
            expect(api.callsTo('POST statutory /')).toEqual([]);
        });
    }

    test('the browser asks for the title, the description, the fee and a valid KMS link first', async ({ page, api }) => {
        await page.goto('/statutory/new');
        const save = page.getByRole('button', { name: 'Save event' });
        const missingValue = (label: string) => page.getByLabel(label).evaluate((input: HTMLInputElement) => input.validity.valueMissing);

        await save.click();
        expect(await missingValue('Title')).toBe(true);

        await page.getByLabel('Title').fill('Agora');
        await save.click();
        expect(await missingValue('Description')).toBe(true);

        await page.getByRole('textbox', { name: /^Description/ }).fill('An Agora');
        await save.click();
        expect(await missingValue('Fee')).toBe(true);

        await page.getByLabel('Fee').fill('10');
        await page.getByLabel('Link to KMS page').fill('the wiki');
        await save.click();
        expect(await page.getByLabel('Link to KMS page').evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);

        expect(await page.getByRole('alert').count()).toBe(0);
        expect(api.callsTo('POST statutory /')).toEqual([]);
    });

    test('the KMS link explains what a proper link is', async ({ page }) => {
        await page.goto('/statutory/new');

        await page.getByText('Link to KMS page').getByRole('button', { name: 'More information' }).focus();

        await expect(page.getByRole('tooltip')).toContainText('A proper URL starts with https:// or http://');
    });

    test('a select question gets values, and loses them when it is no select any more', async ({ page, api }) => {
        answerBodies(api);
        api.json('POST statutory /', ok(statutoryEvent()));
        answerEventPage(api, statutoryEvent({ url: 'agora-evora-2027' }));
        await page.goto('/statutory/new');

        await addStringQuestion(page, 'Your meal');
        await expect(page.getByRole('textbox', { name: 'Question 1 values' })).toHaveCount(0);
        await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Select' });
        await expect(page.getByRole('textbox', { name: 'Question 1 values' })).toHaveValue('');
        await page.getByRole('textbox', { name: 'Question 1 values' }).fill('Meat');
        await page.getByRole('textbox', { name: 'Question 1 values' }).press('Enter');
        await page.getByRole('combobox', { name: 'Question 1 type' }).selectOption({ label: 'Number' });
        await expect(page.getByRole('textbox', { name: 'Question 1 values' })).toHaveCount(0);

        await fillTexts(page);
        await fillDates(page);
        await pickBody(page);
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(page).toHaveURL('/statutory/agora-evora-2027');
        expect(api.callsTo('POST statutory /')[0].body).toMatchObject({ questions: [{ description: 'Your meal', type: 'number', required: true }] });
        expect((api.callsTo('POST statutory /')[0].body as { questions: object[] }).questions[0]).not.toHaveProperty('values');
    });

    test('questions and locations can be added and removed', async ({ page }) => {
        await page.goto('/statutory/new');

        await addStringQuestion(page, 'First');
        await addStringQuestion(page, 'Second');
        await page.getByRole('button', { name: 'Delete question 1' }).click();
        await expect(page.getByRole('textbox', { name: 'Question 1 description' })).toHaveValue('Second');
        await expect(page.getByRole('textbox', { name: 'Question 2 description' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Delete question 1' }).click();
        await expect(page.getByText('No questions are set.')).toBeVisible();

        await page.getByRole('button', { name: 'Add new location' }).click();
        const locations = page.getByRole('table').filter({ hasText: 'Latitude' });
        await expect(locations.getByRole('row').filter({ hasText: '50.8503396' })).toContainText('4.3517103');
        await page.getByRole('button', { name: 'Delete location 1' }).click();
        await expect(page.getByText('No locations added.')).toBeVisible();
    });

    test('deleting a location doesn\'t save the event', async ({ page, api }) => {
        await page.goto('/statutory/new');
        await fillTexts(page);
        await page.getByRole('button', { name: 'Add new location' }).click();
        await page.getByRole('textbox', { name: 'Location 1 name' }).fill('Plenary hall');
        await page.getByRole('button', { name: 'Add new location' }).click();
        await page.getByRole('textbox', { name: 'Location 2 name' }).fill('Party hall');

        await page.getByRole('button', { name: 'Delete location 1' }).click();

        await expect(page.getByRole('textbox', { name: 'Location 2 name' })).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: 'Location 1 name' })).toHaveValue('Party hall');
        // Saving would stop at the first check: the event has no questions.
        await page.getByRole('button', { name: 'Add new question' }).click();
        await expect(page.getByRole('textbox', { name: 'Question 1 description' })).toBeVisible();
        expect(await page.getByRole('alert').count()).toBe(0);
        expect(api.callsTo('POST statutory /')).toEqual([]);
    });

    test('the organising body is looked up as it is typed, and can be unset', async ({ page, api }) => {
        answerBodies(api);
        await page.goto('/statutory/new');

        const field = page.getByLabel('Organising body');
        await field.fill('aegee');
        await expect(page.getByRole('button', { name: /^AEGEE-Alpha/ })).toContainText('The antenna of Alpha');
        await expect(page.getByRole('button', { name: /^AEGEE-Beta/ })).toBeVisible();
        await field.fill('be');
        await expect(page.getByRole('button', { name: /^AEGEE-Alpha/ })).toHaveCount(0);
        await page.getByRole('button', { name: /^AEGEE-Beta/ }).click();
        await expect(page.getByRole('button', { name: 'AEGEE-Beta (Click to unset)' })).toBeVisible();
        await expect(page.getByText('Not set.')).toHaveCount(0);

        await page.getByRole('button', { name: 'AEGEE-Beta (Click to unset)' }).click();
        await expect(page.getByText('Not set.')).toBeVisible();

        expect(api.callsTo('GET core /bodies').map((call) => call.query.get('query'))).toEqual(['aegee', 'be']);
    });

    test('an empty body search asks nothing', async ({ page, api }) => {
        answerBodies(api);
        await page.goto('/statutory/new');

        const field = page.getByLabel('Organising body');
        await field.fill('alpha');
        await expect(page.getByRole('button', { name: /^AEGEE-Alpha/ })).toBeVisible();
        await field.fill('');
        await field.fill('beta');

        await expect(page.getByRole('button', { name: /^AEGEE-Beta/ })).toBeVisible();
        expect(api.callsTo('GET core /bodies').map((call) => call.query.get('query'))).toEqual(['alpha', 'beta']);
    });

    test('a body typed while the last search is still answered shows only the last answer', async ({ page, api }) => {
        api.on('GET core /bodies', ({ query }) => (query.get('query') === 'al'
            ? { json: ok([ALPHA, BETA]), delayMs: 1500 }
            : { json: ok([BETA]) }));
        await page.goto('/statutory/new');

        await page.getByLabel('Organising body').fill('al');
        await page.getByLabel('Organising body').fill('be');

        await expect(page.getByRole('button', { name: /^AEGEE-Beta/ })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies').length).toBe(2);
        await expect(page.getByRole('button', { name: /^AEGEE-Alpha/ })).toHaveCount(0);
        expect(await page.getByRole('alert').count()).toBe(0);
    });

    test('when the bodies can\'t be looked up, it says so', async ({ page, api }) => {
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        await page.goto('/statutory/new');

        await page.getByLabel('Organising body').fill('alpha');

        await expect(toast(page, 'Could not fetch bodies: Something went wrong on the server.')).toBeVisible();
    });

    test.describe('when the service refuses the event', () => {
        const submit = async (page: Page, api: ApiMock): Promise<void> => {
            answerBodies(api);
            await page.goto('/statutory/new');
            await fillTexts(page);
            await fillDates(page);
            await pickBody(page);
            await addStringQuestion(page);
            await page.getByRole('button', { name: 'Save event' }).click();
        };

        test('each invalid field says why, and the messages go when it is sent again', async ({ page, api }) => {
            const messages = {
                name: 'Event name should be set.',
                description: 'Event description should be set.',
                url: 'Event URL should only contain numbers, letters and dashes.',
                type: 'Event type should be one of these: "agora", "epm", "spm".',
                booklet_folder: 'The link should be a valid URL starting with http:// or https://.',
                starts: 'Event start date should be set.',
                ends: 'Event cannot start after or at the same time it ends.',
                application_period_starts: 'Event application starts date should be set.',
                application_period_ends: 'Event application ends date should be set.',
                board_approve_deadline: 'Event board approve deadline should be set.',
                participants_list_publish_deadline: 'Participants list publish deadline should be set.',
                memberslist_submission_deadline: 'Event is Agora, but the members list submission deadline is not set.',
                draft_proposal_deadline: 'Event is Agora, but the draft proposal deadline is not set.',
                final_proposal_deadline: 'Event is Agora, but the final proposal deadline is not set.',
                candidature_deadline: 'Event is Agora, but the candidature deadline is not set.',
                booklet_publication_deadline: 'Event is Agora, but the booklet publication deadline is not set.',
                updated_booklet_publication_deadline: 'Updated booklet publication deadline cannot be before the booklet publication deadline.',
                body_id: 'Body ID should be set.',
                fee: 'Event fee cannot be negative',
                locations: 'Name should be presented.'
            };
            // statutory checks the questions one by one and stops at the first problem.
            let answer = { status: 422, json: validationError({ ...Object.fromEntries(Object.entries(messages).map(([field, message]) => [field, [message]])), questions: ['Question 1: description should be set.'] }) as object };
            api.on('POST statutory /', () => answer);
            await submit(page, api);

            await expect(toast(page, 'Some of the event data is invalid.')).toBeVisible();
            for (const message of Object.values(messages)) {
                await expect(page.getByText(message, { exact: true })).toBeVisible();
            }
            const reasons = page.getByText('Could not create/edit event because of these reasons:');
            await expect(reasons.getByRole('listitem')).toHaveText(['Question 1: description should be set.']);
            await expect(page.getByText('Question 1: description should be set.')).toHaveCount(1);

            answer = { status: 403, json: forbidden('You are not allowed to create events of this type.') };
            await page.getByRole('button', { name: 'Save event' }).click();

            await expect(toast(page, 'Could not save event: You are not allowed to create events of this type.')).toBeVisible();
            await expect(page.getByText(messages.url)).toHaveCount(0);
            await expect(reasons).toHaveCount(0);
        });

        test('without the permission it says so and keeps the form; Save waits for the answer', async ({ page, api }) => {
            api.on('POST statutory /', { status: 403, json: forbidden('You are not allowed to create events of this type.'), delayMs: 1000 });
            await submit(page, api);

            await expect(page.getByRole('button', { name: 'Save event' })).toBeDisabled();
            await expect(toast(page, 'Could not save event: You are not allowed to create events of this type.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Save event' })).toBeEnabled();
            await expect(page.getByLabel('Title')).toHaveValue('Agora Évora 2027');
            await expect(page).toHaveURL('/statutory/new');
        });

        test('without a connection it says so', async ({ page, api }) => {
            api.on('POST statutory /', { abort: 'failed' });
            await submit(page, api);

            await expect(toast(page, 'Could not save event: Network Error')).toBeVisible();
        });
    });

    test('the description preview shows markdown without running scripts', async ({ page, api }) => {
        const picture = new Promise<void>((resolve) => {
            api.url('GET', '/statutory/x', () => {
                resolve();
                return { status: 404, body: '' };
            });
        });
        await page.goto('/statutory/new');

        await page.getByRole('textbox', { name: /^Description/ }).fill('**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)');

        await expect(page.getByText('bold', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await expect(page.getByText('x', { exact: true })).not.toHaveAttribute('href', /javascript:/);
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });
});

test.describe('editing a statutory event', () => {
    const SAVED = {
        starts: '2027-07-15T08:00:00.000Z',
        ends: '2027-07-18T14:00:00.000Z',
        application_period_starts: '2027-05-01T08:00:00.000Z',
        application_period_ends: '2027-05-31T21:00:00.000Z',
        board_approve_deadline: '2027-06-05T10:00:00.000Z',
        participants_list_publish_deadline: '2027-06-08T10:00:00.000Z',
        memberslist_submission_deadline: '2027-06-20T10:00:00.000Z',
        draft_proposal_deadline: '2027-05-25T10:00:00.000Z',
        final_proposal_deadline: '2027-06-10T10:00:00.000Z',
        candidature_deadline: '2027-06-25T10:00:00.000Z',
        booklet_publication_deadline: '2027-06-28T10:00:00.000Z',
        updated_booklet_publication_deadline: '2027-07-08T10:00:00.000Z'
    };
    const QUESTIONS: StatutoryEvent['questions'] = [
        { description: 'Why do you want to go?', type: 'string', required: true },
        { description: 'Your meal', type: 'select', required: false, values: ['Meat', 'Vegan'] }
    ];
    const LOCATIONS = [{ name: 'Plenary hall', position: { lat: 50.85, lng: 4.35 } }];
    const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({
        id: 5,
        url: 'agora-spring',
        name: 'Agora Spring',
        description: 'The **Spring Agora**.',
        body_id: 10,
        fee: 75,
        booklet_folder: 'https://wiki.example.org/agora',
        vegetarian: true,
        ...SAVED,
        questions: QUESTIONS,
        locations: LOCATIONS,
        permissions: statutoryOrganiserPermissions(),
        ...overrides
    });
    // What the page sends: the fields of the form, nothing it only shows.
    const sent = (data: StatutoryEvent) => ({
        name: data.name,
        description: data.description,
        url: data.url,
        body_id: data.body_id,
        fee: data.fee,
        booklet_folder: data.booklet_folder,
        starts: data.starts,
        ends: data.ends,
        application_period_starts: data.application_period_starts,
        application_period_ends: data.application_period_ends,
        board_approve_deadline: data.board_approve_deadline,
        participants_list_publish_deadline: data.participants_list_publish_deadline,
        memberslist_submission_deadline: data.memberslist_submission_deadline,
        draft_proposal_deadline: data.draft_proposal_deadline,
        final_proposal_deadline: data.final_proposal_deadline,
        candidature_deadline: data.candidature_deadline,
        booklet_publication_deadline: data.booklet_publication_deadline,
        updated_booklet_publication_deadline: data.updated_booklet_publication_deadline,
        questions: data.questions,
        locations: data.locations
    });

    const showForEditing = (api: ApiMock, data: StatutoryEvent): void => {
        mockMap(api);
        api.on('GET statutory /events/:id', ({ params }) => (params.id === data.url || params.id === String(data.id)
            ? { json: ok(data) }
            : { status: 404, json: notFound('Event with such url or ID is not found.') }));
        api.json('GET core /bodies/:id', ok(ALPHA));
    };

    test('an organiser changes the title and fee, and the saved deadlines stay as they were', async ({ page, api }) => {
        const data = agora();
        showForEditing(api, data);
        api.json('PUT statutory /events/:id', ok(data));

        await page.goto('/statutory/agora-spring/edit');
        await expect(page).toHaveTitle('MyAEGEE | Edit single event');
        await expect(page.getByLabel('Title')).toHaveValue('Agora Spring');
        await expect(page.getByLabel('Event URL')).toHaveValue('agora-spring');
        await expect(page.getByRole('button', { name: 'AEGEE-Alpha (Click to unset)' })).toBeVisible();
        await expect(dateField(page, 'starts')).toHaveValue('2027-07-15 10:00');
        await expect(dateField(page, 'draft_proposal_deadline')).toHaveValue('2027-05-25 12:00');
        await expect(dateField(page, 'updated_booklet_publication_deadline')).toHaveValue('2027-07-08 12:00');
        await expect(page.getByRole('textbox', { name: 'Question 2 description' })).toHaveValue('Your meal');
        await expect(page.getByRole('combobox', { name: 'Question 2 type' })).toHaveValue('select');
        await expect(page.getByRole('checkbox', { name: 'Question 1 required' })).toBeChecked();
        await expect(page.getByText('Vegan', { exact: true })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Location 1 name' })).toHaveValue('Plenary hall');
        // The type and the meals can't be changed any more.
        await expect(page.getByLabel('Event type')).toHaveCount(0);
        await expect(page.getByRole('checkbox', { name: 'Yes, the event will be without any meat' })).toHaveCount(0);
        await expect(page.getByText('It can\'t be changed later.')).toHaveCount(0);

        await page.getByLabel('Title').fill('Agora Spring 2027');
        await page.getByLabel('Fee').fill('80');
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
        // The title changes, the URL doesn't.
        expect(api.callsTo('PUT statutory /events/:id').map((call) => [call.params.id, call.body]))
            .toEqual([['agora-spring', { ...sent(data), name: 'Agora Spring 2027', fee: 80 }]]);
    });

    test('a changed URL leads to the event\'s new address', async ({ page, api }) => {
        const data = agora();
        showForEditing(api, data);
        api.json('PUT statutory /events/:id', ok(data));
        // After saving, the event page asks for the event at its new address.
        api.on('GET statutory /events/:id', ({ params }) => ({ json: ok(params.id === 'agora-2027' ? agora({ url: 'agora-2027' }) : data) }));

        await page.goto('/statutory/5/edit');
        await expect(page.getByLabel('Title')).toHaveValue('Agora Spring');
        await page.getByLabel('Event URL').fill('agora-2027');
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(page).toHaveURL('/statutory/agora-2027');
        expect(api.callsTo('PUT statutory /events/:id').map((call) => [call.params.id, (call.body as { url: string }).url])).toEqual([['5', 'agora-2027']]);
    });

    test('an event without a URL is shown at its id after saving', async ({ page, api }) => {
        const data = agora({ url: '' });
        showForEditing(api, data);
        api.json('PUT statutory /events/:id', ok(data));
        api.json('GET statutory /events/:id', ok(data));

        await page.goto('/statutory/5/edit');
        await expect(page.getByLabel('Title')).toHaveValue('Agora Spring');
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(page).toHaveURL('/statutory/5');
    });

    test('the map shows the locations when it is ready before the event', async ({ page, api }) => {
        showForEditing(api, agora());
        api.on('GET core /bodies/:id', { json: ok(ALPHA), delayMs: 1500 });

        await page.goto('/statutory/agora-spring/edit');

        await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'AEGEE-Alpha (Click to unset)' })).toBeVisible();
    });

    test('a later start suggests new Agora deadlines', async ({ page, api }) => {
        showForEditing(api, agora());
        await page.goto('/statutory/agora-spring/edit');
        await expect(dateField(page, 'draft_proposal_deadline')).toHaveValue('2027-05-25 12:00');

        await fillDate(dateField(page, 'starts'), '2027-08-20 10:00');

        await expect(dateField(page, 'draft_proposal_deadline')).toHaveValue('2027-07-06 23:59');
        await expect(dateField(page, 'candidature_deadline')).toHaveValue('2027-08-06 23:59');
    });

    test('an EPM keeps its Agora deadlines empty', async ({ page, api }) => {
        const data = agora({ type: 'epm', url: 'epm-spring', ...NO_AGORA_DEADLINES });
        showForEditing(api, data);
        api.json('PUT statutory /events/:id', ok(data));
        answerEventPage(api, data);

        await page.goto('/statutory/epm-spring/edit');
        await expect(page.getByLabel('Title')).toHaveValue('Agora Spring');
        await expect(dateField(page, 'memberslist_submission_deadline')).toHaveCount(0);
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(page).toHaveURL('/statutory/epm-spring');
        expect(api.callsTo('PUT statutory /events/:id').map((call) => call.body)).toEqual([sent(data)]);
    });

    test('an unknown event goes back to the list', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory/no-such-event/edit');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('when the event can\'t be loaded, it says so and goes back to the list', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Internal server error.' } });
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory/agora-spring/edit');

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('when the organising body can\'t be loaded, the event can still be edited', async ({ page, api }) => {
        const data = agora();
        showForEditing(api, data);
        api.on('GET core /bodies/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.json('PUT statutory /events/:id', ok(data));
        api.json('GET statutory /events/:id', ok(data));

        await page.goto('/statutory/agora-spring/edit');

        await expect(toast(page, 'Could not fetch the organising body: Something went wrong on the server.')).toBeVisible();
        await expect(page.getByLabel('Title')).toHaveValue('Agora Spring');
        await expect(page.getByRole('button', { name: 'Unknown body (Click to unset)' })).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/edit');
        await page.getByRole('button', { name: 'Save event' }).click();
        await expect(page).toHaveURL('/statutory/agora-spring');
        expect(api.callsTo('PUT statutory /events/:id').map((call) => (call.body as { body_id: number }).body_id)).toEqual([10]);
    });

    for (const [count, locations] of [
        [0, []],
        [1, LOCATIONS],
        [3, [...LOCATIONS, { name: 'Party hall', position: { lat: 50.9, lng: 4.4 } }, { name: 'Hostel', position: { lat: 50.8, lng: 4.3 } }]]
    ] as const) {
        test(`the map shows an event with ${count} location${count === 1 ? '' : 's'}`, async ({ page, api }) => {
            showForEditing(api, agora({ locations: [...locations] }));

            await page.goto('/statutory/agora-spring/edit');

            await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
            await expect(page.getByRole('textbox', { name: /^Location \d+ name$/ })).toHaveCount(count);
        });
    }
});
