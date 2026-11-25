// What Network Commission members and organizers can do with NWMs, using the production
// permissions from the seed. NetCom (seed user `netcom`) is a member of the seeded antenna
// and the Network Commission body; the `otherAntenna` member is in neither.
// Events looks organizers up in core with its own service account, which these tests cover
// against the real core. The organizer rules themselves and the notification recipients are
// covered by events' own tests in events/test/api.
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';

test.describe('NetCom and NWMs', () => {
    test('NetCom can publish an NWM organized by a body they are a member of', async ({ api }) => {
        const event = await api.createEvent('member');
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const res = await api.setStatus('netcom', event.id, 'published');
        expectStatus(res, 200);
    });

    test('NetCom can publish an NWM organized by a body they are not a member of', async ({ api, otherAntenna }) => {
        const organizer = otherAntenna.member.username;
        const event = await api.createEvent(organizer);
        expectStatus(await api.setStatus(organizer, event.id, 'submitted'), 200);

        const res = await api.setStatus('netcom', event.id, 'published');
        expectStatus(res, 200);
    });

    test('NetCom can edit an NWM organized by a body they are a member of', async ({ api }) => {
        const event = await api.createEvent('member');

        const res = await api.call('netcom', 'PUT', `/api/events/single/${event.id}`, {
            name: `${event.name} (edited by NetCom)`,
            organizers: event.organizers.map((organizer) => ({ user_id: organizer.user_id }))
        });
        expectStatus(res, 200);
    });

    test('NetCom can edit an NWM organized by a body they are not a member of', async ({ api, otherAntenna }) => {
        const event = await api.createEvent(otherAntenna.member.username);

        // The frontend always sends the organizers along when saving.
        const res = await api.call('netcom', 'PUT', `/api/events/single/${event.id}`, {
            name: `${event.name} (edited by NetCom)`,
            organizers: event.organizers.map((organizer) => ({ user_id: organizer.user_id }))
        });
        expectStatus(res, 200);
    });

    test('an organizer can add a co-organizer from another organizing body', async ({ api, otherAntenna }) => {
        const member = await api.me('member');

        const event = await api.createEvent('member');
        const res = await api.call('member', 'PUT', `/api/events/single/${event.id}`, {
            organizing_bodies: [{ body_id: member.bodies[0].id }, { body_id: otherAntenna.body.id }],
            organizers: [{ user_id: member.id }, { user_id: otherAntenna.member.id }]
        });
        expectStatus(res, 200);
    });

    test('an organizer can find members of a co-organizing body in the editor', async ({ api, page, otherAntenna }) => {
        const member = await api.me('member');
        const event = await api.createEvent('member');
        expectStatus(await api.call('member', 'PUT', `/api/events/single/${event.id}`, {
            organizing_bodies: [{ body_id: member.bodies[0].id }, { body_id: otherAntenna.body.id }]
        }), 200);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}/edit`);
        // Only search once the event is loaded: before that the editor has no organizing bodies to search.
        await expect(page.getByRole('link', { name: `${member.first_name} ${member.last_name}`, exact: true })).toBeVisible();
        await page.getByRole('textbox', { name: 'Add organiser' }).fill(otherAntenna.member.last_name);

        await expect(page.getByRole('main').getByRole('button', { name: new RegExp(otherAntenna.member.last_name) })).toBeVisible();
    });
});
