// Applying to a statutory event (/statutory/:id/applications/new) and editing an application
// (/statutory/:id/applications/:application_id/edit): the form, the mailing lists, and the
// board's part of an application.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { singleStatutoryApplication, statutoryApplication, type SingleStatutoryApplication } from '../support/factories/statutory-applications.ts';
import { statutoryEvent, statutoryEventPermissions, statutoryManagerPermissions, type StatutoryEvent } from '../support/factories/statutory-events.ts';
import { freezeTime, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const QUESTIONS: StatutoryEvent['questions'] = [
    { type: 'text', description: 'Tell us about yourself', required: true },
    { type: 'string', description: 'Why do you want to go?', required: true },
    { type: 'number', description: 'How many Agorae did you attend?', required: false },
    { type: 'checkbox', description: 'I agree to share my contacts', required: false },
    { type: 'select', description: 'T-shirt size', required: true, values: ['S', 'M', 'L'] }
];

const ZULU = body({ id: 1, name: 'AEGEE-Zulu' });
const BETA = body({ id: 2, name: 'AEGEE-Beta' });
const ALPHA = body({ id: 3, name: 'AEGEE-Alpha' });

const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({
    url: 'agora-spring',
    questions: QUESTIONS,
    // AEGEE-Beta may send nobody.
    permissions: statutoryEventPermissions({ apply_from_body: { 1: true, 2: false, 3: true } }),
    ...overrides
});

const VISA_FIELDS = [
    ['Passport number', 'visa_passport_number'],
    ['Passport issue date', 'visa_passport_issue_date'],
    ['Passport expiration date', 'visa_passport_expiration_date'],
    ['Passport issue authority', 'visa_passport_issue_authority'],
    ['Place of birth', 'visa_place_of_birth'],
    ['Embassy', 'visa_embassy'],
    ['Street and house number', 'visa_street_and_house'],
    ['Postal code', 'visa_postal_code'],
    ['City', 'visa_city'],
    ['Country', 'visa_country']
] as const;

const field = (page: Page, role: 'textbox' | 'combobox' | 'spinbutton' | 'checkbox', name: string) => page.getByRole(role, { name: new RegExp(`^${name.replace(/[?()]/g, '\\$&')}`) });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save application!' });

// The event, and the application (the one being edited, or the one the form leads to once saved).
const mockEvent = (api: ApiMock, event: StatutoryEvent = agora()) => {
    api.json('GET statutory /events/:id', ok(event));
};
const mockApplication = (api: ApiMock, application: SingleStatutoryApplication) => {
    api.json('GET statutory /events/:id/applications/:application_id', ok(application));
};

// Fills in what the form needs beyond the prefilled answers.
const fillRequired = async (page: Page) => {
    await field(page, 'combobox', 'Nationality').selectOption('Belgian');
    await field(page, 'combobox', 'Meals type').selectOption('Vegan');
    await field(page, 'textbox', 'Tell us about yourself').fill('I organise events');
    await field(page, 'textbox', 'Why do you want to go?').fill('To learn');
};

const posts = (api: ApiMock) => api.callsTo('POST statutory /events/:id/applications').map((call) => call.body);

test.describe('applying to a statutory event', () => {
    test.beforeEach(({ me }) => {
        // The primary body comes first, AEGEE-Beta can't send anyone.
        me!.bodies = [ZULU, BETA, ALPHA];
        me!.primary_body_id = 1;
    });

    test('a member fills in the form and applies', async ({ page, api }) => {
        mockEvent(api);
        api.on('POST statutory /events/:id/applications', { json: ok(statutoryApplication({ id: 77 })) });
        mockApplication(api, singleStatutoryApplication({ id: 77 }));
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(page.getByRole('heading', { name: 'Apply to Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Apply for statutory event');
        const bodySelect = field(page, 'combobox', 'Body');
        await expect(bodySelect.getByRole('option')).toHaveText(['AEGEE-Zulu', 'AEGEE-Alpha']);
        await expect(bodySelect).toHaveValue('1');

        // Answers start empty, at 0, unticked and at the first value.
        await expect(field(page, 'textbox', 'Tell us about yourself')).toHaveValue('');
        await expect(field(page, 'textbox', 'Why do you want to go?')).toHaveValue('');
        await expect(field(page, 'spinbutton', 'How many Agorae did you attend?')).toHaveValue('0');
        await expect(field(page, 'checkbox', 'I agree to share my contacts')).not.toBeChecked();
        await expect(field(page, 'combobox', 'T-shirt size')).toHaveValue('S');
        await expect(field(page, 'spinbutton', 'Number of Agorae visited')).toHaveValue('0');
        await expect(field(page, 'combobox', 'Meals type').getByRole('option')).toHaveText(['Vegetarian', 'Vegan', 'Meat-eater']);
        await expect(page.getByText('This event is fully vegetarian!')).toBeHidden();

        await bodySelect.selectOption('AEGEE-Alpha');
        await fillRequired(page);
        await field(page, 'textbox', 'Allergies').fill('Nuts');
        await field(page, 'spinbutton', 'Number of Agorae visited').fill('3');
        await field(page, 'spinbutton', 'How many Agorae did you attend?').fill('2');
        await field(page, 'checkbox', 'I agree to share my contacts').check();
        await field(page, 'combobox', 'T-shirt size').selectOption('M');
        await saveButton(page).click();

        await expect(toast(page, 'Application is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/77');
        // Only what the form asks for.
        expect(posts(api)).toEqual([{
            body_id: 3,
            nationality: 'Belgian',
            meals: 'Vegan',
            allergies: 'Nuts',
            number_of_events_visited: 3,
            visa_required: false,
            answers: ['I organise events', 'To learn', 2, true, 'M']
        }]);
    });

    test('ticking mailing lists also subscribes to them', async ({ page, api, me }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', { json: ok(statutoryApplication({ id: 77 })) });
        api.json('POST core /members/:id/listserv', ok({}));
        mockApplication(api, singleStatutoryApplication({ id: 77 }));
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(page.getByText(`you will get an email at ${me!.notification_email}`)).toBeHidden();
        await page.getByRole('checkbox', { name: /^Subscribe to ANNOUNCE-L/ }).check();
        await page.getByRole('checkbox', { name: /^Subscribe to AEGEENEWS-L/ }).check();
        await expect(page.getByText(`If the request was successful, you will get an email at ${me!.notification_email} to confirm your subscription.`)).toBeVisible();
        await expect(page.getByRole('link', { name: 'click here' })).toHaveAttribute('href', '/pages/mailing-lists');
        await field(page, 'combobox', 'Nationality').selectOption('Belgian');
        await saveButton(page).click();

        await expect(toast(page, 'Application is saved. Check your email to confirm your subscription to the mailing lists.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/77');
        expect(api.callsTo('POST core /members/:id/listserv').map((call) => [call.params.id, call.body]))
            .toEqual([['2', { mailinglists: ['ANNOUNCE-L', 'AEGEENEWS-L'] }]]);
    });

    test('a failing subscription still saves the application', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', { json: ok(statutoryApplication({ id: 77 })) });
        api.on('POST core /members/:id/listserv', { status: 500, json: { success: false, message: 'Listserv is down' } });
        mockApplication(api, singleStatutoryApplication({ id: 77 }));
        await page.goto('/statutory/agora-spring/applications/new');

        await page.getByRole('checkbox', { name: /^Subscribe to AEGEE-L/ }).check();
        await field(page, 'combobox', 'Nationality').selectOption('Belgian');
        await saveButton(page).click();

        await expect(toast(page, 'Application is saved, but subscribing to mailing lists failed.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/77');
    });

    test('a vegetarian event offers no meat', async ({ page, api }) => {
        mockEvent(api, agora({ vegetarian: true }));
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(page.getByText('This event is fully vegetarian!')).toBeVisible();
        await expect(field(page, 'combobox', 'Meals type').getByRole('option')).toHaveText(['Vegetarian', 'Vegan']);
    });

    for (const [type, label] of [['epm', 'Number of EPMs visited'], ['spm', 'Number of SPMs visited']] as const) {
        test(`the form asks how many ${type.toUpperCase()}s the member visited`, async ({ page, api }) => {
            mockEvent(api, agora({ type, url: `${type}-spring` }));
            await page.goto(`/statutory/${type}-spring/applications/new`);

            await expect(field(page, 'spinbutton', label)).toHaveValue('0');
        });
    }

    test('a visa needs the ten visa fields, which are emptied when it is not needed after all', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', { json: ok(statutoryApplication({ id: 77 })) });
        mockApplication(api, singleStatutoryApplication({ id: 77 }));
        await page.goto('/statutory/agora-spring/applications/new');
        await expect(field(page, 'textbox', 'Passport number')).toHaveCount(0);

        await page.getByRole('checkbox', { name: 'Visa required?' }).check();
        for (const [label] of VISA_FIELDS) {
            await expect(field(page, 'textbox', label)).toHaveJSProperty('required', true);
        }
        await field(page, 'textbox', 'Passport number').fill('AB123456');
        await field(page, 'textbox', 'City').fill('Brussels');

        await page.getByRole('checkbox', { name: 'Visa required?' }).uncheck();
        await expect(field(page, 'textbox', 'Passport number')).toHaveCount(0);
        await page.getByRole('checkbox', { name: 'Visa required?' }).check();
        await expect(field(page, 'textbox', 'Passport number')).toHaveValue('');
        await page.getByRole('checkbox', { name: 'Visa required?' }).uncheck();

        await field(page, 'combobox', 'Nationality').selectOption('Belgian');
        await saveButton(page).click();

        await expect(page).toHaveURL('/statutory/agora-spring/applications/77');
        expect(posts(api)).toEqual([{
            body_id: 1,
            nationality: 'Belgian',
            meals: '',
            allergies: '',
            number_of_events_visited: 0,
            visa_required: false,
            ...Object.fromEntries(VISA_FIELDS.map(([, key]) => [key, ''])),
            answers: []
        }]);
    });

    test('the browser asks for required answers before sending', async ({ page, api }) => {
        mockEvent(api);
        await page.goto('/statutory/agora-spring/applications/new');

        await field(page, 'textbox', 'Tell us about yourself').fill('I organise events');
        await saveButton(page).click();

        expect(await field(page, 'textbox', 'Why do you want to go?').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        expect(posts(api)).toEqual([]);
    });

    test('a member of no body that may send anyone is told so and can\'t apply', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [], permissions: statutoryEventPermissions({ apply_from_body: { 1: false, 2: false, 3: false } }) }));
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(page.getByText('You are not a member of any body, therefore you cannot apply.')).toBeVisible();
        await expect(field(page, 'combobox', 'Body')).toHaveCount(0);
        await saveButton(page).click();

        await expect(toast(page, 'Please select a body.')).toBeVisible();
        expect(posts(api)).toEqual([]);
    });

    test('a banned member sees until when and gets no form', async ({ page, api, me }) => {
        await freezeTime(page);
        me!.event_application_ban = { ban_until: '2027-03-05T09:00:00.000Z' };
        mockEvent(api);
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(page.getByText('You are temporarily banned from submitting new event applications until 2027-03-05 10:00.')).toBeVisible();
        await expect(saveButton(page)).toBeHidden();
    });

    test('a ban that is over doesn\'t stop the member', async ({ page, api, me }) => {
        await freezeTime(page);
        me!.event_application_ban = { ban_until: '2027-02-20T09:00:00.000Z' };
        mockEvent(api);
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(saveButton(page)).toBeVisible();
        await expect(page.getByText(/You are temporarily banned/)).toHaveCount(0);
    });

    test('outside the application period the form says that applications are closed', async ({ page, api }) => {
        mockEvent(api, agora({ permissions: statutoryEventPermissions({ apply: false }) }));
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(page.getByRole('heading', { name: 'Apply to Agora Spring' })).toBeVisible();
        await expect(page.getByText('You cannot apply to this event: applications are not open.')).toBeVisible();
        await expect(saveButton(page)).toBeHidden();
    });

    test('shows why statutory refused the application', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', {
            status: 422,
            json: validationError({
                answers: ['Answer number 1 ("Tell us about yourself") is empty.'],
                body_id: ['Body should be set.'],
                gender: ['Gender should be set.'],
                date_of_birth: ['Date of birth should be set.'],
                nationality: ['Nationality should be set.'],
                meals: ['Meals should be one of these: Meat-eater, Vegetarian, Vegan.'],
                number_of_events_visited: ['Number of events visited should be set.'],
                user_id: ['There\'s already an application with such user ID for this event.']
            })
        });
        await page.goto('/statutory/agora-spring/applications/new');

        await saveButton(page).click();

        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        await expect(page.getByText('Could not apply because of these reasons:')).toBeVisible();
        for (const reason of [
            'Answer number 1 ("Tell us about yourself") is empty.',
            'Body should be set.',
            'Please set the gender in your profile.',
            'Please set the date of birth in your profile.',
            'Number of events visited should be set.',
            'There\'s already an application with such user ID for this event.'
        ]) {
            await expect(page.getByRole('listitem').filter({ hasText: reason })).toBeVisible();
        }
        await expect(page.getByRole('link', { name: 'your profile.' })).toHaveCount(2);
        await expect(page.getByRole('link', { name: 'your profile.' }).first()).toHaveAttribute('href', '/members/me');
        await expect(page.getByText('Nationality should be set.')).toBeVisible();
        await expect(page.getByText('Meals should be one of these: Meat-eater, Vegetarian, Vegan.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/new');
    });

    test('after the deadline statutory refuses the application', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', {
            status: 403, json: forbidden('The deadline for applications has passed or the applications period hasn\'t started yet.')
        });
        await page.goto('/statutory/agora-spring/applications/new');

        await field(page, 'combobox', 'Nationality').selectOption('Belgian');
        await saveButton(page).click();

        await expect(toast(page, 'Could not save application: The deadline for applications has passed or the applications period hasn\'t started yet.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/new');
    });

    test('an event that went back to a draft accepts no application', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', { status: 403, json: forbidden('You cannot apply to this event, as it is not published yet.') });
        await page.goto('/statutory/agora-spring/applications/new');

        await field(page, 'combobox', 'Nationality').selectOption('Belgian');
        await saveButton(page).click();

        await expect(toast(page, 'Could not save application: You cannot apply to this event, as it is not published yet.')).toBeVisible();
        await expect(saveButton(page)).toBeVisible();
    });

    test('the save button waits for the answer, so an application is sent once', async ({ page, api }) => {
        mockEvent(api, agora({ questions: [] }));
        api.on('POST statutory /events/:id/applications', { json: ok(statutoryApplication({ id: 77 })), delayMs: 1000 });
        mockApplication(api, singleStatutoryApplication({ id: 77 }));
        await page.goto('/statutory/agora-spring/applications/new');

        await field(page, 'combobox', 'Nationality').selectOption('Belgian');
        await saveButton(page).click();

        await expect(saveButton(page)).toBeDisabled();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/77');
        expect(posts(api)).toHaveLength(1);
    });

    test('the new application has no board part', async ({ page, api }) => {
        mockEvent(api, agora({ permissions: statutoryManagerPermissions({ set_board_comment_and_participant_type: { global: true, 1: true } }) }));
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(saveButton(page)).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Board comment' })).toBeHidden();
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/applications/new');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('a failing service goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/applications/new');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});

test.describe('editing an application to a statutory event', () => {
    const OWN = singleStatutoryApplication({
        id: 12,
        user_id: 2,
        body_id: 1,
        body_name: 'AEGEE-Zulu',
        nationality: 'Belgian',
        meals: 'Vegetarian',
        allergies: 'Nuts',
        number_of_events_visited: 2,
        answers: ['I organise events', 'To learn', 1, false, 'L'],
        editable_bodies: [ZULU, ALPHA]
    });

    test.beforeEach(({ me }) => {
        me!.bodies = [ZULU, ALPHA];
        me!.primary_body_id = 1;
    });

    test('the applicant changes their application', async ({ page, api }) => {
        mockEvent(api);
        mockApplication(api, OWN);
        api.on('PUT statutory /events/:id/applications/:application_id', { json: ok(statutoryApplication({ id: 12 })) });
        await page.goto('/statutory/agora-spring/applications/12/edit');

        await expect(page.getByRole('heading', { name: 'Edit application on Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Manage application for statutory event');
        await expect(field(page, 'combobox', 'Body').getByRole('option')).toHaveText(['AEGEE-Zulu', 'AEGEE-Alpha']);
        await expect(field(page, 'combobox', 'Body')).toHaveValue('1');
        await expect(field(page, 'combobox', 'Nationality')).toHaveValue('Belgian');
        await expect(field(page, 'combobox', 'Meals type')).toHaveValue('Vegetarian');
        await expect(field(page, 'textbox', 'Allergies')).toHaveValue('Nuts');
        await expect(field(page, 'spinbutton', 'Number of Agorae visited')).toHaveValue('2');
        await expect(field(page, 'textbox', 'Why do you want to go?')).toHaveValue('To learn');
        await expect(field(page, 'combobox', 'T-shirt size')).toHaveValue('L');
        // The applicant's own mailing lists.
        await expect(page.getByRole('checkbox', { name: /^Subscribe to ANNOUNCE-L/ })).toBeVisible();

        await field(page, 'textbox', 'Allergies').fill('Peanuts');
        await saveButton(page).click();

        await expect(toast(page, 'Application is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/12');
        // Only the fields of the form, not the rest of what the page got.
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id').map((call) => [call.params.application_id, call.body])).toEqual([[
            '12',
            {
                body_id: 1,
                nationality: 'Belgian',
                meals: 'Vegetarian',
                allergies: 'Peanuts',
                number_of_events_visited: 2,
                visa_required: false,
                ...Object.fromEntries(VISA_FIELDS.map(([, key]) => [key, null])),
                answers: ['I organise events', 'To learn', 1, false, 'L']
            }
        ]]);
    });

    test('a manager edits someone else\'s application without their mailing lists', async ({ page, api }) => {
        mockEvent(api, agora({ permissions: statutoryManagerPermissions() }));
        mockApplication(api, singleStatutoryApplication({ ...OWN, user_id: 7, first_name: 'Jan', last_name: 'Jansen' }, statutoryManagerPermissions()));
        await page.goto('/statutory/agora-spring/applications/12/edit');

        // Their primary body isn't known, so the bodies are in alphabetical order.
        await expect(field(page, 'combobox', 'Body').getByRole('option')).toHaveText(['AEGEE-Alpha', 'AEGEE-Zulu']);
        await expect(page.getByText('Mailing Lists', { exact: true })).toBeHidden();
        await expect(page.getByRole('checkbox', { name: /^Subscribe to ANNOUNCE-L/ })).toBeHidden();
    });

    test('an application that may not be edited any more is shown instead', async ({ page, api }) => {
        mockEvent(api);
        mockApplication(api, singleStatutoryApplication({ ...OWN }, { edit_application: false }));
        await page.goto('/statutory/agora-spring/applications/12/edit');

        await expect(toast(page, 'You cannot edit this application.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/applications/12');
    });

    test('an unknown application goes back to the event', async ({ page, api }) => {
        api.fallback(mockEverything);
        mockEvent(api);
        api.on('GET statutory /events/:id/applications/:application_id', { status: 404, json: notFound('This user haven\'t applied to this event yet.') });
        await page.goto('/statutory/agora-spring/applications/99/edit');

        await expect(toast(page, 'Application is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
    });

    test('an application that can\'t be loaded goes back to the event', async ({ page, api }) => {
        api.fallback(mockEverything);
        mockEvent(api);
        api.on('GET statutory /events/:id/applications/:application_id', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/applications/12/edit');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
    });

    test.describe('the board\'s part', () => {
        const boardPermissions = { set_board_comment_and_participant_type: { global: true, 1: true } };

        test('who approves members of every body sets the type, order and comment', async ({ page, api }) => {
            mockEvent(api, agora({ permissions: statutoryManagerPermissions(boardPermissions) }));
            mockApplication(api, singleStatutoryApplication({ ...OWN, user_id: 7, board_comment: null }, { ...statutoryManagerPermissions(boardPermissions) }));
            api.json('PUT statutory /events/:id/applications/:application_id/board', ok(statutoryApplication()));
            await page.goto('/statutory/agora-spring/applications/12/edit');

            await page.getByRole('textbox', { name: 'Board comment' }).fill('Active in the antenna');
            await page.getByRole('combobox', { name: 'Application type' }).selectOption('Delegate');
            await page.getByRole('spinbutton', { name: 'Participant order' }).fill('1');
            await page.getByRole('button', { name: 'Save board information' }).click();

            await expect(toast(page, 'Application is saved.')).toBeVisible();
            expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/board').map((call) => [call.params.application_id, call.body]))
                .toEqual([['12', { participant_type: 'delegate', participant_order: 1, board_comment: 'Active in the antenna' }]]);
            // Saving the board's part doesn't send the application.
            expect(api.callsTo('PUT statutory /events/:id/applications/:application_id')).toHaveLength(0);
        });

        test('shows why statutory refused the board\'s part', async ({ page, api }) => {
            mockEvent(api, agora({ permissions: statutoryManagerPermissions(boardPermissions) }));
            mockApplication(api, singleStatutoryApplication({ ...OWN, user_id: 7 }, { ...statutoryManagerPermissions(boardPermissions) }));
            api.on('PUT statutory /events/:id/applications/:application_id/board', {
                status: 422,
                json: validationError({ participantTypeShouldBeSetWithOrder: ['Participant type should be set together with participant order.'] })
            });
            await page.goto('/statutory/agora-spring/applications/12/edit');

            await page.getByRole('combobox', { name: 'Application type' }).selectOption('Delegate');
            await page.getByRole('button', { name: 'Save board information' }).click();

            await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
            await expect(page.getByText('Participant type should be set together with participant order.')).toBeVisible();
        });

        test('a body over its limit is refused', async ({ page, api }) => {
            mockEvent(api, agora({ permissions: statutoryManagerPermissions(boardPermissions) }));
            mockApplication(api, singleStatutoryApplication({ ...OWN, user_id: 7 }, { ...statutoryManagerPermissions(boardPermissions) }));
            api.on('PUT statutory /events/:id/applications/:application_id/board', {
                status: 403, json: forbidden('Too much applications for body #1 for type "delegate": expected 3, got 4.')
            });
            await page.goto('/statutory/agora-spring/applications/12/edit');

            await page.getByRole('combobox', { name: 'Application type' }).selectOption('Delegate');
            await page.getByRole('spinbutton', { name: 'Participant order' }).fill('4');
            await page.getByRole('button', { name: 'Save board information' }).click();

            await expect(toast(page, 'Could not save application: Too much applications for body #1 for type "delegate": expected 3, got 4.')).toBeVisible();
        });

        test('the applicant doesn\'t get it', async ({ page, api }) => {
            mockEvent(api);
            mockApplication(api, OWN);
            await page.goto('/statutory/agora-spring/applications/12/edit');

            await expect(saveButton(page)).toBeVisible();
            await expect(page.getByRole('textbox', { name: 'Board comment' })).toBeHidden();
            await expect(page.getByRole('button', { name: 'Save board information' })).toBeHidden();
        });
    });
});
