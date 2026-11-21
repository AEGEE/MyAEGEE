// Events list (/events, /events/participating, /events/organizing): what a member sees and
// can do. Runs against Vue and React (@migrated).
import { test, expect, toast } from '../support/test.ts';
import { eventSummary, ok, permission, MEMBER_PERMISSIONS, iso } from '../support/factories.ts';

test.describe('events list', { tag: '@migrated' }, () => {
    test('shows upcoming published events with their key facts', async ({ page, api }) => {
        api.json('GET events /', ok([
            eventSummary({ id: 1, name: 'Spring Training', url: 'spring-training', type: 'training', fee: 50, optional_fee: 10 }),
            eventSummary({ id: 2, name: 'Network Meeting', url: 'nwm-1', type: 'nwm', fee: 0, application_status: 'closed', application_starts: iso(-20), application_ends: iso(-1) })
        ]));

        await page.goto('/events');

        await expect(page.getByRole('heading', { name: 'Events list' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List all events');

        const training = page.getByRole('article', { name: 'Spring Training' });
        await expect(training.getByText('Training Event', { exact: true })).toBeVisible();
        await expect(training.getByText('€50')).toBeVisible();
        await expect(training.getByText('(+ €10)')).toBeVisible();
        await expect(training.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(training.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/events/spring-training');
        await expect(training.getByRole('link', { name: 'Apply!' })).toHaveAttribute('href', '/events/spring-training/applications/me');

        const nwm = page.getByRole('article', { name: 'Network Meeting' });
        await expect(nwm.getByText('Free')).toBeVisible();
        await expect(nwm.getByText('Applications are closed')).toBeVisible();
        await expect(nwm.getByRole('link', { name: 'Apply!' })).toHaveCount(0);

        // Only upcoming events are asked for, 30 at a time.
        const [list] = api.callsTo('GET events /');
        expect(list.query.get('limit')).toBe('30');
        expect(list.query.get('offset')).toBe('0');
        expect(list.query.get('starts')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('searching asks the API again and replaces the results', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => ({
            json: ok(query.get('search') === 'winter'
                ? [eventSummary({ name: 'Winter School' })]
                : [eventSummary({ name: 'Spring Training' })])
        }));

        await page.goto('/events');
        await expect(page.getByText('Spring Training')).toBeVisible();

        await page.getByRole('textbox', { name: 'Search by name or description' }).fill('winter');

        await expect(page.getByText('Winter School')).toBeVisible();
        await expect(page.getByText('Spring Training')).toHaveCount(0);
        expect(api.callsTo('GET events /').at(-1)?.query.get('search')).toBe('winter');
    });

    test('filters by event type', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        await page.getByRole('checkbox', { name: 'Training Event' }).check();
        await page.getByRole('checkbox', { name: 'Network Meeting' }).check();

        await expect.poll(() => api.callsTo('GET events /').at(-1)?.query.getAll('type[]')).toEqual(['training', 'nwm']);
    });

    test('can include past events', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        await page.getByRole('button', { name: 'Display past events' }).click();

        await expect(page.getByRole('button', { name: 'Display only future events' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET events /').length).toBe(2);
        expect(api.callsTo('GET events /').at(-1)?.query.has('starts')).toBe(false);
    });

    test('says so when there are no events', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('loads the next page on request while full pages come back', async ({ page, api }) => {
        api.on('GET events /', ({ query }) => {
            const offset = Number(query.get('offset'));
            const count = offset === 0 ? 30 : 5;
            return { json: ok(Array.from({ length: count }, (_, i) => eventSummary({ name: `Event ${offset + i + 1}` }))) };
        });

        await page.goto('/events');
        await expect(page.getByText('Event 30', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Load more events' }).click();

        await expect(page.getByText('Event 35', { exact: true })).toBeVisible();
        await expect(page.getByText('Event 1', { exact: true })).toBeVisible();
        expect(api.callsTo('GET events /').at(-1)?.query.get('offset')).toBe('30');
        // Fewer than a full page: nothing more to load.
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('shows "Create event" only to members who may create events', async ({ page, api, myPermissions }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        await expect(page.getByRole('link', { name: 'Create event' })).toHaveAttribute('href', '/events/new');

        myPermissions.splice(0, myPermissions.length, ...MEMBER_PERMISSIONS.filter((p) => !p.endsWith('create:event')).map(permission));
        await page.reload();
        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create event' })).toHaveCount(0);
    });

    test('lists the events I take part in without paging', async ({ page, api }) => {
        api.json('GET events /mine/participating', ok(Array.from({ length: 30 }, (_, i) => eventSummary({ name: `Mine ${i + 1}` }))));

        await page.goto('/events/participating');

        await expect(page).toHaveTitle('MyAEGEE | List events I\'m participating at');
        await expect(page.getByText('Mine 30', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more events' })).toBeHidden();
    });

    test('shows an error when the events cannot be loaded', async ({ page, api }) => {
        api.on('GET events /', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/events');

        await expect(toast(page, 'Could not fetch events list: Database is down')).toBeVisible();
    });
});
