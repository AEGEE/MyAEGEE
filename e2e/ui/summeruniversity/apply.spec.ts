// Applying to a Summer University (/summeruniversity/:id/applications/:application_id): the
// form for a new or open application, and the read-only view once the member may not apply any
// more.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { badRequest, forbidden, iso, notFound, ok, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import {
    suApplication, suApplicationPermissions, suEventFull, suPermissions, VISA_DETAILS,
    type SuApplication, type SuApplicationPermissions, type SuEventFull, type SuPermissions
} from '../support/factories/summeruniversity.ts';
import { dialog, openMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// What the service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';
const NO_SPOTS_LEFT = 'There are no spots left: the event already has max_participants accepted participants.';
const BUSY = 'Another change to this event is in progress. Please try again.';

const mountains = (overrides: Partial<SuEventFull> = {}) => suEventFull({
    id: 21, name: 'Mountains and Languages', url: 'mountains', locations: [], questions: [{ name: '', description: 'Why this SU?', required: true }], ...overrides
});

// The SU, and no application of the member yet.
const newApplication = (api: ApiMock, event: SuEventFull = mountains(), permissions: SuPermissions = suPermissions()) => {
    api.json('GET summeruniversity /single/:id', ok(event, { permissions }));
    api.on('GET summeruniversity /single/:id/applications/:application_id', { status: 404, json: notFound('Application with id me not found') });
};

// The SU and the member's application to it.
const existingApplication = (api: ApiMock, application: SuApplication, permissions: SuApplicationPermissions, event: SuEventFull = mountains()) => {
    api.json('GET summeruniversity /single/:id', ok(event, { permissions: suPermissions({ apply: permissions.apply, see_own_application: true }) }));
    api.json('GET summeruniversity /single/:id/applications/:application_id', ok(application, { permissions }));
};

// The list the page sends the member back to.
const mockList = (api: ApiMock) => {
    api.json('GET summeruniversity /seasons', ok([]));
    api.json('GET summeruniversity /', ok([]));
};

const PRIVACY = /I agree with my personal data to be processed/;
const SU_TERMS = /I confirm that I have read and understood the regulations/;

// Ticks or unticks one of the two consents. Buefy hides the box itself under its text, which is
// what a member clicks.
const toggle = async (page: Page, name: RegExp, checked: boolean) => {
    await page.getByText(name).click();
    await expect(page.getByRole('checkbox', { name })).toBeChecked({ checked });
};

// Fills in every field the form requires, besides the visa.
const fillRequired = async (page: Page) => {
    await page.getByRole('combobox', { name: /^Nationality/ }).selectOption('Belgian');
    await page.getByRole('combobox', { name: /^Travelling from/ }).selectOption('Belgium');
    await page.getByRole('combobox', { name: /^Meals type/ }).selectOption('Vegan');
    await page.getByRole('textbox', { name: /^AEGEE experience/ }).fill('Two local trainings');
    await page.getByRole('textbox', { name: /^Ideal SU/ }).fill('Mountains and new friends');
    await page.getByRole('textbox', { name: /^Motivation/ }).fill('I want to learn a language');
    await page.getByRole('textbox', { name: /^Why this SU\?/ }).fill('Because of the mountains');
    await toggle(page, PRIVACY, true);
    await toggle(page, SU_TERMS, true);
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The value in the read-only table next to a label.
const answer = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('cell', { name: label }) })
    .getByRole('cell')
    .filter({ hasNotText: new RegExp(`^${escape(label)}\\*?$`) });

test.describe('applying to a Summer University', () => {
    test('a member fills in the form and applies', async ({ page, api }) => {
        newApplication(api);
        api.json('POST summeruniversity /single/:id/applications', { success: true, message: 'Application is created.', data: suApplication() });

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByRole('heading', { name: 'Apply to Mountains and Languages' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: /^Body/ })).toHaveValue('1');
        await fillRequired(page);
        await page.getByRole('textbox', { name: 'Allergies' }).fill('Nuts');
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Your application was saved, you can still edit it until the application period ends')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/mountains');
        expect(api.callsTo('POST summeruniversity /single/:id/applications').map((call) => [call.params, call.body])).toEqual([[{ id: 'mountains' }, {
            body: null,
            body_id: 1,
            user: null,
            user_id: null,
            id: null,
            visa_required: false,
            nationality: 'Belgian',
            travelling_from: 'Belgium',
            meals: 'Vegan',
            allergies: 'Nuts',
            aegee_experience: 'Two local trainings',
            ideal_su: 'Mountains and new friends',
            motivation: 'I want to learn a language',
            answers: ['Because of the mountains'],
            agreed_to_privacy_policy: true,
            agreed_to_su_terms: true
        }]]);
    });

    test('after applying to an SU without an address of its own, its page is reached by its id', async ({ page, api }) => {
        newApplication(api, mountains({ url: null }));
        api.json('POST summeruniversity /single/:id/applications', { success: true, message: 'Application is created.', data: suApplication() });

        await page.goto('/summeruniversity/21/applications/me');
        await fillRequired(page);
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page).toHaveURL('/summeruniversity/21');
    });

    test('only antennae and contacts can be applied from, the primary body first', async ({ page, api, me }) => {
        me!.bodies = [
            body({ id: 1, name: 'AEGEE-Antenna', type: 'antenna' }),
            body({ id: 3, name: 'AEGEE-Contact', type: 'contact' }),
            body({ id: 4, name: 'AEGEE-Contact Antenna', type: 'contact antenna' }),
            body({ id: 9, name: 'Working Group', type: 'working group' })
        ];
        me!.primary_body_id = 4;
        newApplication(api);

        await page.goto('/summeruniversity/mountains/applications/me');

        const bodies = page.getByRole('combobox', { name: /^Body/ });
        await expect(bodies).toHaveValue('4');
        await expect(bodies.getByRole('option')).toHaveText(['AEGEE-Contact Antenna', 'AEGEE-Antenna', 'AEGEE-Contact']);
    });

    test.describe('without a body to apply from', () => {
        test.use({ session: 'superadmin' });

        test('the member is told to join one, and can\'t send the form', async ({ page, api, me }) => {
            me!.bodies = [];
            me!.primary_body_id = null;
            newApplication(api);

            await page.goto('/summeruniversity/mountains/applications/me');

            await expect(page.getByText('You are not a member of any body, therefore you cannot apply.')).toBeVisible();
            await expect(page.getByRole('combobox', { name: /^Body/ })).toBeHidden();
            await fillRequired(page);
            await page.getByRole('button', { name: 'Save application!' }).click();

            await expect(toast(page, 'Please select a body.')).toBeVisible();
            expect(api.callsTo('POST summeruniversity /single/:id/applications')).toEqual([]);
        });
    });

    test('"Visa required?" asks for the passport and the address', async ({ page, api }) => {
        newApplication(api);
        api.json('POST summeruniversity /single/:id/applications', { success: true, message: 'Application is created.', data: suApplication() });

        await page.goto('/summeruniversity/mountains/applications/me');
        await fillRequired(page);
        await expect(page.getByRole('textbox', { name: /^Passport number/ })).toHaveCount(0);

        await page.getByRole('checkbox', { name: 'Visa required?' }).check();
        const visa: [RegExp, string][] = [
            [/^Passport number/, 'X0000000'],
            [/^Passport issue date/, '2025-01-01'],
            [/^Passport expiration date/, '2035-01-01'],
            [/^Passport issue authority/, 'Test authority'],
            [/^Place of birth/, 'Testville'],
            [/^Embassy/, 'Test embassy'],
            [/^Street and house number/, 'Example street 1'],
            [/^Postal code/, '0000'],
            [/^City/, 'Testville'],
            [/^Country/, 'Testland']
        ];
        for (const [label] of visa) {
            await expect(page.getByRole('textbox', { name: label })).toHaveAttribute('required');
        }
        // A required field left empty keeps the form from being sent.
        await page.getByRole('button', { name: 'Save application!' }).click();
        expect(api.callsTo('POST summeruniversity /single/:id/applications')).toEqual([]);

        for (const [label, value] of visa) {
            await page.getByRole('textbox', { name: label }).fill(value);
        }
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page).toHaveURL('/summeruniversity/mountains');
        expect(api.callsTo('POST summeruniversity /single/:id/applications').map((call) => call.body)).toEqual([expect.objectContaining({
            visa_required: true,
            visa_passport_number: 'X0000000',
            visa_passport_issue_date: '2025-01-01',
            visa_passport_expiration_date: '2035-01-01',
            visa_passport_issue_authority: 'Test authority',
            visa_place_of_birth: 'Testville',
            visa_embassy: 'Test embassy',
            visa_street_and_house: 'Example street 1',
            visa_postal_code: '0000',
            visa_city: 'Testville',
            visa_country: 'Testland'
        })]);
    });

    test('the browser asks for the required texts and both consents', async ({ page, api }) => {
        newApplication(api);

        await page.goto('/summeruniversity/mountains/applications/me');
        for (const label of [/^AEGEE experience/, /^Ideal SU/, /^Motivation/, /^Why this SU\?/]) {
            await expect(page.getByRole('textbox', { name: label })).toHaveAttribute('required');
        }

        await fillRequired(page);
        await toggle(page, SU_TERMS, false);
        await page.getByRole('button', { name: 'Save application!' }).click();
        await toggle(page, PRIVACY, false);
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page.getByRole('heading', { name: 'Apply to Mountains and Languages' })).toBeVisible();
        expect(api.callsTo('POST summeruniversity /single/:id/applications')).toEqual([]);
    });

    test('the service\'s reasons are shown in the list and at their fields', async ({ page, api }) => {
        newApplication(api);
        api.on('POST summeruniversity /single/:id/applications', {
            status: 422,
            json: validationError({
                answers: ['Expected 1 answers, but got 0.'],
                body_id: ['Body should be set.'],
                nationality: ['Nationality should be set.'],
                travelling_from: ['Travelling from should be set.'],
                meals: ['Meals should be set.'],
                aegee_experience: ['This text should be at most 255 characters long.'],
                ideal_su: ['This text should be at most 255 characters long.'],
                motivation: ['This text should be at most 255 characters long.'],
                agreed_to_privacy_policy: ['You should agree to Privacy Policy.']
            })
        });

        await page.goto('/summeruniversity/mountains/applications/me');
        await fillRequired(page);
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        const reasons = page.getByText('Could not apply because of these reasons:');
        await expect(reasons.getByRole('listitem')).toHaveText(['Expected 1 answers, but got 0.', 'Body should be set.']);
        for (const message of [
            'Nationality should be set.', 'Travelling from should be set.', 'Meals should be set.', 'You should agree to Privacy Policy.'
        ]) {
            await expect(page.getByText(message, { exact: true })).toBeVisible();
        }
        await expect(page.getByText('This text should be at most 255 characters long.', { exact: true })).toHaveCount(3);
        // The service never says anything about the profile here.
        await expect(page.getByRole('link', { name: 'your profile.' })).toHaveCount(0);
        await expect(page).toHaveURL('/summeruniversity/mountains/applications/me');
    });

    test('other errors when saving show the service\'s message', async ({ page, api }) => {
        newApplication(api);
        api.on('POST summeruniversity /single/:id/applications', { status: 403, json: forbidden('You are temporarily banned from applying to events.') });

        await page.goto('/summeruniversity/mountains/applications/me');
        await fillRequired(page);
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Could not save application: You are temporarily banned from applying to events.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeVisible();
    });

    test('a body the member is no longer in is refused', async ({ page, api }) => {
        newApplication(api);
        api.on('POST summeruniversity /single/:id/applications', { status: 400, json: badRequest('You are not a member of this body.') });

        await page.goto('/summeruniversity/mountains/applications/me');
        await fillRequired(page);
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Could not save application: You are not a member of this body.')).toBeVisible();
    });

    test('an application can be changed while the member may still apply', async ({ page, api }) => {
        existingApplication(api, suApplication({ id: 31, event_id: 21, motivation: 'I like walking', meals: 'Vegetarian', nationality: 'Belgian', travelling_from: 'Belgium' }), suApplicationPermissions({ apply: true }));
        api.json('PUT summeruniversity /single/:id/applications/:application_id', { success: true, message: 'Application is updated', data: suApplication({ id: 31 }) });

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByRole('heading', { name: 'Edit your application on Mountains and Languages' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /^Motivation/ })).toHaveValue('I like walking');
        await expect(page.getByRole('combobox', { name: /^Meals type/ })).toHaveValue('Vegetarian');
        await expect(page.getByRole('textbox', { name: /^Why this SU\?/ })).toHaveValue('Because of the mountains');
        await page.getByRole('textbox', { name: /^Motivation/ }).fill('I want to learn a language');
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Your application was saved, you can still edit it until the application period ends')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/mountains');
        expect(api.callsTo('POST summeruniversity /single/:id/applications')).toEqual([]);
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id').map((call) => [call.params, call.body])).toEqual([[
            { id: 'mountains', application_id: 'me' },
            expect.objectContaining({ id: 31, body_id: 1, motivation: 'I want to learn a language', meals: 'Vegetarian', answers: ['Because of the mountains'] })
        ]]);
    });

    test('after the deadline the application is shown read-only, with the visa and what is missing in the profile', async ({ page, api }) => {
        existingApplication(api, suApplication({
            ...VISA_DETAILS,
            visa_passport_issue_date: '2025-01-01',
            gender: null,
            date_of_birth: null,
            allergies: null,
            body_name: 'AEGEE-Antenna',
            nationality: 'Belgian',
            created_at: '2027-02-10T09:00:00.000Z',
            notification_email: 'alex.member@example.org'
        }), suApplicationPermissions({ apply: false, edit_application: false, set_application_cancelled: false }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByRole('heading', { name: 'See your application on Mountains and Languages' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
        await expect(page.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(answer(page, 'First Name')).toHaveText('Alex');
        await expect(answer(page, 'Gender')).toHaveText('Please set your gender in your profile');
        await expect(answer(page, 'Date of birth')).toHaveText('Please set your date of birth in your profile');
        await expect(answer(page, 'Nationality')).toHaveText('Belgian');
        await expect(answer(page, 'Application date')).toHaveText('2027-02-10');
        await expect(answer(page, 'Email address')).toHaveText('alex.member@example.org');
        await expect(answer(page, 'Visa required?')).toHaveText('Yes');
        await expect(answer(page, 'Visa passport number')).toHaveText('X0000000');
        await expect(answer(page, 'Visa passport issue date')).toHaveText('2025-01-01');
        await expect(answer(page, 'Visa street and house number')).toHaveText('Example street 1');
        await expect(answer(page, 'Visa country')).toHaveText('Testland');
        await expect(answer(page, 'Allergies')).toHaveText('-');
        await expect(answer(page, 'Motivation')).toHaveText('I want to learn a language');
        await expect(answer(page, 'Why this SU?')).toHaveText('Because of the mountains');
        await expect(page.getByText('You didn\'t need to fill in the application fields.')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Cancel application' })).toHaveCount(0);
    });

    test('the read-only view shows the profile values and leaves out the visa when none is needed', async ({ page, api }) => {
        existingApplication(api, suApplication({ gender: 'neutral', date_of_birth: '1999-05-01', allergies: 'Nuts' }), suApplicationPermissions({ apply: false }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(answer(page, 'Gender')).toHaveText('neutral');
        await expect(answer(page, 'Date of birth')).toHaveText('1999-05-01');
        await expect(answer(page, 'Allergies')).toHaveText('Nuts');
        await expect(answer(page, 'Visa required?')).toHaveText('No');
        await expect(page.getByRole('cell', { name: 'Visa passport number' })).toBeHidden();
    });

    for (const [status, notice] of [
        ['pending', 'Your application is being processed, please wait for the organisers to evaluate your application.'],
        ['accepted', 'Congratulations, you have been accepted to the event!'],
        ['rejected', 'Sorry, but you were not accepted to the event.']
    ] as const) {
        test(`a ${status} application says so`, async ({ page, api }) => {
            existingApplication(api, suApplication({ status }), suApplicationPermissions({ apply: false }));

            await page.goto('/summeruniversity/mountains/applications/me');

            await expect(page.getByText(notice)).toBeVisible();
        });
    }

    test('without questions the read-only view says none were needed', async ({ page, api }) => {
        existingApplication(api, suApplication({ answers: [] }), suApplicationPermissions({ apply: false }), mountains({ questions: [] }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByText('You didn\'t need to fill in the application fields.')).toBeVisible();
    });

    test('cancelling asks first and then says so', async ({ page, api }) => {
        existingApplication(api, suApplication({ id: 31 }), suApplicationPermissions({ apply: true }));
        api.json('PUT summeruniversity /single/:id/applications/:application_id/cancelled', ok(suApplication({ id: 31, cancelled: true })));

        await page.goto('/summeruniversity/mountains/applications/me');
        await page.getByRole('button', { name: 'Cancel application' }).click();

        const confirm = dialog(page, 'Cancel application');
        await expect(confirm).toContainText('Are you sure you want to cancel your application? You can uncancel it only during application period.');
        await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(confirm).toHaveCount(0);
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/cancelled')).toEqual([]);

        await page.getByRole('button', { name: 'Cancel application' }).click();
        await dialog(page, 'Cancel application').getByRole('button', { name: 'Cancel application' }).click();

        await expect(toast(page, 'Application is cancelled.')).toBeVisible();
        await expect(page.getByText('Your application is cancelled.')).toBeVisible();
        await expect(page.getByText('You can uncancel it till the application period ends.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Uncancel application' })).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/cancelled').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'mountains', application_id: '31' }, { cancelled: true }]]);
    });

    test('a cancelled application can be taken back without asking', async ({ page, api }) => {
        existingApplication(api, suApplication({ id: 31, cancelled: true }), suApplicationPermissions({ apply: true }));
        api.json('PUT summeruniversity /single/:id/applications/:application_id/cancelled', ok(suApplication({ id: 31, cancelled: false })));

        await page.goto('/summeruniversity/mountains/applications/me');
        await expect(page.getByText('Your application is cancelled.')).toBeVisible();
        await page.getByRole('button', { name: 'Uncancel application' }).click();

        await expect(toast(page, 'Application is uncancelled.')).toBeVisible();
        await expect(page.getByText('Your application is cancelled.')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Cancel application' })).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/cancelled').map((call) => call.body)).toEqual([{ cancelled: false }]);
    });

    test('taking a cancellation back when the SU is full shows why it was refused', async ({ page, api }) => {
        existingApplication(api, suApplication({ id: 31, status: 'accepted', cancelled: true }), suApplicationPermissions({ apply: true }));
        api.on('PUT summeruniversity /single/:id/applications/:application_id/cancelled', {
            status: 422, json: { ...validationError({ cancelled: [NO_SPOTS_LEFT] }), message: NO_SPOTS_LEFT }
        });

        await page.goto('/summeruniversity/mountains/applications/me');
        await page.getByRole('button', { name: 'Uncancel application' }).click();

        await expect(toast(page, `Could not cancel application: ${NO_SPOTS_LEFT}`)).toBeVisible();
        await expect(page.getByText('Your application is cancelled.')).toBeVisible();
    });

    test('a cancellation while another change is saved asks to try again', async ({ page, api }) => {
        existingApplication(api, suApplication({ id: 31 }), suApplicationPermissions({ apply: true }));
        api.on('PUT summeruniversity /single/:id/applications/:application_id/cancelled', { status: 503, json: { success: false, message: BUSY } });

        await page.goto('/summeruniversity/mountains/applications/me');
        await page.getByRole('button', { name: 'Cancel application' }).click();
        await dialog(page, 'Cancel application').getByRole('button', { name: 'Cancel application' }).click();

        await expect(toast(page, `Could not cancel application: ${BUSY}`)).toBeVisible();
        await expect(page.getByText('Your application is cancelled.')).toHaveCount(0);
    });

    test('a cancelled application without the permission shows no way back', async ({ page, api }) => {
        existingApplication(api, suApplication({ cancelled: true }), suApplicationPermissions({ apply: false, set_application_cancelled: false }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByText('Your application is cancelled.')).toBeVisible();
        await expect(page.getByText('You can uncancel it till the application period ends.')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Uncancel application' })).toHaveCount(0);
    });

    test('a member who may not apply is told so', async ({ page, api }) => {
        newApplication(api, mountains({ application_status: 'closed' }), suPermissions({ apply: false }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByText('You cannot apply to this event.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
    });

    test('a member who is banned can\'t apply', async ({ page, api, me }) => {
        me!.event_application_ban = { ban_until: iso(30), reason: 'No-show at the last SU' };
        newApplication(api);

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByText(/You are temporarily banned from submitting new event applications until \d{4}-\d{2}-\d{2} \d{2}:\d{2}/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
    });

    test('a banned member still manages an existing application', async ({ page, api, me }) => {
        me!.event_application_ban = { ban_until: iso(30), reason: 'No-show at the last SU' };
        existingApplication(api, suApplication(), suApplicationPermissions({ apply: true }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByRole('heading', { name: 'Edit your application on Mountains and Languages' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeVisible();
        await expect(page.getByText('You are temporarily banned')).toHaveCount(0);
    });

    test('an error loading the application goes back to the list', async ({ page, api }) => {
        api.json('GET summeruniversity /single/:id', ok(mountains(), { permissions: suPermissions() }));
        api.on('GET summeruniversity /single/:id/applications/:application_id', { status: 500, json: { success: false, message: DATABASE_DOWN } });
        mockList(api);

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(toast(page, `Some error happened: ${DATABASE_DOWN}`)).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('a network error loading the application goes back to the list', async ({ page, api }) => {
        api.json('GET summeruniversity /single/:id', ok(mountains(), { permissions: suPermissions() }));
        api.on('GET summeruniversity /single/:id/applications/:application_id', { abort: 'failed' });
        mockList(api);

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(toast(page, 'Some error happened: Network Error')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('an unknown Summer University goes back to the list', async ({ page, api }) => {
        let calls = 0;
        api.on('GET summeruniversity /single/:id', () => {
            calls += 1;
            return calls === 1
                ? { status: 404, json: notFound('Event with id nowhere not found') }
                : { status: 500, json: { success: false, message: DATABASE_DOWN } };
        });
        mockList(api);

        await page.goto('/summeruniversity/nowhere/applications/me');
        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');

        await page.goto('/summeruniversity/mountains/applications/me');
        await expect(toast(page, `Some error happened: ${DATABASE_DOWN}`)).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity');
    });

    test('the body of an application is named, also when the member has left it', async ({ page, api }) => {
        existingApplication(api, suApplication({ body_id: 99, body_name: 'AEGEE-Gone' }), suApplicationPermissions({ apply: false }));

        await page.goto('/summeruniversity/mountains/applications/me');

        await expect(page.getByRole('link', { name: 'AEGEE-Gone' })).toHaveAttribute('href', '/bodies/99');
        await expect(page.getByText('Loading...')).toHaveCount(0);
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
        await page.goto('/summeruniversity/mountains/applications/me');
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
