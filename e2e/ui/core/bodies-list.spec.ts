// Bodies list (/bodies): what visitors and members see, searching, filtering by type, paging and
// the deleted bodies for those who may see them.
import { forbidden, ok } from '../support/factories/base.ts';
import { body, permission } from '../support/factories/core.ts';
import { cellOf, sortBy, tableRows, toast, expectEmptyTable } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const bodiesTable = (page: import('@playwright/test').Page) => page.getByRole('table');
const loadMore = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Load more bodies' });

// 30 bodies: a full page, so the list offers to load more.
const fullPage = (from: number) => Array.from({ length: 30 }, (_, index) => body({ id: from + index, name: `AEGEE-Body ${String(from + index).padStart(3, '0')}` }));

test.describe('bodies list for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('shows the active bodies with their key facts and nothing to manage', async ({ page, api }) => {
        api.json('GET core /bodies', ok([
            body({ id: 1, code: 'ANT', name: 'AEGEE-Antenna', type: 'antenna', description: 'We are **the** antenna', founded_at: '1985-04-15' }),
            body({ id: 2, code: 'CAN', name: 'AEGEE-Contact', type: 'contact antenna', description: 'A contact antenna', founded_at: '2001-09-01' })
        ]));

        await page.goto('/bodies');

        await expect(page.getByRole('heading', { name: 'Bodies list' })).toBeVisible();
        const table = bodiesTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        const antenna = tableRows(table).filter({ hasText: 'AEGEE-Antenna' });
        await expect(await cellOf(table, antenna, 'Body code')).toHaveText('ANT');
        await expect(antenna.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(await cellOf(table, antenna, 'Type')).toHaveText('Antenna');
        await expect((await cellOf(table, antenna, 'Description')).getByText('the', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await expect(await cellOf(table, antenna, 'Foundation date')).toHaveText('1985-04-15');
        const contact = tableRows(table).filter({ hasText: 'AEGEE-Contact' });
        await expect(await cellOf(table, contact, 'Type')).toHaveText('Contact antenna');

        await expect(page.getByRole('combobox', { name: 'Filter on body type' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Create body' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Also show deleted bodies' })).toHaveCount(0);
        await expect(loadMore(page)).toBeHidden();

        const [list] = api.callsTo('GET core /bodies');
        expect(Object.fromEntries(list.query)).toEqual({ limit: '30', offset: '0', type: '' });
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(0);
    });

    test('renders a description as Markdown without its javascript links', async ({ page, api }) => {
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Antenna', description: '**Bold** [click me](javascript:alert(1)) and [our site](https://example.org)' })]));

        await page.goto('/bodies');

        const cell = await cellOf(bodiesTable(page), tableRows(bodiesTable(page)).filter({ hasText: 'AEGEE-Antenna' }), 'Description');
        await expect(cell.getByText('Bold')).toHaveJSProperty('tagName', 'STRONG');
        await expect(cell.getByRole('link', { name: 'our site' })).toHaveAttribute('href', 'https://example.org');
        await expect(cell.getByText('click me')).toBeVisible();
        await expect(cell.getByRole('link', { name: 'click me' })).toHaveCount(0);
    });
});

test.describe('bodies list for a member', () => {
    test('shows the type filter but nothing to manage', async ({ page, api }) => {
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Antenna' })]));

        await page.goto('/bodies');

        await expect(page).toHaveTitle('MyAEGEE | View bodies');
        await expect(tableRows(bodiesTable(page))).toHaveCount(1);
        await expect(page.getByRole('combobox', { name: 'Filter on body type' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create body' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Also show deleted bodies' })).toHaveCount(0);
        // Once by the menu, once by the page.
        await expect.poll(() => api.callsTo('GET core /my_permissions').length).toBe(2);
    });

    test('a body creator gets a link to the empty body form', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:create:body'));
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Antenna' })]));

        await page.goto('/bodies');
        await page.getByRole('link', { name: 'Create body' }).click();

        await expect(page).toHaveURL('/bodies/new');
        await expect(page.getByRole('button', { name: 'Save body' })).toBeVisible();
    });

    test('who may see deleted bodies can show and hide them', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:view_deleted:body'));
        api.on('GET core /bodies', ({ query }) => ({
            json: ok(query.get('all') === 'true'
                ? [body({ id: 1, name: 'AEGEE-Antenna', status: 'active' }), body({ id: 2, name: 'AEGEE-Gone', status: 'deleted' })]
                : [body({ id: 1, name: 'AEGEE-Antenna', status: 'active' })])
        }));

        await page.goto('/bodies');
        const table = bodiesTable(page);
        await expect(tableRows(table)).toHaveCount(1);
        await page.getByRole('button', { name: 'Also show deleted bodies' }).click();

        await expect(tableRows(table)).toHaveCount(2);
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'AEGEE-Gone' }), 'Status')).toHaveText('Deleted');
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'AEGEE-Antenna' }), 'Status')).toHaveText('Active');
        const shown = api.callsTo('GET core /bodies').at(-1)!;
        expect(shown.query.get('all')).toBe('true');
        expect(shown.query.get('offset')).toBe('0');

        await page.getByRole('button', { name: 'Only show active bodies' }).click();

        await expect(tableRows(table)).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Also show deleted bodies' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)!.query.has('all')).toBe(false);
        await expect(table.getByText('Status', { exact: true })).toHaveCount(0);
    });

    test('a body with another status has no status tag', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:view_deleted:body'));
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Odd', status: 'pending' as 'active' })]));

        await page.goto('/bodies');
        await page.getByRole('button', { name: 'Also show deleted bodies' }).click();

        const table = bodiesTable(page);
        await expect.poll(() => api.callsTo('GET core /bodies').length).toBe(2);
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'AEGEE-Odd' }), 'Status')).toHaveText('');
    });

    test('searching asks again with the text and replaces the rows', async ({ page, api }) => {
        api.on('GET core /bodies', ({ query }) => ({
            json: ok(query.get('query') === 'Mad'
                ? [body({ id: 2, name: 'AEGEE-Madrid' })]
                : [body({ id: 1, name: 'AEGEE-Antenna' })])
        }));

        await page.goto('/bodies');
        const table = bodiesTable(page);
        await expect(tableRows(table)).toHaveCount(1);
        await page.getByRole('textbox', { name: 'Search by name, body code or abbreviation' }).pressSequentially('Mad');

        await expect(tableRows(table).filter({ hasText: 'AEGEE-Madrid' })).toBeVisible();
        await expect(tableRows(table)).toHaveCount(1);
        const searched = api.callsTo('GET core /bodies').at(-1)!;
        expect(searched.query.get('query')).toBe('Mad');
        expect(searched.query.get('offset')).toBe('0');
        // Each keystroke cancels the request before it: no error for those.
        await expect(toast(page, 'Could not fetch bodies list')).toHaveCount(0);

        await page.getByRole('textbox', { name: 'Search by name, body code or abbreviation' }).fill('');

        await expect(tableRows(table).filter({ hasText: 'AEGEE-Antenna' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)!.query.has('query')).toBe(false);
    });

    test('asks for the permissions once, not again for every search', async ({ page, api }) => {
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Antenna' })]));

        await page.goto('/bodies');
        await expect(page.getByRole('combobox', { name: 'Filter on body type' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /my_permissions').length).toBe(2);
        await page.getByRole('textbox', { name: 'Search by name, body code or abbreviation' }).fill('A');
        await page.getByRole('textbox', { name: 'Search by name, body code or abbreviation' }).fill('AE');

        await expect.poll(() => api.callsTo('GET core /bodies').length).toBe(3);
        await expect(tableRows(bodiesTable(page))).toHaveCount(1);
        await expect.poll(() => api.callsTo('GET core /my_permissions')).toHaveLength(2);
    });

    test('filtering by body types asks for those types', async ({ page, api }) => {
        api.on('GET core /bodies', ({ query }) => ({
            json: ok(query.get('type') === 'antenna,working group'
                ? [body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 3, name: 'IT Working Group', type: 'working group' })]
                : [body({ id: 1, name: 'AEGEE-Antenna' })])
        }));

        await page.goto('/bodies');
        const filter = page.getByRole('combobox', { name: 'Filter on body type' });
        await expect(filter).toContainText('Select body types');
        await filter.click();
        await page.getByRole('option', { name: /^Antenna/ }).click();
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)?.query.get('type')).toBe('antenna');
        await page.getByRole('option', { name: /^Working group/ }).click();
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)?.query.get('type')).toBe('antenna,working group');
        await page.keyboard.press('Escape');

        await expect(filter).toContainText('2 types selected');
        await expect(tableRows(bodiesTable(page)).filter({ hasText: 'IT Working Group' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)!.query.get('offset')).toBe('0');
    });

    test('one chosen type reads as one type', async ({ page, api }) => {
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Antenna' })]));

        await page.goto('/bodies');
        const filter = page.getByRole('combobox', { name: 'Filter on body type' });
        await filter.click();
        await page.getByRole('option', { name: /^Commission/ }).click();
        await page.keyboard.press('Escape');

        await expect(filter).toContainText('1 type selected');
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)?.query.get('type')).toBe('commission');
    });

    test('a full page offers more bodies and appends them', async ({ page, api }) => {
        api.on('GET core /bodies', ({ query }) => ({
            json: ok(query.get('offset') === '0' ? fullPage(1) : [body({ id: 31, name: 'AEGEE-Zagreb' })])
        }));

        await page.goto('/bodies');
        const table = bodiesTable(page);
        await expect(tableRows(table)).toHaveCount(30);
        await loadMore(page).click();

        await expect(tableRows(table)).toHaveCount(31);
        await expect(tableRows(table).filter({ hasText: 'AEGEE-Zagreb' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies').at(-1)!.query.get('offset')).toBe('30');
        await expect(loadMore(page)).toBeHidden();
    });

    test('loading more is disabled while the list loads', async ({ page, api }) => {
        api.on('GET core /bodies', ({ query }) => (query.get('offset') === '0'
            ? { json: ok(fullPage(1)) }
            : { json: ok([]), delayMs: 1500 }));

        await page.goto('/bodies');
        await expect(tableRows(bodiesTable(page))).toHaveCount(30);
        await loadMore(page).click();

        await expect(loadMore(page)).toBeDisabled();
        await expect(loadMore(page)).toBeHidden();
    });

    test('says so when there are no bodies', async ({ page, api }) => {
        api.json('GET core /bodies', ok([]));

        await page.goto('/bodies');

        await expect.poll(() => api.callsTo('GET core /bodies').length).toBe(1);
        await expectEmptyTable(bodiesTable(page));
        await expect(loadMore(page)).toBeHidden();
    });

    test('a failing list says why and can be tried again', async ({ page, api }) => {
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });

        await page.goto('/bodies');

        await expect(toast(page, 'Could not fetch bodies list: Something went wrong on the server.')).toBeVisible();
        await expect(loadMore(page)).toBeEnabled();
    });

    test('failing permissions say why and keep the bodies', async ({ page, api, myPermissions }) => {
        api.json('GET core /bodies', ok(fullPage(1)));
        // The first answer is for the app, which logs a member out without it; the page's fails.
        let asked = 0;
        api.on('GET core /my_permissions', () => (++asked === 1
            ? { json: ok(myPermissions) }
            : { status: 500, json: { success: false, message: 'Something went wrong on the server.' } }));

        await page.goto('/bodies');

        await expect(toast(page, 'Could not fetch bodies list: Something went wrong on the server.')).toBeVisible();
        await expect(tableRows(bodiesTable(page))).toHaveCount(30);
        await expect(loadMore(page)).toBeEnabled();
    });

    test('sorting by name sorts the loaded bodies without asking again', async ({ page, api, layout }) => {
        api.json('GET core /bodies', ok([body({ id: 1, name: 'AEGEE-Zagreb', code: 'ZAG' }), body({ id: 2, name: 'AEGEE-Aachen', code: 'AAC' })]));

        await page.goto('/bodies');
        const table = bodiesTable(page);
        await expect(tableRows(table).first()).toContainText('AEGEE-Zagreb');
        await sortBy(table, 'Body name', layout);

        await expect(tableRows(table).first()).toContainText('AEGEE-Aachen');
        await sortBy(table, 'Body code', layout, 'desc');
        await expect(tableRows(table).first()).toContainText('AEGEE-Zagreb');
        await expect.poll(() => api.callsTo('GET core /bodies')).toHaveLength(1);
    });

    test('showing deleted bodies without the right says why', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:view_deleted:body'));
        api.on('GET core /bodies', ({ query }) => (query.get('all')
            ? { status: 403, json: forbidden('Permission global:view_deleted:body is required, but not present.') }
            : { json: ok([body({ id: 1, name: 'AEGEE-Antenna' })]) }));

        await page.goto('/bodies');
        await page.getByRole('button', { name: 'Also show deleted bodies' }).click();

        await expect(toast(page, 'Could not fetch bodies list: Permission global:view_deleted:body is required, but not present.')).toBeVisible();
    });
});
