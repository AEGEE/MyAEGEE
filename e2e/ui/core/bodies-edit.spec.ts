// The body form (/bodies/new, /bodies/:id/edit): creating a body, editing one with global or
// local rights, the shadow circle, and what the page does with the service's errors.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { body, circle, permission } from '../support/factories/core.ts';
import { bodyDetail, type BodyDetail } from '../support/factories/core-bodies.ts';
import { permissionsFor, toast } from '../support/shell.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { test, expect } from '../support/test.ts';

const field = (page: Page, name: string | RegExp) => page.getByLabel(name);
const save = (page: Page) => page.getByRole('button', { name: 'Save body' });

// What the body page asks for besides the body and the permissions (which the form asked for
// already) once a body is saved and the form sends the member there: a body without a board.
const answerBodyPage = (api: ApiMock): void => {
    api.json('GET network /bodies/:id/boards/current', ok([]));
};

const editing = (api: ApiMock, data: BodyDetail, permissions: string[] = ['global:update:body']): void => {
    api.json('GET core /bodies/:id', ok(data));
    permissionsFor(api, 'bodies', data.id, permissions);
};

test.describe('creating a body', () => {
    test('shows an empty form without asking for a body', async ({ page, api }) => {
        await page.goto('/bodies/new');

        await expect(page.getByRole('heading', { name: 'Create body' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Create a body');
        await expect(field(page, 'Name')).toHaveValue('');
        await expect(field(page, 'Abbreviation (if applicable)')).toBeVisible();
        await expect(field(page, 'Founded at (if applicable)')).toBeVisible();
        await expect(field(page, 'Shadow circle')).toHaveCount(0);
        await expect.poll(() => api.callsTo('* core *').map((call) => call.path)).not.toContain('/bodies/new');
    });

    test('an antenna needs a founding date and has no abbreviation', async ({ page, api }) => {
        await page.goto('/bodies/new');
        await field(page, 'Type').selectOption('Antenna');

        await expect(field(page, 'Abbreviation (if applicable)')).toHaveCount(0);
        await expect(field(page, 'Founded at')).toBeVisible();
        await expect(page.getByText('Founded at (if applicable)')).toHaveCount(0);

        await field(page, 'Name').fill('AEGEE-Gent');
        await page.getByRole('textbox', { name: /^Description/ }).fill('Our antenna');
        await field(page, 'Body code').fill('GEN');
        await field(page, 'Email').fill('gent@example.com');
        await save(page).click();

        await expect(toast(page, 'Please set the founding date of the local.')).toBeVisible();
        expect(api.callsTo('POST core /bodies')).toHaveLength(0);
    });

    test('creates a working group and opens its page', async ({ page, api }) => {
        api.json('POST core /bodies', ok(body({ id: 42 })));
        editing(api, bodyDetail({ id: 42, name: 'IT Working Group', type: 'working group' }));
        answerBodyPage(api);

        await page.goto('/bodies/new');
        await field(page, 'Type').selectOption('Working group');
        await field(page, 'Name').fill('IT Working Group');
        await field(page, 'Abbreviation (if applicable)').fill('ITWG');
        await page.getByRole('textbox', { name: /^Description/ }).fill('We do **IT**');
        await expect(page.getByRole('region', { name: 'Preview of the description' }).getByText('IT', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await field(page, 'Body code').fill('ITW');
        await field(page, 'Email').fill('itwg@example.com');
        await field(page, 'Founded at (if applicable)').fill('1985-04-15');
        await field(page, 'Founded at (if applicable)').blur();
        // Only holders of the global right to update bodies may set them, and that is decided per body.
        await expect(field(page, 'Google Workspace account')).toBeDisabled();
        await expect(field(page, 'Google Group')).toBeDisabled();
        await save(page).click();

        await expect(toast(page, 'Body is saved.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/42');
        await expect.poll(() => api.callsTo('POST core /bodies').map((call) => call.body)).toEqual([{
            name: 'IT Working Group',
            abbreviation: 'ITWG',
            description: 'We do **IT**',
            task_description: '',
            id: null,
            code: 'ITW',
            email: 'itwg@example.com',
            gsuite_id: null,
            google_group: null,
            phone: null,
            address: null,
            postal_address: null,
            shadow_circle_id: null,
            shadow_circle: null,
            circles: [],
            type: 'working group',
            founded_at: '1985-04-15'
        }]);
    });

    test('the browser stops a body without a name or with a wrong code', async ({ page, api }) => {
        await page.goto('/bodies/new');
        await field(page, 'Type').selectOption('Working group');
        await page.getByRole('textbox', { name: /^Description/ }).fill('Something');
        await field(page, 'Email').fill('x@example.com');
        await field(page, 'Body code').fill('ABC');
        await save(page).click();

        await expect(field(page, 'Name')).toHaveJSProperty('validity.valueMissing', true);

        await field(page, 'Name').fill('A name');
        await field(page, 'Body code').fill('AB');
        await save(page).click();

        await expect(field(page, 'Body code')).toHaveJSProperty('validity.patternMismatch', true);
        expect(api.callsTo('POST core /bodies')).toHaveLength(0);
    });

    test('the browser stops a body without an email', async ({ page, api }) => {
        await page.goto('/bodies/new');
        await field(page, 'Type').selectOption('Working group');
        await field(page, 'Name').fill('A name');
        await page.getByRole('textbox', { name: /^Description/ }).fill('Something');
        await field(page, 'Body code').fill('ABC');
        await save(page).click();

        await expect(field(page, 'Email')).toHaveJSProperty('validity.valueMissing', true);
        expect(api.callsTo('POST core /bodies')).toHaveLength(0);
    });

    test('explains the task description when its information button is focused', async ({ page }) => {
        await page.goto('/bodies/new');
        await page.getByText('Task description (if applicable)').getByRole('button', { name: 'More information' }).focus();

        await expect(page.getByRole('tooltip')).toContainText('Only applicable to bodies that have Agora-elected positions');
    });
});

test.describe('the body form for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('sends the visitor to the login page first', async ({ page }) => {
        await page.goto('/bodies/1/edit');

        await expect(page).toHaveURL('/login?to=%2Fbodies%2F1%2Fedit');
    });
});

test.describe('editing a body', () => {
    test('loads the body into the form', async ({ page, api }) => {
        editing(api, bodyDetail({
            id: 1,
            type: 'working group',
            name: 'IT Working Group',
            abbreviation: 'ITWG',
            description: 'We do **IT**',
            task_description: 'Keeps the _servers_ running',
            code: 'ITW',
            country: 'Belgium',
            founded_at: '1999-05-01',
            email: 'itwg@example.com',
            gsuite_id: 'itwg@example.org',
            google_group: 'itwg-group@example.org',
            phone: '+32 000 00 00 00',
            address: 'Example Street 1',
            postal_address: 'PO Box 1',
            website: 'https://itwg.example.org'
        }));

        await page.goto('/bodies/1/edit');

        await expect(page.getByRole('heading', { name: 'Edit body' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Edit single body');
        await expect(field(page, 'Name')).toHaveValue('IT Working Group');
        await expect(field(page, 'Type')).toHaveValue('working group');
        await expect(field(page, 'Abbreviation (if applicable)')).toHaveValue('ITWG');
        await expect(page.getByRole('textbox', { name: /^Description/ })).toHaveValue('We do **IT**');
        await expect(page.getByRole('region', { name: 'Preview of the description' }).getByText('IT', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await expect(page.getByRole('textbox', { name: /^Task description/ })).toHaveValue('Keeps the _servers_ running');
        await expect(page.getByRole('region', { name: 'Preview of the task description' }).getByText('servers')).toHaveJSProperty('tagName', 'EM');
        await expect(field(page, 'Body code')).toHaveValue('ITW');
        await expect(field(page, 'Country')).toHaveValue('Belgium');
        await expect(field(page, 'Founded at (if applicable)')).toHaveValue('1999-05-01');
        await expect(field(page, 'Email')).toHaveValue('itwg@example.com');
        await expect(field(page, 'Google Workspace account')).toHaveValue('itwg@example.org');
        await expect(field(page, 'Google Group')).toHaveValue('itwg-group@example.org');
        await expect(field(page, 'Phone')).toHaveValue('+32 000 00 00 00');
        await expect(page.getByLabel('Address', { exact: true })).toHaveValue('Example Street 1');
        await expect(page.getByRole('textbox', { name: /^Postal address/ })).toHaveValue('PO Box 1');
        await expect(field(page, 'Website')).toHaveValue('https://itwg.example.org');
        for (const name of ['Type', 'Name', 'Abbreviation (if applicable)', 'Body code', 'Google Workspace account', 'Google Group']) {
            await expect(field(page, name), name).toBeEnabled();
        }
        await expect(page.getByText('Not set.')).toBeVisible();
    });

    test('a body without a founding date shows an empty date', async ({ page, api }) => {
        editing(api, bodyDetail({ id: 1, type: 'antenna', founded_at: null }));

        await page.goto('/bodies/1/edit');

        await expect(field(page, 'Name')).toHaveValue('AEGEE-Test 1');
        await expect(field(page, 'Founded at')).toHaveValue('');
    });

    test('a local body manager can change only some fields', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1, code: 'ANT', type: 'working group' })));
        api.on('GET core /bodies/:id/my_permissions', { json: ok([permission('local:update:body')]), delayMs: 3000 });
        const restricted = ['Type', 'Name', 'Abbreviation (if applicable)', 'Body code', 'Google Workspace account', 'Google Group'];

        await page.goto('/bodies/1/edit');

        // While the permissions are still being asked for: no moment in which they can be changed.
        await expect(field(page, 'Name')).toHaveValue('AEGEE-Test 1');
        for (const name of restricted) {
            expect(await field(page, name).isDisabled(), name).toBe(true);
        }
        expect(await field(page, 'Shadow circle').count()).toBe(0);

        await expect.poll(() => api.callsTo('GET core /bodies/:id/my_permissions').length).toBe(1);
        for (const name of restricted) {
            await expect(field(page, name), name).toBeDisabled();
        }
        await expect(field(page, 'Shadow circle')).toHaveCount(0);
    });

    test('picks and unsets the shadow circle', async ({ page, api }) => {
        const members = circle({ id: 51, body_id: 1, name: 'Members of AEGEE-Antenna', description: 'Everyone' });
        const board = circle({ id: 52, body_id: 1, name: 'Board of AEGEE-Antenna', description: 'The board' });
        editing(api, bodyDetail({ id: 1, code: 'ANT', circles: [members, board] }));
        api.json('PUT core /bodies/:id', ok(body({ id: 1 })));
        answerBodyPage(api);

        await page.goto('/bodies/1/edit');
        await field(page, 'Shadow circle').fill('board');
        await expect(page.getByRole('button', { name: /^Members of/ })).toHaveCount(0);
        await page.getByRole('button', { name: /^Board of AEGEE-Antenna/ }).click();

        const unset = page.getByRole('button', { name: 'Board of AEGEE-Antenna (Click to unset)' });
        await expect(unset).toBeVisible();
        await save(page).click();

        await expect(toast(page, 'Body is saved.')).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id')[0].body).toMatchObject({ shadow_circle_id: 52 });
    });

    test('unsetting the shadow circle sends none', async ({ page, api }) => {
        const shadow = circle({ id: 51, body_id: 1, name: 'Members of AEGEE-Antenna' });
        editing(api, bodyDetail({ id: 1, code: 'ANT', circles: [shadow], shadow_circle_id: 51, shadow_circle: shadow }));
        api.json('PUT core /bodies/:id', ok(body({ id: 1 })));
        answerBodyPage(api);

        await page.goto('/bodies/1/edit');
        await page.getByRole('button', { name: 'Members of AEGEE-Antenna (Click to unset)' }).click();

        await expect(page.getByText('Not set.')).toBeVisible();
        await save(page).click();
        await expect(toast(page, 'Body is saved.')).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id')[0].body).toMatchObject({ shadow_circle_id: null, shadow_circle: null });
    });

    test('a shadow circle of another body is refused', async ({ page, api }) => {
        editing(api, bodyDetail({ id: 1, code: 'ANT' }));
        api.on('PUT core /bodies/:id', { status: 422, json: validationError({ shadow_circle_id: ['The shadow circle should be a circle of this body.'] }) });

        await page.goto('/bodies/1/edit');
        await field(page, 'Shadow circle').click();
        await page.getByRole('button', { name: /^Members of AEGEE-Test 1/ }).click();
        await save(page).click();

        await expect(toast(page, 'Some of the body data is invalid.')).toBeVisible();
        await expect(page.getByText('The shadow circle should be a circle of this body.')).toBeVisible();
    });

    test('saves the changed fields and opens the body page', async ({ page, api }) => {
        const loaded = bodyDetail({ id: 1, code: 'ANT', type: 'antenna', name: 'AEGEE-Antenna', founded_at: '1985-04-15' });
        editing(api, loaded);
        api.on('PUT core /bodies/:id', { json: ok(body({ id: 1 })), delayMs: 500 });
        answerBodyPage(api);

        await page.goto('/bodies/1/edit');
        await expect(field(page, 'Name')).toHaveValue('AEGEE-Antenna');
        await field(page, 'Phone').fill('+32 000 00 00 01');
        await field(page, 'Founded at').fill('1986-01-02');
        await field(page, 'Founded at').blur();
        await save(page).click();

        await expect(save(page)).toBeDisabled();
        await expect(toast(page, 'Body is saved.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/1');
        const [put] = api.callsTo('PUT core /bodies/:id');
        expect(put.params).toEqual({ id: '1' });
        expect(put.body).toEqual({ ...JSON.parse(JSON.stringify(loaded)), phone: '+32 000 00 00 01', founded_at: '1986-01-02' });
    });

    test('clearing an optional founding date sends none', async ({ page, api }) => {
        editing(api, bodyDetail({ id: 1, code: 'ANT', type: 'working group', founded_at: '1999-05-01' }));
        api.json('PUT core /bodies/:id', ok(body({ id: 1 })));
        answerBodyPage(api);

        await page.goto('/bodies/1/edit');
        await expect(field(page, 'Founded at (if applicable)')).toHaveValue('1999-05-01');
        await field(page, 'Founded at (if applicable)').fill('');
        await field(page, 'Founded at (if applicable)').blur();
        await save(page).click();

        await expect(toast(page, 'Body is saved.')).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id')[0].body).toMatchObject({ founded_at: null });
    });

    test('clearing the optional fields sends none, which core accepts', async ({ page, api }) => {
        // Core refuses an empty text for these ("Phone must be set.", "GSuite ID must be a valid email.").
        editing(api, bodyDetail({
            id: 1, code: 'ANT', type: 'working group', phone: '+32 000 00 00 00', address: 'Example Street 1', gsuite_id: 'example-wg@aegee.eu', google_group: 'example-wg-group@aegee.eu'
        }));
        api.json('PUT core /bodies/:id', ok(body({ id: 1 })));
        answerBodyPage(api);

        await page.goto('/bodies/1/edit');
        for (const name of ['Phone', /^Address/, 'Google Workspace account', 'Google Group']) {
            await expect(field(page, name)).toBeEnabled();
            await field(page, name).fill('');
        }
        await save(page).click();

        await expect(toast(page, 'Body is saved.')).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id')[0].body).toMatchObject({ phone: null, address: null, gsuite_id: null, google_group: null });
    });

    test('shows the service\'s objections under the fields', async ({ page, api }) => {
        editing(api, bodyDetail({ id: 1, code: 'ANT', type: 'working group' }));
        // What the model of a body checks; the other fields have no validation.
        const others = {
            type: 'Type must be one of these: "antenna", "contact antenna", "contact", "interest group", "working group", "commission", "committee", "project", "partner", "external", "other".',
            description: 'Description must be set.',
            founded_at: 'Foundation date should be a valid date.',
            email: 'Email must be valid.',
            gsuite_id: 'GSuite ID must be a valid email.',
            google_group: 'Google Group must be a valid email.',
            phone: 'Phone must be set.',
            address: 'Address must be set.',
            website: 'The link should be a valid URL starting with http:// or https://.'
        };
        api.on('PUT core /bodies/:id', {
            status: 422,
            json: validationError({
                name: ['Name must be set.'],
                code: ['Code must be 3 letters long.', 'Code must contain only letters.'],
                ...Object.fromEntries(Object.entries(others).map(([key, message]) => [key, [message]]))
            })
        });

        await page.goto('/bodies/1/edit');
        await save(page).click();

        await expect(toast(page, 'Some of the body data is invalid.')).toBeVisible();
        await expect(page.getByText('Name must be set.')).toBeVisible();
        await expect(page.getByText('Code must be 3 letters long., Code must contain only letters.')).toBeVisible();
        for (const [key, message] of Object.entries(others)) {
            await expect(page.getByText(message, { exact: true }), key).toBeVisible();
        }
        await expect(save(page)).toBeEnabled();

        api.json('PUT core /bodies/:id', ok(body({ id: 1 })));
        answerBodyPage(api);
        await save(page).click();
        await expect(page).toHaveURL('/bodies/1');
    });

    test('says why the body could not be saved', async ({ page, api }) => {
        editing(api, bodyDetail({ id: 1, code: 'ANT' }));
        api.on('PUT core /bodies/:id', { status: 403, json: forbidden('Permission update:body is required, but not present.') });

        await page.goto('/bodies/1/edit');
        await save(page).click();

        await expect(toast(page, 'Could not save body: Permission update:body is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/1/edit');
    });

    test('an unknown body sends the member back to the list', async ({ page, api }) => {
        api.on('GET core /bodies/:id', { status: 404, json: notFound('Body is not found.') });
        api.json('GET core /bodies', ok([]));

        await page.goto('/bodies/9/edit');

        await expect(toast(page, 'Body is not found')).toBeVisible();
        await expect(page).toHaveURL('/bodies');
    });

    test('a failing body request sends the member back to the list', async ({ page, api }) => {
        api.on('GET core /bodies/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.json('GET core /bodies', ok([]));

        await page.goto('/bodies/1/edit');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/bodies');
    });

    test('failing permissions keep the form, with the restricted fields locked', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1, code: 'ANT', type: 'working group' })));
        api.on('GET core /bodies/:id/my_permissions', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });

        await page.goto('/bodies/1/edit');

        await expect(toast(page, 'Could not fetch your permissions for this body: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/1/edit');
        await expect(field(page, 'Name')).toHaveValue('AEGEE-Test 1');
        await expect(field(page, 'Name')).toBeDisabled();
        await expect(field(page, 'Shadow circle')).toHaveCount(0);
    });
});
