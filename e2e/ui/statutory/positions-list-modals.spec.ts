// The two modals of the positions page (/statutory/:id/positions/:prefix): looking at a
// candidature, and creating or editing a position. The page itself is in positions-list.spec.ts.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { FIXED_NOW, ok, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import {
    approvedCandidate, listedCandidate, positionWithCandidates, type PositionWithCandidates
} from '../support/factories/statutory-candidates.ts';
import { statutoryEvent, statutoryEventPermissions, statutoryImage, type StatutoryEvent } from '../support/factories/statutory-events.ts';
import { cellOf, dialog, fillDate, freezeTime, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const PICTURE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/statutory/agora-logo.png'));
const XSS = '**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)';

const BODIES = [
    body({ id: 3, name: 'Comité Directeur', type: 'other' }),
    body({ id: 4, name: 'Juridical Commission', type: 'other' })
];

// The event's numeric id is 1, its address agora-spring. The Agora starts on 20 April 2027.
const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({
    id: 1, url: 'agora-spring', starts: '2027-04-20T08:00:00.000Z', ...overrides
});
const JC = statutoryEventPermissions({ manage_candidates: true });

const JAN = {
    id: 11,
    user_id: 7,
    first_name: 'Jan',
    last_name: 'Jansen',
    body_name: 'AEGEE-Utrecht',
    date_of_birth: '1999-05-14',
    member_since: '2019-10-01',
    nationality: 'Dutch',
    languages: ['English', 'Dutch'],
    studies: 'Economics',
    attended_agorae: 'Agora Spring 2025',
    attended_epm: 'EPM 2025',
    attended_conferences: 'A Summer University',
    european_experience: 'Speaker of a working group',
    local_experience: 'President of AEGEE-Utrecht',
    external_experience: 'Student council',
    related_experience: 'Treasurer of my antenna',
    motivation: 'I want to **help** the network.',
    program: 'More training for boards.',
    created_at: '2027-01-10T09:30:15.000Z'
};

const CD = (candidates: PositionWithCandidates['candidates'] = []): PositionWithCandidates => positionWithCandidates({
    id: 5,
    name: 'Comité Directeur',
    body_id: 3,
    places: 7,
    status: 'open',
    starts: '2027-02-01T09:00:00.000Z',
    ends: '2027-04-06T21:59:00.000Z',
    start_term: '2027-08-01',
    end_term: '2028-07-31',
    requirements: 'Be a member for **2 years**.',
    candidates
});

// The fields of the position form, as the service stores them for the Comité Directeur.
const CD_FIELDS = {
    id: 5,
    name: 'Comité Directeur',
    starts: '2027-02-01T09:00:00.000Z',
    ends: '2027-04-06T21:59:00.000Z',
    places: 7,
    body_id: 3,
    start_term: '2027-08-01T00:00:00.000Z',
    end_term: '2028-07-31',
    requirements: 'Be a member for **2 years**.'
};

const mockPage = (api: ApiMock, { event = agora(), prefix = 'approved', positions = [CD()] }: { event?: StatutoryEvent; prefix?: string; positions?: PositionWithCandidates[] } = {}): void => {
    api.json('GET core /bodies', ok(BODIES));
    api.json('GET statutory /events/:id', ok(event));
    api.json(`GET statutory /events/:id/positions/${prefix}`, ok(positions));
    api.json('GET statutory /events/:id/positions/candidates/mine', ok([]));
};
const manage = (api: ApiMock, positions?: PositionWithCandidates[]): void => mockPage(api, { event: agora({ permissions: JC }), prefix: 'all', positions });

const positionsTable = (page: Page) => page.getByRole('region', { name: 'Positions' }).getByRole('table');
const positionRow = (page: Page, name: string) => tableRows(positionsTable(page)).filter({ hasText: name });

const selectPosition = async (page: Page, name: string): Promise<void> => {
    await (await cellOf(positionsTable(page), positionRow(page, name), 'Name')).click();
    await expect(page.getByRole('heading', { name: 'Applications for selected position' })).toBeVisible();
};

// The pictures in XSS (relative to the page) fail to load, which is when their handler would run.
const answerPicture = (api: ApiMock): Promise<void> => new Promise<void>((resolve) => {
    api.url('GET', '/statutory/agora-spring/positions/x', () => {
        resolve();
        return { status: 404, body: '' };
    });
});

test.describe('a candidature on the positions page', () => {
    // The value next to a row header of the modal.
    const detail = (page: Page, name: string) => dialog(page, 'View candidature').getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name, exact: true }) })
        .getByRole('cell');

    test('a member looks at an approved candidature, with its photo', async ({ page, api }) => {
        mockPage(api, { positions: [CD([approvedCandidate({ ...JAN, image_id: 3, image: statutoryImage({ file_name: 'jan.png', frontend_path: '/jan.png' }) })])] });
        api.url('GET', '/media/statutory/jan.png', { body: PICTURE, contentType: 'image/png' });
        await page.goto('/statutory/agora-spring/positions/approved');
        await selectPosition(page, 'Comité Directeur');

        await page.getByRole('button', { name: 'View candidature of Jan Jansen' }).click();

        const modal = dialog(page, 'View candidature');
        await expect(modal.getByRole('heading', { name: 'View candidature' })).toBeVisible();
        await expect(modal.getByRole('img', { name: 'Photo of Jan Jansen' })).toHaveAttribute('src', '/media/statutory/jan.png');
        await expect(detail(page, 'Position')).toHaveText('Comité Directeur');
        await expect(detail(page, 'First name')).toHaveText('Jan');
        await expect(detail(page, 'Last name')).toHaveText('Jansen');
        await expect(detail(page, 'Applied on')).toHaveText('2027-01-10 10:30:15');
        await expect(detail(page, 'Body')).toHaveText('AEGEE-Utrecht');
        await expect(detail(page, 'Date of birth')).toHaveText('1999-05-14');
        await expect(detail(page, 'Member since')).toHaveText('2019-10-01');
        await expect(detail(page, 'Nationality')).toHaveText('Dutch');
        await expect(detail(page, 'Languages')).toHaveText('English, Dutch');
        await expect(detail(page, 'Studies')).toHaveText('Economics');
        await expect(detail(page, 'Attended Agorae')).toHaveText('Agora Spring 2025');
        await expect(detail(page, 'Attended EPMs')).toHaveText('EPM 2025');
        await expect(detail(page, 'Attended European Events')).toHaveText('A Summer University');
        await expect(detail(page, 'European level experience')).toHaveText('Speaker of a working group');
        await expect(detail(page, 'Local level experience')).toHaveText('President of AEGEE-Utrecht');
        await expect(detail(page, 'Non-AEGEE experience')).toHaveText('Student council');
        await expect(detail(page, 'Position-related experience')).toHaveText('Treasurer of my antenna');
        await expect(detail(page, 'Motivation')).toHaveText('I want to help the network.');
        await expect(detail(page, 'Motivation').getByRole('strong')).toHaveText('help');
        await expect(detail(page, 'Program')).toHaveText('More training for boards.');
        // Every member sees the approved candidatures, without addresses.
        await expect(modal.getByRole('rowheader', { name: 'Email' })).toHaveCount(0);

        await modal.getByRole('button', { name: 'Close' }).click();
        await expect(modal).toHaveCount(0);
    });

    test('the Juridical Commission sees the address, and a candidature without photo gets none', async ({ page, api }) => {
        manage(api, [CD([listedCandidate({ ...JAN, notification_email: 'jan@example.org' })])]);
        await page.goto('/statutory/agora-spring/positions/all');
        await selectPosition(page, 'Comité Directeur');

        await page.getByRole('button', { name: 'View candidature of Jan Jansen' }).click();

        await expect(detail(page, 'Email')).toHaveText('jan@example.org');
        // The placeholder logo is decoration.
        await expect(dialog(page, 'View candidature').getByRole('img')).toHaveCount(0);
        await expect(detail(page, 'First name')).toHaveText('Jan');
    });

    test('shows what candidates wrote as safe markdown', async ({ page, api }) => {
        const texts = ['studies', 'attended_agorae', 'attended_epm', 'attended_conferences', 'european_experience', 'local_experience', 'external_experience', 'related_experience', 'motivation', 'program'];
        manage(api, [CD([listedCandidate({ ...JAN, ...Object.fromEntries(texts.map((key) => [key, XSS])) })])]);
        const picture = answerPicture(api);
        await page.goto('/statutory/agora-spring/positions/all');
        await selectPosition(page, 'Comité Directeur');

        await page.getByRole('button', { name: 'View candidature of Jan Jansen' }).click();

        const modal = dialog(page, 'View candidature');
        await expect(modal.getByRole('strong').filter({ hasText: 'bold' })).toHaveCount(10);
        const links = modal.getByText('x', { exact: true });
        await expect(links).toHaveCount(10);
        await expect(links.first()).not.toHaveAttribute('href', /javascript:/);
        await expect(links.last()).not.toHaveAttribute('href', /javascript:/);
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });
});

test.describe('creating and editing a position', () => {
    const openCreate = async (page: Page) => {
        await page.getByRole('button', { name: 'Create a position' }).click();
        const modal = dialog(page, 'Add position');
        await expect(modal.getByRole('heading', { name: 'Add position' })).toBeVisible();
        return modal;
    };
    const openEdit = async (page: Page, name = 'Comité Directeur') => {
        await page.getByRole('button', { name: `Edit position ${name}` }).click();
        const modal = dialog(page, 'Edit position');
        await expect(modal.getByRole('heading', { name: 'Edit position' })).toBeVisible();
        return modal;
    };

    test('the Juridical Commission creates a position, and sees it in the list', async ({ page, api }) => {
        await freezeTime(page);
        manage(api);
        const created = positionWithCandidates({ id: 9, name: 'Network Director', body_id: 4 }, { now: Date.parse(FIXED_NOW) });
        let positions = [CD()];
        api.on('GET statutory /events/:id/positions/all', () => ({ json: ok(positions) }));
        api.on('POST statutory /events/:id/positions', () => {
            positions = [CD(), created];
            return { json: ok(created) };
        });
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        // The applications open now and close two weeks before the Agora, at the end of the day.
        await expect(modal.getByLabel('Name')).toHaveValue('');
        await expect(modal.getByLabel('Application period starts')).toHaveValue('2027-03-01 10:00');
        await expect(modal.getByLabel('Application period ends')).toHaveValue('2027-04-06 23:59');
        await expect(modal.getByLabel('Places available')).toHaveValue('1');
        await expect(modal.getByLabel('Position term starts')).toHaveValue('2027-03-01');
        await expect(modal.getByLabel('Associated body').getByRole('option')).toHaveText(['None', 'Comité Directeur', 'Juridical Commission']);

        await modal.getByLabel('Name').fill('Network Director');
        await fillDate(modal.getByLabel('Application period starts'), '2027-03-05 10:00');
        await fillDate(modal.getByLabel('Application period ends'), '2027-04-05 23:00');
        await modal.getByLabel('Places available').fill('2');
        await modal.getByLabel('Associated body').selectOption('Juridical Commission');
        await fillDate(modal.getByLabel('Position term starts'), '2027-08-01');
        await modal.getByLabel('Position term ends').fill('2028-07-31');
        await expect(modal.getByText('A date has been detected')).toBeVisible();
        await modal.getByLabel('Requirements for the position').fill('Be **active**');
        await expect(modal.getByRole('strong')).toHaveText('active');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Position is created.')).toBeVisible();
        await expect(modal).toHaveCount(0);
        await expect(positionRow(page, 'Network Director')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/positions').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, {
            name: 'Network Director',
            starts: '2027-03-05T09:00:00.000Z',
            ends: '2027-04-05T21:00:00.000Z',
            places: 2,
            body_id: 4,
            start_term: '2027-08-01T00:00:00.000Z',
            end_term: '2028-07-31',
            requirements: 'Be **active**'
        }]]);
        // The list is asked for again; the app isn't loaded again.
        expect(api.callsTo('GET statutory /events/:id/positions/all')).toHaveLength(2);
        expect(api.callsTo('GET core /members/me')).toHaveLength(1);
    });

    test('a position is saved once, however often Save is clicked', async ({ page, api }) => {
        manage(api);
        api.on('POST statutory /events/:id/positions', { json: ok(CD()), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        await modal.getByLabel('Name').fill('Network Director');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(modal.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        await expect(toast(page, 'Position is created.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/positions')).toHaveLength(1);
    });

    test('shows next to each field why the service refused the position', async ({ page, api }) => {
        manage(api);
        api.on('POST statutory /events/:id/positions', {
            status: 422,
            json: validationError({
                name: ['Position name should be set.'],
                starts: ['Position start date should be valid.'],
                ends: ['Position cannot start after or at the same time it ends.'],
                places: ['Places amount should be at least 1'],
                body_id: ['The value should be a whole number between -2147483648 and 2147483647.'],
                start_term: ['Position start term date should be valid.'],
                end_term: ['Position end term date should be set.'],
                requirements: ['The value should be a text.']
            })
        });
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some fields were not set')).toBeVisible();
        for (const message of [
            'Position name should be set.',
            'Position start date should be valid.',
            'Position cannot start after or at the same time it ends.',
            'Places amount should be at least 1',
            'The value should be a whole number between -2147483648 and 2147483647.',
            'Position start term date should be valid.',
            'Position end term date should be set.',
            'The value should be a text.'
        ]) {
            // Each one once, under its own field.
            await expect(modal.getByText(message, { exact: true })).toHaveCount(1);
        }
        await expect(modal).toBeVisible();
    });

    test('says when the position could not be saved, and keeps what was typed', async ({ page, api }) => {
        manage(api);
        api.on('POST statutory /events/:id/positions', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        await modal.getByLabel('Name').fill('Network Director');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(modal.getByLabel('Name')).toHaveValue('Network Director');
        await expect(modal.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    test('says when the end of the term is a date', async ({ page, api }) => {
        manage(api);
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        const termEnds = modal.getByLabel('Position term ends');
        const detected = modal.getByText('A date has been detected');
        await termEnds.fill('Agora Spring 2028');
        await expect(detected).toHaveCount(0);
        await termEnds.fill('2028-6-1');
        await expect(detected).toHaveCount(0);
        await termEnds.fill('2028-06-30');
        await expect(detected).toBeVisible();
        await termEnds.fill('');
        await expect(detected).toHaveCount(0);
    });

    test('closing the form sends nothing', async ({ page, api }) => {
        manage(api);
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        await modal.getByLabel('Name').fill('Network Director');
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).toHaveCount(0);

        await (await openCreate(page)).getByRole('button', { name: 'Close' }).click();
        await expect(dialog(page, 'Add position')).toHaveCount(0);
        expect(api.callsTo('POST statutory /events/:id/positions')).toHaveLength(0);
        await expect(tableRows(positionsTable(page))).toHaveCount(1);
    });

    test('the Juridical Commission edits a position', async ({ page, api }) => {
        manage(api);
        let positions = [CD()];
        api.on('GET statutory /events/:id/positions/all', () => ({ json: ok(positions) }));
        api.on('PUT statutory /events/:id/positions/:position_id', () => {
            positions = [positionWithCandidates({ ...CD(), places: 8 })];
            return { json: ok(positions[0]) };
        });
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openEdit(page);
        await expect(modal.getByLabel('Name')).toHaveValue('Comité Directeur');
        await expect(modal.getByLabel('Application period starts')).toHaveValue('2027-02-01 10:00');
        await expect(modal.getByLabel('Application period ends')).toHaveValue('2027-04-06 23:59');
        await expect(modal.getByLabel('Places available')).toHaveValue('7');
        await expect(modal.getByLabel('Associated body')).toHaveValue('3');
        await expect(modal.getByLabel('Position term starts')).toHaveValue('2027-08-01');
        await expect(modal.getByLabel('Position term ends')).toHaveValue('2028-07-31');
        await expect(modal.getByText('A date has been detected')).toBeVisible();
        await expect(modal.getByLabel('Requirements for the position')).toHaveValue('Be a member for **2 years**.');
        await expect(modal.getByRole('strong')).toHaveText('2 years');

        await modal.getByLabel('Places available').fill('8');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Position is updated.')).toBeVisible();
        await expect(modal).toHaveCount(0);
        await expect(await cellOf(positionsTable(page), positionRow(page, 'Comité Directeur'), 'Places available')).toHaveText('8');
        // The position's own fields, on the event's numeric id.
        expect(api.callsTo('PUT statutory /events/:id/positions/:position_id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1', position_id: '5' }, { ...CD_FIELDS, places: 8 }]]);
        expect(api.callsTo('GET core /members/me')).toHaveLength(1);
    });

    test('a selected position shows what was saved', async ({ page, api }) => {
        manage(api);
        let positions = [CD()];
        api.on('GET statutory /events/:id/positions/all', () => ({ json: ok(positions) }));
        api.on('PUT statutory /events/:id/positions/:position_id', () => {
            positions = [positionWithCandidates({ ...CD(), end_term: 'Agora Spring 2028' })];
            return { json: ok(positions[0]) };
        });
        await page.goto('/statutory/agora-spring/positions/all');
        await selectPosition(page, 'Comité Directeur');

        const modal = await openEdit(page);
        await modal.getByLabel('Position term ends').fill('Agora Spring 2028');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Position is updated.')).toBeVisible();
        await expect(page.getByText('The term for this position starts on 2027-08-01 and ends on Agora Spring 2028.')).toBeVisible();
    });

    test('says when the positions can\'t be fetched again after saving', async ({ page, api }) => {
        manage(api);
        let fails = false;
        api.on('GET statutory /events/:id/positions/all', () => (fails
            ? { status: 500, json: { success: false, message: 'Internal server error.' } }
            : { json: ok([CD()]) }));
        api.on('POST statutory /events/:id/positions', () => {
            fails = true;
            return { json: ok(CD()) };
        });
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openCreate(page);
        await modal.getByLabel('Name').fill('Network Director');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Could not fetch positions: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring/positions/all');
        await expect(tableRows(positionsTable(page))).toHaveCount(1);
    });

    test('a position loses its body', async ({ page, api }) => {
        manage(api);
        api.json('PUT statutory /events/:id/positions/:position_id', ok(positionWithCandidates({ ...CD(), body_id: null })));
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openEdit(page);
        await modal.getByLabel('Associated body').selectOption('None');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Position is updated.')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/positions/:position_id').map((call) => call.body)).toEqual([{ ...CD_FIELDS, body_id: null }]);
    });

    test('a change that is not saved stays out of the list', async ({ page, api }) => {
        manage(api);
        await page.goto('/statutory/agora-spring/positions/all');
        await selectPosition(page, 'Comité Directeur');

        const modal = await openEdit(page);
        await modal.getByLabel('Name').fill('Changed name');
        await modal.getByLabel('Position term ends').fill('Agora Spring 2028');
        await modal.getByRole('button', { name: 'Cancel' }).click();

        await expect(modal).toHaveCount(0);
        await expect(positionRow(page, 'Comité Directeur')).toBeVisible();
        await expect(positionRow(page, 'Changed name')).toHaveCount(0);
        await expect(page.getByText('The term for this position starts on 2027-08-01 and ends on 2028-07-31.')).toBeVisible();

        // Opened again, it shows what is stored.
        await expect((await openEdit(page)).getByLabel('Name')).toHaveValue('Comité Directeur');
    });

    test('shows the requirements as safe markdown while they are typed', async ({ page, api }) => {
        manage(api);
        const picture = answerPicture(api);
        await page.goto('/statutory/agora-spring/positions/all');

        const modal = await openEdit(page);
        await modal.getByLabel('Requirements for the position').fill(XSS);

        await expect(modal.getByRole('strong')).toHaveText('bold');
        await expect(modal.getByText('x', { exact: true })).not.toHaveAttribute('href', /javascript:/);
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });
});
