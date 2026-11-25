// Season editor (/summeruniversity/seasons/new and /summeruniversity/seasons/:year/edit).
import { ok, validationError } from '../support/factories/base.ts';
import { suSeason } from '../support/factories/summeruniversity.ts';
import { openMenu, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const SEASON = suSeason({
    year: 2027,
    name: 'Summer University 2027',
    active: true,
    // 09:00 UTC is 10:00 in Brussels in winter, 08:00 UTC is 10:00 in summer.
    event_submission_deadline: '2027-01-15T09:00:00.000Z',
    application_period_starts: '2027-03-01T09:00:00.000Z',
    application_period_ends: '2027-04-30T08:00:00.000Z'
});

// What a service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';

test.describe('Summer University season editor', () => {
    test('creating a season sends its dates and goes back to the list', async ({ page, api }) => {
        api.on('POST summeruniversity /seasons', ({ body }) => ({
            status: 201,
            json: { success: true, message: 'Season successfully created.', data: suSeason({ ...(body as object), active: false }) }
        }));
        api.json('GET summeruniversity /seasons', ok([SEASON]));
        await page.goto('/summeruniversity/seasons/new');

        const year = page.getByLabel('Year');
        await expect(year).toBeEnabled();
        await expect(year).toHaveValue('');
        await expect(page.getByText('The year can\'t be changed')).toHaveCount(0);

        await year.fill('2028');
        await page.getByLabel('Name').fill('Summer University 2028');
        await page.getByLabel('Event submission deadline').fill('2028-01-15T10:00');
        // Summer time: 10:00 in Brussels is 08:00 UTC.
        await page.getByLabel('Application period starts').fill('2028-04-03T10:00');
        await page.getByRole('button', { name: 'Save season' }).click();

        await expect(toast(page, 'Season is saved.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons');
        // An empty date is sent as null.
        expect(api.callsTo('POST summeruniversity /seasons').map((call) => call.body)).toEqual([{
            year: 2028,
            name: 'Summer University 2028',
            event_submission_deadline: '2028-01-15T09:00:00.000Z',
            application_period_starts: '2028-04-03T08:00:00.000Z',
            application_period_ends: null
        }]);
        // Creating asks for nothing before saving: the only request for the seasons is the list's.
        expect(api.callsTo('GET summeruniversity /seasons')).toHaveLength(1);
    });

    test('editing a season keeps its year and sends a PUT', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([SEASON, suSeason({ year: 2026, active: false })]));
        api.on('PUT summeruniversity /seasons/:year', ({ body }) => ({
            json: { success: true, message: 'Season successfully updated.', data: { ...SEASON, ...(body as object) } }
        }));
        await page.goto('/summeruniversity/seasons/2027/edit');

        const year = page.getByLabel('Year');
        await expect(year).toHaveValue('2027');
        await expect(year).toBeDisabled();
        await expect(page.getByText('The year can\'t be changed, as events refer to the season by its year.')).toBeVisible();
        await expect(page.getByLabel('Name')).toHaveValue('Summer University 2027');
        // The dates are shown in local time.
        await expect(page.getByLabel('Event submission deadline')).toHaveValue('2027-01-15T10:00');
        await expect(page.getByLabel('Application period starts')).toHaveValue('2027-03-01T10:00');
        await expect(page.getByLabel('Application period ends')).toHaveValue('2027-04-30T10:00');

        await page.getByLabel('Name').fill('Summer University 2027, renamed');
        await page.getByLabel('Event submission deadline').fill('');
        await page.getByRole('button', { name: 'Save season' }).click();

        await expect(toast(page, 'Season is saved.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons');
        expect(api.callsTo('PUT summeruniversity /seasons/:year').map((call) => [call.params.year, call.body])).toEqual([['2027', {
            year: 2027,
            name: 'Summer University 2027, renamed',
            event_submission_deadline: null,
            application_period_starts: '2027-03-01T09:00:00.000Z',
            application_period_ends: '2027-04-30T08:00:00.000Z'
        }]]);
    });

    test('a season without dates leaves the date fields empty', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([suSeason({
            year: 2026, active: false, event_submission_deadline: null, application_period_starts: null, application_period_ends: null
        })]));
        await page.goto('/summeruniversity/seasons/2026/edit');

        await expect(page.getByLabel('Year')).toHaveValue('2026');
        await expect(page.getByLabel('Event submission deadline')).toHaveValue('');
        await expect(page.getByLabel('Application period starts')).toHaveValue('');
        await expect(page.getByLabel('Application period ends')).toHaveValue('');
    });

    test('an unknown year goes back to the list', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([SEASON]));
        await page.goto('/summeruniversity/seasons/2030/edit');

        await expect(toast(page, 'Season is not found')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons');
    });

    test('a failing season request goes back to the list', async ({ page, api }) => {
        let asked = 0;
        api.on('GET summeruniversity /seasons', () => (asked++ === 0 ? { abort: 'failed' } : { json: ok([SEASON]) }));
        await page.goto('/summeruniversity/seasons/2027/edit');

        await expect(toast(page, 'Could not fetch season: Network Error')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons');
        await expect(page.getByRole('table')).toContainText('Summer University 2027');
    });

    test('the service\'s errors show under each field', async ({ page, api }) => {
        // What summeruniversity answers for a year that is taken and a name longer than 255 characters.
        api.on('POST summeruniversity /seasons', {
            status: 422,
            json: validationError({ year: ['year must be unique'], name: ['This text should be at most 255 characters long.'] })
        });
        await page.goto('/summeruniversity/seasons/new');

        await page.getByLabel('Year').fill('2027');
        await page.getByLabel('Name').fill('S'.repeat(256));
        await page.getByRole('button', { name: 'Save season' }).click();

        await expect(toast(page, 'Some of the season data is invalid.')).toBeVisible();
        await expect(page.getByText('year must be unique')).toBeVisible();
        await expect(page.getByText('This text should be at most 255 characters long.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons/new');
        // The form can be sent again.
        await expect(page.getByRole('button', { name: 'Save season' })).toBeEnabled();
    });

    test('an application period that ends before it starts says why', async ({ page, api }) => {
        // The model's own check on the two dates, which has no field of its own.
        api.on('POST summeruniversity /seasons', {
            status: 422,
            json: validationError({ applicationPeriodOrder: ['Application period cannot end before or at the same time it starts.'] })
        });
        await page.goto('/summeruniversity/seasons/new');

        await page.getByLabel('Year').fill('2028');
        await page.getByLabel('Name').fill('Summer University 2028');
        await page.getByLabel('Application period starts').fill('2028-04-03T10:00');
        await page.getByLabel('Application period ends').fill('2028-04-01T10:00');
        await page.getByRole('button', { name: 'Save season' }).click();

        await expect(toast(page, 'Some of the season data is invalid.')).toBeVisible();
        await expect(page.getByText('Application period cannot end before or at the same time it starts.')).toBeVisible();
    });

    test('other save errors show the message', async ({ page, api }) => {
        api.on('POST summeruniversity /seasons', { status: 403, json: { success: false, message: 'You are not allowed to manage seasons.' } });
        await page.goto('/summeruniversity/seasons/new');

        await page.getByLabel('Year').fill('2028');
        await page.getByLabel('Name').fill('Summer University 2028');
        await page.getByRole('button', { name: 'Save season' }).click();

        await expect(toast(page, 'Could not save season: You are not allowed to manage seasons.')).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons/new');
    });

    test('the year and the name are required', async ({ page, api }) => {
        await page.goto('/summeruniversity/seasons/new');

        await page.getByRole('button', { name: 'Save season' }).click();
        expect(await page.getByLabel('Year').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        await page.getByLabel('Year').fill('2028');
        await page.getByRole('button', { name: 'Save season' }).click();
        expect(await page.getByLabel('Name').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        expect(api.callsTo('POST summeruniversity /seasons')).toHaveLength(0);
    });

    test('a member who leaves while the season loads is not sent on by its late error', async ({ page, api, layout }) => {
        let release!: () => void;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET summeruniversity /seasons', async () => {
            await released;
            return { status: 500, json: { success: false, message: DATABASE_DOWN } };
        });
        // The page the member goes to belongs to another area: any answer will do for it.
        api.fallback(mockEverything);
        // The mock records a call only once it has answered it, so the test waits for the request.
        const isLate = (url: string) => new URL(url).pathname.replace(/\/$/, '') === '/api/summeruniversity/seasons';
        const asked = page.waitForRequest((request) => isLate(request.url()));
        await page.goto('/summeruniversity/seasons/2027/edit');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL('/dashboard');

        const late = page.waitForResponse((response) => isLate(response.url()));
        release();
        await late;
        // Two frames: the page has handled the answer by then.
        await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));

        // Counted at once: a retrying matcher would only wait until a toast has gone.
        expect(await toast(page, /Could not fetch season/).count()).toBe(0);
        await expect(page).toHaveURL('/dashboard');
    });
});
