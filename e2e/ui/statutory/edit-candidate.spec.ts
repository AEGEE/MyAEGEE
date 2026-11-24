// Applying for a position of an Agora (/statutory/:id/positions/:position_id/apply) and editing
// a candidature (/statutory/:id/positions/:position_id/candidates/:candidate_id/edit): the form,
// what is sent, the candidature's picture, and where the member goes afterwards.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, unprocessable, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { candidate, position, type Candidate } from '../support/factories/statutory-candidates.ts';
import { statutoryEvent, statutoryImage } from '../support/factories/statutory-events.ts';
import { fillDate, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const PICTURE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/statutory/agora-logo.png'));
const XSS = '**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)';

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', type: 'antenna' });
const ZAGREB = body({ id: 20, name: 'AEGEE-Zagreb', type: 'contact antenna' });
const AACHEN = body({ id: 40, name: 'AEGEE-Aachen', type: 'contact' });
const WORKING_GROUP = body({ id: 30, name: 'Information Technology Interest Group', type: 'working group' });
const SECRETARIAT = body({ id: 50, name: 'AEGEE-Europe Secretariat', type: 'other' });

const NEW = '/statutory/agora-spring/positions/5/apply';
const OWN = '/statutory/agora-spring/positions/5/candidates/21/edit';

// The text fields of the form, by their label, with what the tests type.
const TEXTS = {
    studies: ['Studies', 'Economics'],
    attended_agorae: ['Attended Agorae', 'Agora Spring 2025'],
    attended_epm: ['Attended EPMs', 'EPM 2025'],
    attended_conferences: ['Attended European Events', 'A Summer University'],
    european_experience: ['European level experience', 'Speaker of a working group'],
    local_experience: ['Local level experience', 'President of my antenna'],
    related_experience: ['Position-related experience', 'Treasurer of my antenna'],
    external_experience: ['Non-AEGEE experience', 'Student council'],
    motivation: ['Motivation', 'I want to **help** the network.'],
    program: ['Program', 'More training for boards.']
} as const;
const TYPED = Object.fromEntries(Object.entries(TEXTS).map(([key, [, value]]) => [key, value]));

// Alex's own pending candidature for the Comité Directeur.
const ALEX: Candidate = candidate({
    id: 21,
    user_id: 2,
    position_id: 5,
    body_id: 1,
    body_name: 'AEGEE-Antenna',
    first_name: 'Alex',
    last_name: 'Member',
    date_of_birth: '1999-05-01',
    member_since: '2019-10-01',
    nationality: 'Belgian',
    languages: ['English', 'Latin'],
    ...TYPED,
    created_at: '2027-01-10T09:30:00.000Z',
    updated_at: '2027-01-10T09:30:00.000Z'
});

// The positions of the Agora, of which the form names the one applied for.
const answerPosition = (api: ApiMock): void => {
    api.json('GET statutory /events/:id/positions', ok([position({ id: 5, name: 'Comité Directeur' }), position({ id: 6, name: 'Juridical Commission' })]));
};

// The positions page the member lands on after saving (its own spec checks it).
const answerPositionsPage = (api: ApiMock, prefix = 'approved'): void => {
    api.json('GET core /bodies', ok([]));
    api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 1, url: 'agora-spring' })));
    api.json(`GET statutory /events/:id/positions/${prefix}`, ok([]));
    api.json('GET statutory /events/:id/positions/candidates/mine', ok([]));
};

const languages = (page: Page) => page.getByRole('textbox', { name: 'Add a language' });

const fillTexts = async (page: Page): Promise<void> => {
    for (const [label, value] of Object.values(TEXTS)) {
        await page.getByLabel(label, { exact: true }).fill(value);
    }
};

// Everything the browser checks itself, filled in.
const fillForm = async (page: Page): Promise<void> => {
    await page.getByLabel('Nationality').selectOption('Belgian');
    await languages(page).fill('English');
    await languages(page).press('Enter');
    await fillTexts(page);
    await page.getByRole('checkbox', { name: /I agree for all my above mentioned personal data/ }).check();
};

const save = (page: Page) => page.getByRole('button', { name: 'Save candidature' }).click();

test.describe('applying for a position', () => {
    test.beforeEach(({ me }) => {
        me!.date_of_birth = '1999-05-01';
        me!.created_at = '2019-10-01T10:00:00.000Z';
        me!.bodies = [ZAGREB, WORKING_GROUP, AACHEN, ANTENNA];
        me!.primary_body_id = ANTENNA.id;
    });

    test('the form is filled in from the member\'s profile', async ({ page, api }) => {
        answerPosition(api);
        await page.goto(NEW);

        await expect(page.getByRole('heading', { name: 'Apply for Comité Directeur' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Apply as a candidate');
        // The primary body first, then the others it may apply from; no working groups.
        await expect(page.getByLabel('Body').getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Aachen', 'AEGEE-Zagreb']);
        await expect(page.getByLabel('Body')).toHaveValue('1');
        await expect(page.getByLabel('Date of birth')).toHaveValue('1999-05-01');
        await expect(page.getByLabel('Member since')).toHaveValue('2019-10-01');
        await expect(page.getByText('You can upload candidature image after saving it.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Update candidature image' })).toHaveCount(0);
        await expect(page.getByText('To withdraw your candidature')).toHaveCount(0);
        await expect(page.getByText('You are not a member of any body')).toBeHidden();
        expect(api.callsTo('GET statutory /events/:id/positions').map((call) => call.params.id)).toEqual(['agora-spring']);
    });

    test('a member applies, and lands on the positions', async ({ page, api }) => {
        answerPosition(api);
        api.json('POST statutory /events/:id/positions/:position_id/candidates', ok(ALEX));
        answerPositionsPage(api);
        await page.goto(NEW);

        await page.getByLabel('Body').selectOption('AEGEE-Zagreb');
        await fillDate(page.getByLabel('Date of birth'), '1999-05-02');
        await fillDate(page.getByLabel('Member since'), '2019-11-01');
        await page.getByLabel('Nationality').selectOption('Belgian');
        // A language is added with Enter, a comma or Tab; Backspace in the empty field takes the last one away.
        await languages(page).fill(' English ');
        await languages(page).press('Enter');
        await languages(page).fill('Dutch');
        await languages(page).press(',');
        await languages(page).fill('Esperanto');
        await languages(page).press('Tab');
        await languages(page).press('Backspace');
        await expect(page.getByText('English', { exact: true })).toBeVisible();
        await expect(page.getByText('Esperanto', { exact: true })).toHaveCount(0);
        await fillTexts(page);
        await expect(page.getByRole('strong').filter({ hasText: 'help' })).toBeVisible();
        await page.getByRole('checkbox', { name: /I agree for all my above mentioned personal data/ }).check();
        await save(page);

        await expect(toast(page, 'Candidate is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/positions/approved');
        expect(api.callsTo('POST statutory /events/:id/positions/:position_id/candidates').map((call) => [call.params, call.body])).toEqual([[
            { id: 'agora-spring', position_id: '5' },
            {
                first_name: 'Alex',
                last_name: 'Member',
                date_of_birth: '1999-05-02',
                member_since: '2019-11-01',
                body_id: 20,
                // The primary body, which was chosen first; the service goes by body_id.
                body: ANTENNA,
                languages: ['English', 'Dutch'],
                nationality: 'Belgian',
                ...TYPED,
                agreed_to_privacy_policy: true
            }
        ]]);
    });

    test('the button is disabled while the candidature is saved', async ({ page, api }) => {
        answerPosition(api);
        api.on('POST statutory /events/:id/positions/:position_id/candidates', { json: ok(ALEX), delayMs: 1000 });
        answerPositionsPage(api);
        await page.goto(NEW);

        await fillForm(page);
        await save(page);

        await expect(page.getByRole('button', { name: 'Save candidature' })).toBeDisabled();
        await expect(toast(page, 'Candidate is saved.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/positions/:position_id/candidates')).toHaveLength(1);
    });

    test('a member without an antenna or contact is told why they can\'t apply', async ({ page, api, me }) => {
        // Members of the Secretariat use MyAEGEE too.
        me!.bodies = [SECRETARIAT, WORKING_GROUP];
        me!.primary_body_id = null;
        answerPosition(api);
        await page.goto(NEW);

        await expect(page.getByText('You are not a member of any body, therefore you cannot apply.')).toBeVisible();
        await expect(page.getByLabel('Body')).toBeHidden();
        await fillForm(page);
        await save(page);

        await expect(toast(page, 'Please select a body.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/positions/:position_id/candidates')).toHaveLength(0);
    });

    test('a member without a date of birth gives it before applying', async ({ page, api, me }) => {
        me!.date_of_birth = null;
        answerPosition(api);
        api.json('POST statutory /events/:id/positions/:position_id/candidates', ok(ALEX));
        answerPositionsPage(api);
        await page.goto(NEW);

        await expect(page.getByLabel('Date of birth')).toHaveValue('');
        await fillForm(page);
        await save(page);
        // The browser asks for it.
        await expect.poll(() => page.getByLabel('Date of birth').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        expect(api.callsTo('POST statutory /events/:id/positions/:position_id/candidates')).toHaveLength(0);

        await fillDate(page.getByLabel('Date of birth'), '1999-05-01');
        await save(page);
        await expect(toast(page, 'Candidate is saved.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/positions/:position_id/candidates').map((call) => (call.body as Candidate).date_of_birth)).toEqual(['1999-05-01']);
    });

    test('shows next to each field why the service refused the candidature', async ({ page, api }) => {
        answerPosition(api);
        const errors = {
            date_of_birth: ['The value should be a date with a YYYY-MM-DD format.'],
            member_since: ['The value should be a date with a YYYY-MM-DD format.'],
            nationality: ['Nationality should be set.'],
            languages: ['Please specify at least 1 language.'],
            studies: ['Studies should be set.'],
            attended_agorae: ['Please fill in your attended Agorae.'],
            attended_epm: ['Please fill in your attended EPM/EBM.'],
            attended_conferences: ['Please fill in your attended European Events.'],
            european_experience: ['Please fill in your european experience.'],
            local_experience: ['Please fill in your local experience.'],
            related_experience: ['Please fill in your experience related to position.'],
            external_experience: ['Please fill in your non-AEGEE experience.'],
            motivation: ['Please fill in your motivation.'],
            program: ['Please fill in the program.'],
            agreed_to_privacy_policy: ['You should agree to Privacy Policy.']
        };
        api.on('POST statutory /events/:id/positions/:position_id/candidates', { status: 422, json: validationError(errors) });
        await page.goto(NEW);

        await fillForm(page);
        await save(page);

        await expect(toast(page, 'Some of the candidate data is invalid.')).toBeVisible();
        // The two dates have the same message, each under its own field.
        await expect(page.getByText(errors.date_of_birth[0], { exact: true })).toHaveCount(2);
        for (const [message] of Object.values(errors)) {
            await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
        }
        await expect(page).toHaveURL(NEW);
    });

    test('says why the service refused the candidature as a whole', async ({ page, api }) => {
        answerPosition(api);
        // A second candidature for the same position, refused by the database.
        api.on('POST statutory /events/:id/positions/:position_id/candidates', {
            status: 422,
            json: validationError({ position_id: ['position_id must be unique'], user_id: ['There\'s already an application with such user ID for this position.'] })
        });
        await page.goto(NEW);

        await fillForm(page);
        await save(page);

        await expect(toast(page, 'Some of the candidate data is invalid: position_id must be unique; There\'s already an application with such user ID for this position.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save candidature' })).toBeEnabled();
    });

    test('says when the candidature may not be submitted', async ({ page, api }) => {
        answerPosition(api);
        api.on('POST statutory /events/:id/positions/:position_id/candidates', { status: 403, json: forbidden('You cannot submit candidature.') });
        await page.goto(NEW);

        await fillForm(page);
        await save(page);

        await expect(toast(page, 'Could not save candidate: You cannot submit candidature.')).toBeVisible();
        await expect(page).toHaveURL(NEW);
    });

    test('says when the service can\'t be reached', async ({ page, api }) => {
        answerPosition(api);
        api.on('POST statutory /events/:id/positions/:position_id/candidates', { abort: 'failed' });
        await page.goto(NEW);

        await fillForm(page);
        await save(page);

        await expect(toast(page, 'Could not save candidate: Network Error')).toBeVisible();
    });

    test('shows what is typed as safe markdown', async ({ page, api }) => {
        answerPosition(api);
        const picture = new Promise<void>((resolve) => {
            api.url('GET', '/statutory/agora-spring/positions/5/x', () => {
                resolve();
                return { status: 404, body: '' };
            });
        });
        await page.goto(NEW);

        await page.getByLabel('Motivation').fill(XSS);

        await expect(page.getByRole('strong').filter({ hasText: 'bold' })).toBeVisible();
        await expect(page.getByText('x', { exact: true })).not.toHaveAttribute('href', /javascript:/);
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });

    test('names no position when the positions can\'t be loaded', async ({ page, api }) => {
        api.on('GET statutory /events/:id/positions', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.goto(NEW);

        await expect(toast(page, 'Could not fetch the position: Internal server error.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Apply for a position' })).toBeVisible();
        await expect(page.getByLabel('Body')).toHaveValue('1');
    });

    test('names no position the Agora doesn\'t have', async ({ page, api }) => {
        answerPosition(api);
        await page.goto('/statutory/agora-spring/positions/99/apply');

        await expect(page.getByRole('heading', { name: 'Apply for a position' })).toBeVisible();
        await expect(page.getByLabel('Date of birth')).toHaveValue('1999-05-01');
    });
});

test.describe('editing a candidature', () => {
    test.beforeEach(({ me }) => {
        me!.bodies = [ANTENNA, ZAGREB];
        me!.primary_body_id = ANTENNA.id;
    });

    const answerCandidate = (api: ApiMock, data: Candidate = ALEX): void => {
        answerPosition(api);
        api.json('GET statutory /events/:id/positions/:position_id/candidates/:candidate_id', ok(data));
    };

    test('a member edits their pending candidature', async ({ page, api }) => {
        answerCandidate(api);
        api.json('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id', ok(ALEX));
        answerPositionsPage(api);
        await page.goto(OWN);

        await expect(page.getByRole('heading', { name: 'Edit the candidature for Comité Directeur' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Edit your application');
        await expect(page.getByText('To withdraw your candidature, you should send an email to the Juridical Commission.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Juridical Commission' })).toHaveAttribute('href', 'mailto:juridical@aegee.eu');
        await expect(page.getByRole('heading', { name: 'Update candidature image' })).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByText('You can upload candidature image after saving it.')).toHaveCount(0);
        // What is stored.
        await expect(page.getByLabel('Body').getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Zagreb']);
        await expect(page.getByLabel('Body')).toHaveValue('1');
        await expect(page.getByLabel('Date of birth')).toHaveValue('1999-05-01');
        await expect(page.getByLabel('Member since')).toHaveValue('2019-10-01');
        await expect(page.getByLabel('Nationality')).toHaveValue('Belgian');
        await expect(page.getByText('Latin', { exact: true })).toBeVisible();
        for (const [key, [label]] of Object.entries(TEXTS)) {
            await expect(page.getByLabel(label, { exact: true })).toHaveValue(ALEX[key as keyof typeof TEXTS]);
        }
        await expect(page.getByRole('checkbox', { name: /I agree for all my above mentioned personal data/ })).toBeChecked();

        await page.getByLabel('Studies').fill('Law');
        await save(page);

        await expect(toast(page, 'Candidate is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/positions/approved');
        expect(api.callsTo('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'agora-spring', position_id: '5', candidate_id: '21' }, { ...ALEX, studies: 'Law', body: ANTENNA }]]);
    });

    test('the Juridical Commission edits someone else\'s candidature, and goes back to its list', async ({ page, api }) => {
        const jans = candidate({ id: 11, user_id: 7, body_id: 3, body_name: 'AEGEE-Utrecht', first_name: 'Jan', last_name: 'Jansen' });
        answerCandidate(api, jans);
        api.json('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id', ok(jans));
        answerPositionsPage(api, 'all');
        await page.goto('/statutory/agora-spring/positions/5/candidates/11/edit');

        // The candidate's body stays: the other bodies of the candidate aren't known here.
        await expect(page.getByLabel('Body').getByRole('option')).toHaveText(['AEGEE-Utrecht']);
        await expect(page.getByLabel('Body')).toHaveValue('3');
        await page.getByLabel('Motivation').fill('Corrected by the Juridical Commission');
        await save(page);

        await expect(toast(page, 'Candidate is saved.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/positions/all');
        expect(api.callsTo('PUT statutory /events/:id/positions/:position_id/candidates/:candidate_id').map((call) => call.body))
            .toEqual([{ ...jans, motivation: 'Corrected by the Juridical Commission' }]);
    });

    test('a member uploads a picture for their candidature, and sees it', async ({ page, api }) => {
        answerCandidate(api);
        const image = statutoryImage({ id: 8, file_name: 'alex.png', frontend_path: '/alex.png' });
        api.json('POST statutory /events/:id/positions/:position_id/candidates/:candidate_id/image', ok({ ...ALEX, image_id: 8, image }));
        api.url('GET', '/media/statutory/alex.png', { body: PICTURE, contentType: 'image/png' });
        await page.goto(OWN);

        const upload = page.getByRole('button', { name: 'Upload!' });
        await expect(upload).toBeDisabled();
        await expect(page.getByRole('img', { name: 'Photo of Alex Member' })).toHaveCount(0);
        await page.getByLabel(/Choose a file/).setInputFiles({ name: 'alex.png', mimeType: 'image/png', buffer: PICTURE });
        await expect(page.getByText('alex.png')).toBeVisible();
        await upload.click();

        await expect(toast(page, 'Image is updated.')).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByRole('img', { name: 'Photo of Alex Member' })).toHaveAttribute('src', '/media/statutory/alex.png');
        const [call] = api.callsTo('POST statutory /events/:id/positions/:position_id/candidates/:candidate_id/image');
        expect(call.params).toEqual({ id: 'agora-spring', position_id: '5', candidate_id: '21' });
        expect(call.parts.map(({ name, filename, contentType }) => ({ name, filename, contentType }))).toEqual([{ name: 'image', filename: 'alex.png', contentType: 'image/png' }]);
    });

    test('a candidature with a picture shows it', async ({ page, api }) => {
        answerCandidate(api, { ...ALEX, image_id: 8, image: statutoryImage({ id: 8, file_name: 'alex.png', frontend_path: '/alex.png' }) });
        api.url('GET', '/media/statutory/alex.png', { body: PICTURE, contentType: 'image/png' });
        await page.goto(OWN);

        await expect(page.getByRole('img', { name: 'Photo of Alex Member' })).toHaveAttribute('src', '/media/statutory/alex.png');
    });

    test('says why a picture was refused', async ({ page, api }) => {
        answerCandidate(api);
        api.on('POST statutory /events/:id/positions/:position_id/candidates/:candidate_id/image', { status: 422, json: unprocessable('The image should be at most 5 MB.') });
        await page.goto(OWN);

        await page.getByLabel(/Choose a file/).setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: PICTURE });
        await page.getByRole('button', { name: 'Upload!' }).click();

        await expect(toast(page, 'Could not update image: The image should be at most 5 MB.')).toBeVisible();
        await expect(page.getByText('big.png')).toBeVisible();
    });

    test('an unknown candidature goes back to the event', async ({ page, api }) => {
        api.fallback(mockEverything);
        answerPosition(api);
        api.on('GET statutory /events/:id/positions/:position_id/candidates/:candidate_id', { status: 404, json: notFound('Candidate is not found.') });
        await page.goto(OWN);

        await expect(toast(page, 'Candidature is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
    });

    test('someone else\'s candidature goes back to the event', async ({ page, api }) => {
        api.fallback(mockEverything);
        answerPosition(api);
        api.on('GET statutory /events/:id/positions/:position_id/candidates/:candidate_id', { status: 403, json: forbidden('You cannot see this candidature.') });
        await page.goto('/statutory/agora-spring/positions/5/candidates/11/edit');

        await expect(toast(page, 'Some error happened: You cannot see this candidature.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
    });
});
