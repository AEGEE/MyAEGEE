// What Network Commission members can do with NWMs, using the production
// NetCom permissions. NetCom (seed user `netcom`) is a member of the seeded
// antenna and the Network Commission body; the `otherAntenna` member is in neither.
import { test, expect, expectStatus, knownBug, moveToModule, recipients } from '../support/api.ts';

const SUBMITTED_SUBJECT = 'A new event was submitted.';

test.describe('NetCom and NWMs', () => {
    test('NetCom can publish an NWM organized by a body they are a member of', async ({ api }) => {
        const event = await api.createEvent('member');
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const res = await api.setStatus('netcom', event.id, 'published');
        expectStatus(res, 200);
    });

    test('NetCom can publish an NWM organized by a body they are not a member of', async ({ api, otherAntenna }) => {
        knownBug('Known bug: events looks up organizers with the caller\'s token, which needs lookup:member', /lookup:member/);

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
        knownBug('Known bug: events looks up organizers with the caller\'s token, which needs lookup:member', /lookup:member/);

        const event = await api.createEvent(otherAntenna.member.username);

        // The frontend always sends the organizers along when saving.
        const res = await api.call('netcom', 'PUT', `/api/events/single/${event.id}`, {
            name: `${event.name} (edited by NetCom)`,
            organizers: event.organizers.map((organizer) => ({ user_id: organizer.user_id }))
        });
        expectStatus(res, 200);
    });

    test('an organizer can add a co-organizer from another organizing body', async ({ api, otherAntenna }) => {
        knownBug('Known bug: events looks up organizers with the caller\'s token, which needs lookup:member', /lookup:member/);

        const member = await api.me('member');

        const event = await api.createEvent('member');
        const res = await api.call('member', 'PUT', `/api/events/single/${event.id}`, {
            organizing_bodies: [{ body_id: member.bodies[0].id }, { body_id: otherAntenna.body.id }],
            organizers: [{ user_id: member.id }, { user_id: otherAntenna.member.id }]
        });
        expectStatus(res, 200);
    });

    test('submitting an NWM notifies both events approval and NetCom', moveToModule('events', 'mock the mailer and check the recipients'), async ({ api }) => {
        knownBug('Not implemented yet: NWM submissions should also go to netcom@aegee.eu', /netcom@aegee\.eu/);

        const event = await api.createEvent('member');
        await api.clearMails();
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const mail = (await api.mails()).find((m) => m.subject === SUBMITTED_SUBJECT);
        expect(mail).toBeTruthy();
        expect(recipients(mail!)).toEqual(expect.arrayContaining(['events-approval@aegee.eu', 'netcom@aegee.eu']));
    });

    test('submitting another event type only notifies events approval', moveToModule('events', 'mock the mailer and check the recipients'), async ({ api }) => {
        const event = await api.createEvent('member', { type: 'training' });
        await api.clearMails();
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const mail = (await api.mails()).find((m) => m.subject === SUBMITTED_SUBJECT);
        expect(mail).toBeTruthy();
        expect(recipients(mail!)).toEqual(['events-approval@aegee.eu']);
    });
});
