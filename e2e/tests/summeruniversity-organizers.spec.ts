// Organizers of a Summer University have to be members of an organizing or cooperation body.
import { test, expect, expectStatus, type Api, type Envelope } from '../support/api.ts';
import type { Username } from '../support/constants.ts';

const DAY = 24 * 60 * 60 * 1000;

interface SuOrganizer {
    user_id: number;
    role: string;
    body_id?: number;
}

const suPayload = async (api: Api, { cooperation, organizers }: { cooperation: { body_id: number }[]; organizers: SuOrganizer[] }) => {
    const member = await api.me('member');
    const now = Date.now();

    return {
        name: `E2E Summer University ${now}`,
        url: `e2e-su-${now}-${Math.round(Math.random() * 1e6)}`,
        description: 'Created by the e2e tests',
        email: 'su@example.com',
        starts: new Date(now + 60 * DAY),
        ends: new Date(now + 70 * DAY),
        fee: 0,
        organizing_bodies: [{ body_id: member.bodies[0].id }],
        cooperation,
        locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 }, start: true, end: true }],
        type: 'regular',
        theme_category: 'leisure',
        theme: 'Theme',
        theme_implementation: 'Implementation',
        learning_objectives: [{ name: 'Learn things' }, { name: 'Learn more things' }],
        programme_suct: 'https://example.com/programme',
        accommodation_type: 'Hostel',
        agreed_to_su_terms: true,
        organizers
    };
};

const organizers = async (api: Api, fourth: Username): Promise<SuOrganizer[]> => {
    const [member, board, netcom] = await Promise.all((['member', 'board', 'netcom'] as const).map((username) => api.me(username)));
    return [
        { user_id: member.id, role: 'main_coordinator', body_id: member.bodies[0].id },
        { user_id: board.id, role: 'content_manager' },
        { user_id: netcom.id, role: 'treasurer' },
        { user_id: (await api.me(fourth)).id, role: 'incoming_responsible' }
    ];
};

test.describe('Summer University organizers', () => {
    test('an organizer from a cooperation body is accepted', async ({ api }) => {
        const secondAntenna = await api.secondAntenna();
        const payload = await suPayload(api, {
            cooperation: [{ body_id: secondAntenna.id }],
            organizers: await organizers(api, 'organizer-b')
        });

        expectStatus(await api.call('member', 'POST', '/api/summeruniversity/', payload), 201);
    });

    test('an organizer who is not in an organizing or cooperation body is rejected', async ({ api }) => {
        const payload = await suPayload(api, {
            cooperation: [],
            organizers: await organizers(api, 'organizer-b')
        });

        const organizerB = await api.me('organizer-b');
        const res = await api.call<Envelope<unknown>>('member', 'POST', '/api/summeruniversity/', payload);
        expectStatus(res, 422);
        expect(res.body.errors?.organizers[0]).toContain(`user ID ${organizerB.id}`);
    });
});
