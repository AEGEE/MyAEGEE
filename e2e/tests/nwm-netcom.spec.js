// What Network Commission members can do with NWMs, using the production
// NetCom permissions. NetCom (seed user `netcom`) is a member of the seeded
// antenna and the Network Commission body; `organizer-b` is only in the second antenna.
const { test, expect, expectStatus, knownBug, recipients } = require('../support/api');

const SUBMITTED_SUBJECT = 'A new event was submitted.';

test.describe('NetCom and NWMs', () => {
    test('NetCom can publish an NWM organized by a body they are a member of', async ({ api }) => {
        const event = await api.createEvent('member');
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const res = await api.setStatus('netcom', event.id, 'published');
        expectStatus(res, 200);
    });

    test('NetCom can publish an NWM organized by a body they are not a member of', async ({ api }) => {
        knownBug('Known bug: events looks up organizers with the caller\'s token, which needs lookup:member');

        const event = await api.createEvent('organizer-b');
        expectStatus(await api.setStatus('organizer-b', event.id, 'submitted'), 200);

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

    test('NetCom can edit an NWM organized by a body they are not a member of', async ({ api }) => {
        knownBug('Known bug: events looks up organizers with the caller\'s token, which needs lookup:member');

        const event = await api.createEvent('organizer-b');

        // The frontend always sends the organizers along when saving.
        const res = await api.call('netcom', 'PUT', `/api/events/single/${event.id}`, {
            name: `${event.name} (edited by NetCom)`,
            organizers: event.organizers.map((organizer) => ({ user_id: organizer.user_id }))
        });
        expectStatus(res, 200);
    });

    test('an organizer can add a co-organizer from another organizing body', async ({ api }) => {
        knownBug('Known bug: events looks up organizers with the caller\'s token, which needs lookup:member');

        const member = await api.me('member');
        const organizerB = await api.me('organizer-b');
        const secondAntenna = await api.secondAntenna();

        const event = await api.createEvent('member');
        const res = await api.call('member', 'PUT', `/api/events/single/${event.id}`, {
            organizing_bodies: [{ body_id: member.bodies[0].id }, { body_id: secondAntenna.id }],
            organizers: [{ user_id: member.id }, { user_id: organizerB.id }]
        });
        expectStatus(res, 200);
    });

    test('submitting an NWM notifies both events approval and NetCom', async ({ api }) => {
        knownBug('Not implemented yet: NWM submissions should also go to netcom@aegee.eu');

        const event = await api.createEvent('member');
        await api.clearMails();
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const mail = (await api.mails()).find((m) => m.subject === SUBMITTED_SUBJECT);
        expect(mail).toBeTruthy();
        expect(recipients(mail)).toEqual(expect.arrayContaining(['events-approval@aegee.eu', 'netcom@aegee.eu']));
    });

    test('submitting another event type only notifies events approval', async ({ api }) => {
        const event = await api.createEvent('member', { type: 'training' });
        await api.clearMails();
        expectStatus(await api.setStatus('member', event.id, 'submitted'), 200);

        const mail = (await api.mails()).find((m) => m.subject === SUBMITTED_SUBJECT);
        expect(mail).toBeTruthy();
        expect(recipients(mail)).toEqual(['events-approval@aegee.eu']);
    });
});
