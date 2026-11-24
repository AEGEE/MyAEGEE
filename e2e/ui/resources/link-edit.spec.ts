// Adding and editing a link of the resources page (/resources/links/new?category_id=,
// /resources/links/:id/edit): its section, title, description and address. Any member can open
// the form; core decides on saving whether they may, and checks the address.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { resourceCategory, resourceLink } from '../support/factories/static.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const form = (page: Page, name: 'Add link' | 'Edit link') => page.getByRole('form', { name });

const LISTS = resourceLink({ id: 12, category_id: 1, title: 'Mailing Lists', description: 'Which lists there are and how to join them.', url: '/pages/mailing-lists', position: 1 });
const STAY_INFORMED = resourceCategory({ id: 1, name: 'Stay informed', links: [resourceLink({ id: 11, category_id: 1, title: 'AEGEE Newsletter' }), LISTS] });
const FINANCIAL = resourceCategory({ id: 2, name: 'Financial', theme: 'yellow', position: 1, links: [] });
const TEMPLATES = resourceCategory({ id: 3, name: 'Templates', theme: 'green', position: 2, links: [] });
const SECTIONS = [STAY_INFORMED, FINANCIAL, TEMPLATES];

const URL_HELP = 'An address starting with https:// opens in a new tab. A MyAEGEE page is a path starting with /, like /pages/mailing-lists, and opens in the same tab.';
const SECTION_HELP = 'A link moved to another section goes to the end of that section.';

test.describe('resources link form', () => {
    test('adding a link to the section it was asked for sends all its fields and goes back', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));
        api.json('POST core /resources/links', ok(resourceLink({ id: 22, category_id: 2, title: 'Budget template' })));

        await page.goto('/resources/links/new?category_id=2');

        const add = form(page, 'Add link');
        await expect(page.getByRole('heading', { name: 'Add link', exact: true })).toBeVisible();
        await expect(add.getByLabel('Section').getByRole('option')).toHaveText(['Stay informed', 'Financial', 'Templates']);
        await expect(add.getByLabel('Section')).toHaveValue('2');
        await expect(add.getByRole('option', { name: 'Financial', selected: true })).toBeAttached();
        await expect(add.getByLabel('Title')).toHaveValue('');

        await add.getByLabel('Title').fill('Budget template');
        await add.getByLabel('Description').fill('The template every antenna uses for its budget.');
        await add.getByLabel('URL').fill('https://www.aegee.org/budget-template/');
        await add.getByRole('button', { name: 'Save link' }).click();

        await expect(toast(page, 'Link is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        expect(api.callsTo('POST core /resources/links').map((call) => call.body)).toEqual([{
            category_id: 2,
            title: 'Budget template',
            description: 'The template every antenna uses for its budget.',
            url: 'https://www.aegee.org/budget-template/'
        }]);
        // The form and then the manage page ask for the sections.
        expect(api.callsTo('GET core /resources')).toHaveLength(2);
    });

    test('without a section asked for, one has to be chosen first', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));
        api.json('POST core /resources/links', ok(resourceLink({ id: 23, category_id: 3, title: 'Letter template' })));

        await page.goto('/resources/links/new');

        const add = form(page, 'Add link');
        await expect(add.getByLabel('Section').getByRole('option')).toHaveCount(3);
        await expect(add.getByRole('option', { selected: true })).toHaveCount(0);
        await add.getByLabel('Title').fill('Letter template');
        await add.getByLabel('Description').fill('For letters to partners.');
        await add.getByLabel('URL').fill('/pages/letter-template');
        await add.getByRole('button', { name: 'Save link' }).click();

        await expect(add.getByLabel('Section')).toBeFocused();
        expect(await add.getByLabel('Section').evaluate((select: HTMLSelectElement) => select.validity.valueMissing)).toBe(true);
        await expect(page).toHaveURL(/\/resources\/links\/new$/);
        expect(api.callsTo('POST core /resources/links')).toEqual([]);

        await add.getByLabel('Section').selectOption({ label: 'Templates' });
        await add.getByRole('button', { name: 'Save link' }).click();

        await expect(toast(page, 'Link is saved.')).toBeVisible();
        expect(api.callsTo('POST core /resources/links').map((call) => call.body)).toEqual([{
            category_id: 3,
            title: 'Letter template',
            description: 'For letters to partners.',
            url: '/pages/letter-template'
        }]);
    });

    test('editing loads the link and saves it to another section', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));
        api.json('GET core /resources/links/:id', ok(LISTS));
        api.json('PUT core /resources/links/:id', ok({ ...LISTS, category_id: 2, position: 0 }));

        await page.goto('/resources/links/12/edit');

        const edit = form(page, 'Edit link');
        await expect(page.getByRole('heading', { name: 'Edit link', exact: true })).toBeVisible();
        await expect(edit.getByLabel('Title')).toHaveValue('Mailing Lists');
        await expect(edit.getByLabel('Description')).toHaveValue('Which lists there are and how to join them.');
        await expect(edit.getByLabel('URL')).toHaveValue('/pages/mailing-lists');
        await expect(edit.getByRole('option', { name: 'Stay informed', selected: true })).toBeAttached();
        await expect(edit.getByLabel('Section')).toHaveAccessibleDescription(SECTION_HELP);

        await edit.getByLabel('Section').selectOption({ label: 'Financial' });
        await edit.getByLabel('Title').fill('Mailing lists of AEGEE');
        await edit.getByRole('button', { name: 'Save link' }).click();

        await expect(toast(page, 'Link is saved.')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        expect(api.callsTo('GET core /resources/links/:id').map((call) => call.params)).toEqual([{ id: '12' }]);
        expect(api.callsTo('PUT core /resources/links/:id').map((call) => [call.params, call.body])).toEqual([[{ id: '12' }, {
            category_id: 2,
            title: 'Mailing lists of AEGEE',
            description: 'Which lists there are and how to join them.',
            url: '/pages/mailing-lists'
        }]]);
    });

    test('a link that doesn\'t exist goes back to managing the page with the reason', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));
        api.on('GET core /resources/links/:id', { status: 404, json: notFound('Link is not found.') });

        await page.goto('/resources/links/404/edit');

        await expect(toast(page, 'Could not load the link: Link is not found.')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('region', { name: 'Financial', exact: true })).toBeVisible();
    });

    test('sections that can\'t be loaded send back to managing the page too', async ({ page, api }) => {
        let calls = 0;
        api.on('GET core /resources', () => {
            calls += 1;
            return calls === 1 ? { status: 500, json: { success: false, message: 'Database is down' } } : { json: ok(SECTIONS) };
        });

        await page.goto('/resources/links/new?category_id=2');

        await expect(toast(page, 'Could not load the link: Database is down')).toBeVisible();
        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('region', { name: 'Financial', exact: true })).toBeVisible();
    });

    test('shows core\'s messages under their fields, and clears them on the next try', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));
        api.json('GET core /resources/links/:id', ok(LISTS));
        const answers = [
            // The section was deleted in the meantime.
            { status: 422, json: validationError({ category_id: ['Section is not found.'] }) },
            {
                status: 422,
                json: validationError({
                    title: ['Title should be set.'],
                    description: ['Description should be set.'],
                    url: ['URL should be a MyAEGEE path starting with / or an http(s):// address.']
                })
            },
            { status: 403, json: forbidden('Permission global:manage:resources is required, but not present.') }
        ];
        api.on('PUT core /resources/links/:id', () => answers.shift()!);

        await page.goto('/resources/links/12/edit');
        const edit = form(page, 'Edit link');
        const save = edit.getByRole('button', { name: 'Save link' });
        await expect(edit.getByLabel('Title')).toHaveValue('Mailing Lists');
        await expect(edit.getByLabel('Title')).toHaveAccessibleDescription('');
        await expect(edit.getByLabel('URL')).toHaveAccessibleDescription(URL_HELP);

        await save.click();
        await expect(toast(page, 'Some of the link data is invalid.')).toBeVisible();
        await expect(edit.getByLabel('Section')).toHaveAccessibleDescription(`${SECTION_HELP} Section is not found.`);

        // Core trims the fields, so spaces pass the browser but not core.
        await edit.getByLabel('Title').fill(' ');
        await edit.getByLabel('Description').fill(' ');
        await edit.getByLabel('URL').fill('//elsewhere.example.org');
        await save.click();
        await expect(edit.getByLabel('Title')).toHaveAccessibleDescription('Title should be set.');
        await expect(edit.getByLabel('Description')).toHaveAccessibleDescription('Description should be set.');
        await expect(edit.getByLabel('URL')).toHaveAccessibleDescription(`${URL_HELP} URL should be a MyAEGEE path starting with / or an http(s):// address.`);
        await expect(edit.getByLabel('Section')).toHaveAccessibleDescription(SECTION_HELP);

        await save.click();
        await expect(toast(page, 'Could not save the link: Permission global:manage:resources is required, but not present.')).toBeVisible();
        await expect(edit.getByText(/should be/)).toHaveCount(0);
        await expect(page).toHaveURL(/\/resources\/links\/12\/edit$/);
        expect(api.callsTo('PUT core /resources/links/:id').map((call) => call.body)).toEqual([
            { category_id: 1, title: 'Mailing Lists', description: 'Which lists there are and how to join them.', url: '/pages/mailing-lists' },
            { category_id: 1, title: ' ', description: ' ', url: '//elsewhere.example.org' },
            { category_id: 1, title: ' ', description: ' ', url: '//elsewhere.example.org' }
        ]);
    });

    test('the save button is off while the link is saved; the address says where it opens', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET core /resources', ok(SECTIONS));
        api.on('POST core /resources/links', async () => {
            await held;
            return { status: 403, json: forbidden('Permission global:manage:resources is required, but not present.') };
        });

        await page.goto('/resources/links/new?category_id=1');
        const add = form(page, 'Add link');
        const save = add.getByRole('button', { name: 'Save link' });
        await expect(add.getByLabel('URL')).toHaveAccessibleDescription(URL_HELP);
        await add.getByLabel('Title').fill('Newsletter archive');
        await add.getByLabel('Description').fill('Every newsletter since 2010.');
        await add.getByLabel('URL').fill('https://www.aegee.org/newsletter/archive/');
        await save.click();

        await expect(save).toBeDisabled();
        release();
        await expect(toast(page, 'Could not save the link: Permission global:manage:resources is required, but not present.')).toBeVisible();
        await expect(save).toBeEnabled();
        expect(api.callsTo('POST core /resources/links').map((call) => call.body)).toEqual([{
            category_id: 1,
            title: 'Newsletter archive',
            description: 'Every newsletter since 2010.',
            url: 'https://www.aegee.org/newsletter/archive/'
        }]);
    });

    test('is busy until the link and the sections are in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET core /resources', ok(SECTIONS));
        api.on('GET core /resources/links/:id', async () => { await held; return { json: ok(LISTS) }; });

        await page.goto('/resources/links/12/edit');

        const edit = form(page, 'Edit link');
        await expect(edit).toHaveAttribute('aria-busy', 'true');
        release();
        await expect(edit).not.toHaveAttribute('aria-busy');
        await expect(edit.getByLabel('Title')).toHaveValue('Mailing Lists');
    });

    test('Cancel goes back to managing the page without saving', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources/links/new?category_id=1');
        const add = form(page, 'Add link');
        await add.getByLabel('Title').fill('Unsaved');
        await add.getByRole('link', { name: 'Cancel' }).click();

        await expect(page).toHaveURL(/\/resources\/manage$/);
        await expect(page.getByRole('region', { name: 'Stay informed', exact: true })).toBeVisible();
    });
});
