// Event edit page (/events/:id/edit) for an online event without applications: its application
// period means nothing, so saving keeps the stored one. The events service checks the order of
// changed dates, and a period rewritten as "now until one minute before the start" ends before it
// starts once the event has started.
import { ok } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { event, organizerPermissions } from '../support/factories/events.ts';
import { mockMap } from '../support/map.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const STORED = {
    application_starts: '2027-02-01T09:00:00.000Z',
    application_ends: '2027-03-01T08:59:00.000Z',
    starts: '2027-03-01T09:00:00.000Z',
    ends: '2027-03-05T09:00:00.000Z'
};

test.describe('editing an event without applications', () => {
    // The event started the day before.
    test.use({ now: '2027-03-02T12:00:00.000Z' });

    test('saving a started event sends its stored application period', async ({ page, api, me }) => {
        const stored = event({
            id: 7,
            url: 'online-talk',
            name: 'Online Talk',
            method: 'online',
            has_applications: false,
            fee: 0,
            ...STORED,
            organizers: [{ user_id: me!.id, first_name: me!.first_name, last_name: me!.last_name }]
        });
        api.json('GET core /bodies/', ok([body({ id: 1, name: 'AEGEE-Antenna' })]));
        // The editor's map, which starts before the event says it is online.
        mockMap(api);
        api.on('GET events /single/:id', { json: ok(stored, { permissions: organizerPermissions() }) });
        api.on('PUT events /single/:id', ({ body: sent }) => ({ json: ok({ ...stored, ...(sent as object) }) }));

        await page.goto('/events/7/edit');
        await expect(page.getByRole('button', { name: 'Save event' })).toBeEnabled();
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(toast(page, 'Event is saved.')).toBeVisible();
        const [save] = api.callsTo('PUT events /single/:id');
        expect(save.params.id).toEqual('7');
        expect(save.body).toMatchObject({
            has_applications: false,
            application_starts: STORED.application_starts,
            application_ends: STORED.application_ends,
            starts: STORED.starts,
            ends: STORED.ends
        });
    });
});
