// The events calendar (/calendar): events, Summer Universities, statutory events and the
// online events of AEGEE's Google calendar in one month grid. Public.
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { eventSummary } from '../support/factories/events.ts';
import { ics, dashboardStatutoryEvent, dashboardSummerUniversity, type IcsEvent } from '../support/factories/dashboard.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { dialog, freezeTime, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ONLINE = '/services/calendar-cors/calendar/ical/aegee.eu_v5mn651imeqpvs87v4ln7hr1f4@group.calendar.google.com/public/basic.ics';

const calendar = (page: Page) => page.getByRole('region', { name: 'Events calendar' });

const workshop: IcsEvent = { summary: 'Online Workshop', start: '2027-03-04T18:00:00Z', end: '2027-03-04T19:30:00Z', description: 'Learn to <strong>moderate</strong> a meeting.' };

// One of each kind in March 2027, the month the calendar opens on.
const answerAll = (api: ApiMock, online: IcsEvent[] = [workshop]): void => {
    api.json('GET events /', ok([
        eventSummary({ id: 11, name: 'Spring Training', url: 'spring-training', type: 'training', starts: '2027-03-10T08:00:00Z', ends: '2027-03-12T16:00:00Z' }),
        // Without a URL the link uses the id. (events allows that; its factory types the URL as a string.)
        eventSummary({ id: 12, name: 'Network Meeting Utrecht', url: null as unknown as string, type: 'nwm', starts: '2027-03-30T08:00:00Z', ends: '2027-03-31T16:00:00Z' })
    ]));
    api.json('GET summeruniversity /', ok([
        // Without a URL the link uses the id.
        dashboardSummerUniversity({ id: 77, name: 'Summer University Lisbon', url: null, starts: '2027-03-16T08:00:00Z', ends: '2027-03-18T16:00:00Z' })
    ]));
    api.json('GET statutory /', ok([
        dashboardStatutoryEvent({ id: 21, name: 'Agora Utrecht', url: 'agora-utrecht', starts: '2027-03-23T08:00:00Z', ends: '2027-03-25T16:00:00Z' })
    ]));
    api.url('GET', ONLINE, { body: ics(online), contentType: 'text/calendar' });
};

test.describe('events calendar', () => {
    test.beforeEach(async ({ page }) => {
        await freezeTime(page);
    });

    test('shows the legend and this month\'s events of every kind, each linking to its module', async ({ page, api }) => {
        answerAll(api);

        await page.goto('/calendar');

        for (const kind of ['Training Event', 'Network Meeting', 'Conference', 'Cultural Event', 'Thematic Event', 'Statutory', 'Summer University', 'Online event']) {
            await expect(page.getByRole('main').getByText(kind, { exact: true })).toBeVisible();
        }
        await expect(calendar(page).getByRole('heading', { name: 'March 2027' })).toBeVisible();
        await expect(calendar(page).getByRole('link', { name: 'Spring Training' })).toHaveAttribute('href', '/events/spring-training');
        await expect(calendar(page).getByRole('link', { name: 'Network Meeting Utrecht' })).toHaveAttribute('href', '/events/12');
        await expect(calendar(page).getByRole('link', { name: 'Summer University Lisbon' })).toHaveAttribute('href', '/summeruniversity/77');
        await expect(calendar(page).getByRole('link', { name: 'Agora Utrecht' })).toHaveAttribute('href', '/statutory/agora-utrecht');
        // Online events have no page of their own.
        await expect(calendar(page).getByText('Online Workshop')).toBeVisible();
        await expect(calendar(page).getByRole('link', { name: 'Online Workshop' })).toHaveCount(0);

        // Each source is asked once, for everything it has.
        expect(api.callsTo('GET events /').map((call) => call.query.toString())).toEqual(['']);
        expect(api.callsTo('GET summeruniversity /')).toHaveLength(1);
        expect(api.callsTo('GET statutory /')).toHaveLength(1);
        expect(api.callsTo(`GET url ${ONLINE}`)).toHaveLength(1);
    });

    test.describe('for a visitor', () => {
        test.use({ session: 'anonymous' });

        test('is shown without logging in', async ({ page, api }) => {
            answerAll(api);

            await page.goto('/calendar');

            await expect(page).toHaveURL(/\/calendar$/);
            await expect(calendar(page).getByRole('link', { name: 'Spring Training' })).toBeVisible();
            expect(api.callsTo('GET core /members/me')).toHaveLength(0);
        });
    });

    test('clicking an event shows its times and description; "Event page" opens the event in the app', async ({ page, api }) => {
        answerAll(api);
        await page.goto('/calendar');

        // Kept by the page as long as it isn't loaded again.
        await page.evaluate(() => { (window as { calendarOpened?: boolean }).calendarOpened = true; });
        await calendar(page).getByRole('link', { name: 'Spring Training' }).click();

        const details = dialog(page, 'Spring Training');
        await expect(details).toContainText('Starts: 10 March 2027 9:00');
        await expect(details).toContainText('Ends: 12 March 2027 17:00');
        await expect(details.getByRole('strong').filter({ hasText: 'great' })).toBeVisible();

        api.fallback(mockEverything);
        await details.getByRole('button', { name: 'Event page' }).click();

        await expect(page).toHaveURL(/\/events\/spring-training$/);
        await expect(page).toHaveTitle('MyAEGEE | Display single event');
        await expect(details).toBeHidden();
        // In the app: the page is not loaded again, and the app doesn't fetch the member again.
        expect(await page.evaluate(() => (window as { calendarOpened?: boolean }).calendarOpened)).toBe(true);
        expect(api.callsTo('GET core /members/me')).toHaveLength(1);
    });

    test('Cancel and Escape close the event without leaving the calendar', async ({ page, api }) => {
        answerAll(api);
        await page.goto('/calendar');
        const event = calendar(page).getByRole('link', { name: 'Agora Utrecht' });

        await event.click();
        await dialog(page, 'Agora Utrecht').getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog(page, 'Agora Utrecht')).toBeHidden();

        await event.click();
        await expect(dialog(page, 'Agora Utrecht')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog(page, 'Agora Utrecht')).toBeHidden();

        await expect(page).toHaveURL(/\/calendar$/);
    });

    test('clicking an online event shows its description without an event page, and runs nothing in it', async ({ page, api }) => {
        answerAll(api, [{
            ...workshop,
            description: '<strong>Join</strong> us on <a href="https://meet.example.org/aegee">the meeting link</a>.<img src="data:image/png;base64,AAAA" onerror="window.__injected = true"><script>window.__injected = true</script>'
        }]);
        await page.goto('/calendar');

        await calendar(page).getByText('Online Workshop').click();

        const details = dialog(page, 'Online Workshop');
        // 18:00 UTC is 19:00 in Brussels in winter.
        await expect(details).toContainText('Starts: 4 March 2027 19:00');
        await expect(details).toContainText('Ends: 4 March 2027 20:30');
        await expect(details.getByRole('strong').filter({ hasText: 'Join' })).toBeVisible();
        await expect(details.getByRole('link', { name: 'the meeting link' })).toHaveAttribute('href', 'https://meet.example.org/aegee');
        await expect(details.getByRole('button', { name: 'Event page' })).toHaveCount(0);
        expect(await page.evaluate(() => (window as { __injected?: boolean }).__injected)).toBeUndefined();

        await details.getByRole('button', { name: 'Cancel' }).click();
        await expect(details).toBeHidden();
    });

    test('an online event without a description shows its times only', async ({ page, api }) => {
        answerAll(api, [{ summary: 'Online Coffee', start: '2027-03-05T11:00:00Z', end: '2027-03-05T11:30:00Z' }]);
        await page.goto('/calendar');

        await calendar(page).getByText('Online Coffee').click();

        const details = dialog(page, 'Online Coffee');
        await expect(details).toContainText('Starts: 5 March 2027 12:00');
        await expect(details).toContainText('Ends: 5 March 2027 12:30');
        await page.keyboard.press('Escape');
        await expect(details).toBeHidden();
    });

    test('shows the times of an event in summer time', async ({ page, api }) => {
        await freezeTime(page, '2027-07-03T12:00:00+02:00');
        api.json('GET events /', ok([
            eventSummary({ name: 'Summer Training', url: 'summer-training', starts: '2027-07-14T07:00:00Z', ends: '2027-07-16T15:30:00Z' })
        ]));
        api.json('GET summeruniversity /', ok([]));
        api.json('GET statutory /', ok([]));
        api.url('GET', ONLINE, { body: ics([]), contentType: 'text/calendar' });
        await page.goto('/calendar');

        await calendar(page).getByRole('link', { name: 'Summer Training' }).click();

        // 07:00 UTC is 9:00 in Brussels in summer.
        await expect(dialog(page, 'Summer Training')).toContainText('Starts: 14 July 2027 9:00');
        await expect(dialog(page, 'Summer Training')).toContainText('Ends: 16 July 2027 17:30');
    });

    test('the next and the previous month show their events without asking again', async ({ page, api }) => {
        api.json('GET events /', ok([
            eventSummary({ name: 'April Training', url: 'april-training', starts: '2027-04-14T08:00:00Z', ends: '2027-04-15T16:00:00Z' }),
            eventSummary({ name: 'February Training', url: 'february-training', starts: '2027-02-10T08:00:00Z', ends: '2027-02-11T16:00:00Z' })
        ]));
        api.json('GET summeruniversity /', ok([]));
        api.json('GET statutory /', ok([]));
        api.url('GET', ONLINE, { body: ics([]), contentType: 'text/calendar' });
        await page.goto('/calendar');
        await expect(calendar(page)).not.toHaveAttribute('aria-busy');

        await calendar(page).getByRole('button', { name: 'Next month' }).click();
        await expect(calendar(page).getByRole('heading', { name: 'April 2027' })).toBeVisible();
        await expect(calendar(page).getByRole('link', { name: 'April Training' })).toBeVisible();

        await calendar(page).getByRole('button', { name: 'Previous month' }).click();
        await calendar(page).getByRole('button', { name: 'Previous month' }).click();
        await expect(calendar(page).getByRole('heading', { name: 'February 2027' })).toBeVisible();
        await expect(calendar(page).getByRole('link', { name: 'February Training' })).toBeVisible();

        await calendar(page).getByRole('button', { name: 'today' }).click();
        await expect(calendar(page).getByRole('heading', { name: 'March 2027' })).toBeVisible();

        expect(api.callsTo('GET events /')).toHaveLength(1);
        expect(api.callsTo('GET summeruniversity /')).toHaveLength(1);
        expect(api.callsTo('GET statutory /')).toHaveLength(1);
        expect(api.callsTo(`GET url ${ONLINE}`)).toHaveLength(1);
    });

    const FAILURES = [
        { kind: 'events', fail: (api: ApiMock) => api.on('GET events /', { status: 500, json: { success: false, message: 'Database is down' } }), message: 'Could not load events list: Database is down', missing: 'Spring Training' },
        { kind: 'Summer Universities', fail: (api: ApiMock) => api.on('GET summeruniversity /', { status: 500, json: { success: false, message: 'Database is down' } }), message: 'Could not load Summer Universities list: Database is down', missing: 'Summer University Lisbon' },
        { kind: 'statutory events', fail: (api: ApiMock) => api.on('GET statutory /', { status: 500, json: { success: false, message: 'Database is down' } }), message: 'Could not load statutory events list: Database is down', missing: 'Agora Utrecht' },
        { kind: 'online events', fail: (api: ApiMock) => api.url('GET', ONLINE, { abort: 'failed' }), message: 'Could not load online events list: Failed to fetch', missing: 'Online Workshop' }
    ];
    for (const { kind, fail, message, missing } of FAILURES) {
        test(`shows the other events when the ${kind} cannot be loaded`, async ({ page, api }) => {
            answerAll(api);
            fail(api);

            await page.goto('/calendar');

            await expect(toast(page, message)).toBeVisible();
            await expect(calendar(page)).not.toHaveAttribute('aria-busy');
            for (const name of ['Spring Training', 'Summer University Lisbon', 'Agora Utrecht', 'Online Workshop'].filter((item) => item !== missing)) {
                await expect(calendar(page).getByText(name, { exact: true })).toBeVisible();
            }
            await expect(calendar(page).getByText(missing, { exact: true })).toHaveCount(0);
        });
    }

    test('shows the first online event of a calendar without a time zone block', async ({ page, api }) => {
        answerAll(api);
        api.url('GET', ONLINE, {
            body: ics([workshop, { summary: 'Online Debate', start: '2027-03-11T18:00:00Z', end: '2027-03-11T19:00:00Z' }], { timezone: false }),
            contentType: 'text/calendar'
        });

        await page.goto('/calendar');

        await expect(calendar(page).getByText('Online Workshop')).toBeVisible();
        await expect(calendar(page).getByText('Online Debate')).toBeVisible();
    });

    test('says so when the online calendar answers with an error', async ({ page, api }) => {
        answerAll(api);
        api.url('GET', ONLINE, { status: 502, body: '<html><body>Bad gateway</body></html>', contentType: 'text/html' });

        await page.goto('/calendar');

        await expect(toast(page, /^Could not load online events list/)).toBeVisible();
        await expect(calendar(page).getByRole('link', { name: 'Spring Training' })).toBeVisible();
    });

    test('is busy until every source has answered', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        answerAll(api);
        api.url('GET', ONLINE, async () => { await held; return { body: ics([workshop]), contentType: 'text/calendar' }; });

        await page.goto('/calendar');

        await expect(calendar(page)).toHaveAttribute('aria-busy', 'true');
        await expect(calendar(page).getByRole('link', { name: 'Spring Training' })).toHaveCount(0);

        release();

        await expect(calendar(page)).not.toHaveAttribute('aria-busy');
        await expect(calendar(page).getByRole('link', { name: 'Spring Training' })).toBeVisible();
        await expect(calendar(page).getByText('Online Workshop')).toBeVisible();
    });
});
