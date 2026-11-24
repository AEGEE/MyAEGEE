// The dashboard (/dashboard): where a member lands after logging in. Their bodies and circles,
// the events they applied to, and the latest statutory event.
import type { Page } from '@playwright/test';

import { FIXED_NOW, iso, notFound, ok } from '../support/factories/base.ts';
import { body, circle } from '../support/factories/core.ts';
import { appliedEvent, appliedStatutoryEvent, appliedSummerUniversity, latestStatutoryEvent, dashboardStatutoryPermissions } from '../support/factories/dashboard.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { freezeTime, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const NOW = Date.parse(FIXED_NOW);

const tile = (page: Page, name: string | RegExp) => page.getByRole('article', { name });
const upcoming = (page: Page) => tile(page, 'Upcoming events you\'ve applied to');
const past = (page: Page) => tile(page, 'Past events you\'ve applied to');
const statutory = (page: Page) => tile(page, 'Statutory events');

// What the page asks for besides the member: nothing applied to, no statutory event yet.
const nothingYet = (api: ApiMock): void => {
    api.json('GET events /mine/participating', ok([]));
    api.json('GET statutory /mine', ok([]));
    api.json('GET summeruniversity /mine/participating', ok([]));
    api.on('GET statutory /events/latest', { status: 404, json: notFound('Event with such url or ID is not found.') });
};

test.describe('dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await freezeTime(page);
    });

    test('shows the member\'s name, bodies (primary first) and circles, with links', async ({ page, api, me }) => {
        nothingYet(api);
        const primary = body({ id: 7, name: 'AEGEE-Zaragoza' });
        me!.bodies = [body({ id: 8, name: 'Information Technology Committee', type: 'committee' }), body({ id: 9, name: 'AEGEE-Brussels' }), primary];
        me!.primary_body_id = primary.id;
        me!.primary_body = primary;
        me!.circles = [circle({ id: 21, name: 'Web team' }), circle({ id: 22, name: 'Board AEGEE-Zaragoza', body_id: 7 }), circle({ id: 23, name: 'Culture team' })];

        await page.goto('/dashboard');

        const member = tile(page, 'Alex Member');
        await expect(member.getByText('You are member of these bodies:')).toBeVisible();
        await expect(member.getByText('You are member of these circles:')).toBeVisible();
        await expect(member.getByRole('link')).toHaveText([
            'AEGEE-Zaragoza', 'AEGEE-Brussels', 'Information Technology Committee', 'Board AEGEE-Zaragoza', 'Culture team', 'Web team'
        ]);
        await expect(member.getByRole('link', { name: 'AEGEE-Zaragoza', exact: true })).toHaveAttribute('href', '/bodies/7');
        await expect(member.getByRole('link', { name: 'Information Technology Committee' })).toHaveAttribute('href', '/bodies/8');
        await expect(member.getByRole('link', { name: 'Web team' })).toHaveAttribute('href', '/circles/21');
        await expect(member.getByText('You are currently not a member of any body.')).toBeHidden();
        await expect(member.getByText('You are currently not a member of any circle.')).toBeHidden();

        // The member was fetched when the app started; the dashboard doesn't ask again.
        expect(api.callsTo('GET core /members/me').length).toBe(1);
    });

    test('lists upcoming and past applications of all three modules, sorted, with links to each module', async ({ page, api }) => {
        api.json('GET events /mine/participating', ok([
            appliedEvent({ id: 31, name: 'Spring Training', url: 'spring-training', type: 'training', starts: '2027-04-10T08:00:00Z', ends: '2027-04-15T16:00:00Z' }),
            appliedEvent({ id: 32, name: 'Winter Network Meeting', url: 'winter-nwm', type: 'nwm', starts: '2027-01-10T08:00:00Z', ends: '2027-01-12T16:00:00Z' })
        ]));
        api.json('GET statutory /mine', ok([
            appliedStatutoryEvent({ id: 41, name: 'Agora Utrecht', url: 'agora-utrecht', type: 'agora', starts: '2027-04-01T08:00:00Z', ends: '2027-04-05T16:00:00Z' }),
            appliedStatutoryEvent({ id: 42, name: 'EPM Kraków', url: 'epm-krakow', type: 'epm', starts: '2026-11-01T08:00:00Z', ends: '2026-11-04T16:00:00Z' }),
            appliedStatutoryEvent({ id: 43, name: 'Agora Ankara', url: 'agora-ankara', type: 'agora', starts: '2026-12-01T08:00:00Z', ends: '2026-12-04T16:00:00Z' })
        ]));
        api.json('GET summeruniversity /mine/participating', ok([
            // Without a URL the link uses the id.
            appliedSummerUniversity({ id: 51, name: 'Summer University Lisbon', url: null, type: 'pilot', starts: '2027-07-10T08:00:00Z', ends: '2027-07-24T16:00:00Z' }),
            appliedSummerUniversity({ id: 52, name: 'Summer University Rome', url: 'su-rome', type: 'regular', starts: '2026-08-01T08:00:00Z', ends: '2026-08-14T16:00:00Z' })
        ]));
        api.on('GET statutory /events/latest', { status: 404, json: notFound('Event with such url or ID is not found.') });

        await page.goto('/dashboard');

        await expect(upcoming(page).getByRole('link')).toHaveText([
            'Agora Utrecht - 2027-04-01',
            'Spring Training - 2027-04-10',
            'Summer University Lisbon - 2027-07-10'
        ]);
        await expect(upcoming(page).getByRole('link', { name: /Agora Utrecht/ })).toHaveAttribute('href', '/statutory/agora-utrecht');
        await expect(upcoming(page).getByRole('link', { name: /Spring Training/ })).toHaveAttribute('href', '/events/spring-training');
        await expect(upcoming(page).getByRole('link', { name: /Summer University Lisbon/ })).toHaveAttribute('href', '/summeruniversity/51');

        await expect(past(page).getByRole('link')).toHaveText(['Winter Network Meeting', 'Agora Ankara', 'EPM Kraków', 'Summer University Rome']);
        await expect(past(page).getByRole('link', { name: 'Summer University Rome' })).toHaveAttribute('href', '/summeruniversity/su-rome');
        await expect(past(page).getByRole('link', { name: 'Winter Network Meeting' })).toHaveAttribute('href', '/events/winter-nwm');
        await expect(past(page).getByRole('link', { name: 'EPM Kraków' })).toHaveAttribute('href', '/statutory/epm-krakow');

        await expect(upcoming(page).getByText('You haven\'t applied to any upcoming events yet.')).toBeHidden();
        await expect(past(page).getByText('You haven\'t applied to any past events yet.')).toBeHidden();
    });

    test('an event that has started and not ended yet is upcoming; one that ended yesterday is past', async ({ page, api }) => {
        api.json('GET events /mine/participating', ok([
            appliedEvent({ name: 'Running Training', starts: iso(-1, NOW), ends: iso(1, NOW) }),
            appliedEvent({ name: 'Finished Training', starts: iso(-3, NOW), ends: iso(-1, NOW) })
        ]));
        api.json('GET statutory /mine', ok([]));
        api.json('GET summeruniversity /mine/participating', ok([]));
        api.on('GET statutory /events/latest', { status: 404, json: notFound('Event with such url or ID is not found.') });

        await page.goto('/dashboard');

        await expect(upcoming(page).getByRole('link')).toHaveText(['Running Training - 2027-02-28']);
        await expect(past(page).getByRole('link')).toHaveText(['Finished Training']);
    });

    test('leaves out cancelled and rejected applications', async ({ page, api }) => {
        const later = { starts: '2027-05-01T08:00:00Z', ends: '2027-05-03T16:00:00Z' };
        const evenLater = { starts: '2027-06-01T08:00:00Z', ends: '2027-06-03T16:00:00Z' };
        api.json('GET events /mine/participating', ok([
            appliedEvent({ ...later, name: 'Accepted Training', applications: [{ user_id: 2, status: 'accepted' }] }),
            appliedEvent({ ...later, name: 'Rejected Training', applications: [{ user_id: 2, status: 'rejected' }] })
        ]));
        api.json('GET statutory /mine', ok([
            appliedStatutoryEvent({ ...later, name: 'Cancelled Agora', applications: [{ user_id: 2, cancelled: true, status: 'pending' }] }),
            appliedStatutoryEvent({ ...evenLater, name: 'Pending Agora', applications: [{ user_id: 2, cancelled: false, status: 'pending' }] })
        ]));
        api.json('GET summeruniversity /mine/participating', ok([
            appliedSummerUniversity({ ...later, name: 'Rejected Summer University', applications: [{ user_id: 2, status: 'rejected' }] })
        ]));
        api.on('GET statutory /events/latest', { status: 404, json: notFound('Event with such url or ID is not found.') });

        await page.goto('/dashboard');

        await expect(upcoming(page).getByRole('link')).toHaveText([/Accepted Training/, /Pending Agora/]);
        await expect(past(page).getByText('You haven\'t applied to any past events yet.')).toBeVisible();
    });

    test('says so when the member has applied to nothing', async ({ page, api }) => {
        nothingYet(api);

        await page.goto('/dashboard');

        await expect(upcoming(page).getByText('You haven\'t applied to any upcoming events yet.')).toBeVisible();
        await expect(past(page).getByText('You haven\'t applied to any past events yet.')).toBeVisible();
        await expect(upcoming(page).getByRole('link')).toHaveCount(0);
        await expect(past(page).getByRole('link')).toHaveCount(0);
    });

    const LISTS = [
        { route: 'GET events /mine/participating', message: 'Could not fetch events list: Database is down', others: ['Agora Utrecht', 'Summer University Lisbon'] },
        { route: 'GET statutory /mine', message: 'Could not fetch statutory events list: Database is down', others: ['Spring Training', 'Summer University Lisbon'] },
        { route: 'GET summeruniversity /mine/participating', message: 'Could not fetch summer university events list: Database is down', others: ['Spring Training', 'Agora Utrecht'] }
    ];
    for (const { route, message, others } of LISTS) {
        test(`shows the other applications when ${route} fails`, async ({ page, api }) => {
            api.json('GET events /mine/participating', ok([appliedEvent({ name: 'Spring Training', starts: '2027-05-01T08:00:00Z', ends: '2027-05-03T16:00:00Z' })]));
            api.json('GET statutory /mine', ok([appliedStatutoryEvent({ name: 'Agora Utrecht', starts: '2027-05-02T08:00:00Z', ends: '2027-05-04T16:00:00Z' })]));
            api.json('GET summeruniversity /mine/participating', ok([appliedSummerUniversity({ name: 'Summer University Lisbon', starts: '2027-05-03T08:00:00Z', ends: '2027-05-17T16:00:00Z' })]));
            api.on(route, { status: 500, json: { success: false, message: 'Database is down' } });
            api.on('GET statutory /events/latest', { status: 404, json: notFound('Event with such url or ID is not found.') });

            await page.goto('/dashboard');

            await expect(toast(page, message)).toBeVisible();
            await expect(upcoming(page).getByRole('link')).toHaveText(others.map((name) => new RegExp(name)));
            await expect(upcoming(page)).not.toHaveAttribute('aria-busy');
        });
    }

    test('without a published statutory event it says so and shows no error', async ({ page, api }) => {
        nothingYet(api);

        await page.goto('/dashboard');

        await expect(statutory(page).getByText('No statutory events published')).toBeVisible();
        await expect(statutory(page)).not.toHaveAttribute('aria-busy');
        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(api.callsTo('GET statutory /events/latest')).toHaveLength(1);
    });

    test('says so when the latest statutory event cannot be loaded', async ({ page, api }) => {
        nothingYet(api);
        api.on('GET statutory /events/latest', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/dashboard');

        await expect(toast(page, 'Could not fetch latest statutory event: Database is down')).toBeVisible();
        await expect(statutory(page).getByText('No statutory events published')).toBeVisible();
    });

    test('shows the latest statutory event with its dates and application period', async ({ page, api }) => {
        nothingYet(api);
        api.json('GET statutory /events/latest', ok(latestStatutoryEvent({
            id: 61,
            name: 'Spring Agora Utrecht',
            url: 'spring-agora',
            starts: '2027-04-01T08:00:00Z',
            ends: '2027-04-05T16:00:00Z',
            application_period_starts: '2027-02-20T09:00:00Z',
            application_period_ends: '2027-03-10T17:00:00Z',
            can_apply: false
        })));

        await page.goto('/dashboard');

        const tileOf = statutory(page);
        await expect(tileOf.getByRole('link', { name: 'Spring Agora Utrecht' })).toHaveAttribute('href', '/statutory/spring-agora');
        await expect(tileOf.getByRole('listitem').filter({ hasText: 'Dates:' })).toHaveText(/Dates:\s+2027-04-01 - 2027-04-05/);
        // In Brussels time.
        await expect(tileOf.getByRole('listitem').filter({ hasText: 'Application period:' })).toHaveText(/Application period:\s+2027-02-20 10:00 - 2027-03-10 18:00/);
        await expect(tileOf.getByText('No statutory events published')).toBeHidden();
    });

    test('offers to manage the application while applications are open, and the participants with the permission', async ({ page, api }) => {
        nothingYet(api);
        api.json('GET statutory /events/latest', ok(latestStatutoryEvent({
            name: 'Spring Agora Utrecht',
            url: 'spring-agora',
            application_period_starts: iso(-1, NOW),
            application_period_ends: iso(10, NOW),
            can_apply: true,
            permissions: dashboardStatutoryPermissions({ see_participants_list: true })
        })));

        await page.goto('/dashboard');

        await expect(statutory(page).getByRole('link', { name: 'Manage my application' })).toHaveAttribute('href', '/statutory/spring-agora/applications/me');
        await expect(statutory(page).getByRole('link', { name: 'See participants' })).toHaveAttribute('href', '/statutory/spring-agora/accepted');
    });

    test('offers neither while applications are closed and without the permission', async ({ page, api }) => {
        nothingYet(api);
        api.json('GET statutory /events/latest', ok(latestStatutoryEvent({
            name: 'Spring Agora Utrecht',
            application_period_starts: iso(-20, NOW),
            application_period_ends: iso(-10, NOW),
            can_apply: false,
            permissions: dashboardStatutoryPermissions({ see_participants_list: false })
        })));

        await page.goto('/dashboard');

        await expect(statutory(page).getByRole('link', { name: 'Spring Agora Utrecht' })).toBeVisible();
        await expect(statutory(page).getByRole('link', { name: 'Manage my application' })).toBeHidden();
        await expect(statutory(page).getByRole('link', { name: 'See participants' })).toBeHidden();
    });

    test('does not offer to manage the application before the application period starts', async ({ page, api }) => {
        nothingYet(api);
        // As statutory would answer for a member who may apply early (global:apply:agora).
        api.json('GET statutory /events/latest', ok(latestStatutoryEvent({
            name: 'Spring Agora Utrecht',
            application_period_starts: iso(2, NOW),
            application_period_ends: iso(10, NOW),
            can_apply: true
        })));

        await page.goto('/dashboard');

        await expect(statutory(page).getByRole('link', { name: 'Spring Agora Utrecht' })).toBeVisible();
        await expect(statutory(page).getByRole('link', { name: 'Manage my application' })).toBeHidden();
    });

    test('each tile is busy until its data is in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        const slow = <T>(data: T) => async () => { await held; return { json: ok(data) }; };
        api.on('GET events /mine/participating', slow([]));
        api.json('GET statutory /mine', ok([]));
        api.json('GET summeruniversity /mine/participating', ok([]));
        api.on('GET statutory /events/latest', async () => { await held; return { status: 404, json: notFound('Event with such url or ID is not found.') }; });

        await page.goto('/dashboard');

        await expect(upcoming(page)).toHaveAttribute('aria-busy', 'true');
        await expect(past(page)).toHaveAttribute('aria-busy', 'true');
        await expect(statutory(page)).toHaveAttribute('aria-busy', 'true');
        // The member is known from the start.
        await expect(tile(page, 'Alex Member')).not.toHaveAttribute('aria-busy');

        release();

        await expect(upcoming(page)).not.toHaveAttribute('aria-busy');
        await expect(past(page)).not.toHaveAttribute('aria-busy');
        await expect(statutory(page)).not.toHaveAttribute('aria-busy');
        await expect(upcoming(page).getByText('You haven\'t applied to any upcoming events yet.')).toBeVisible();
    });
});

test.describe('dashboard of a member without bodies or circles', () => {
    // Only a superadmin gets this far without a body: everyone else has to complete their profile first.
    test.use({ session: 'superadmin' });

    test('is told they are in no body and no circle', async ({ page, api, me }) => {
        await freezeTime(page);
        nothingYet(api);
        me!.bodies = [];
        me!.primary_body = null;
        me!.primary_body_id = null;
        me!.circles = [];

        await page.goto('/dashboard');

        const member = tile(page, 'Ada Admin');
        await expect(member.getByText('You are currently not a member of any body.')).toBeVisible();
        await expect(member.getByText('You are currently not a member of any circle.')).toBeVisible();
        await expect(member.getByText('You are member of these bodies:')).toBeHidden();
        await expect(member.getByText('You are member of these circles:')).toBeHidden();
        await expect(member.getByRole('link')).toHaveCount(0);
    });
});
