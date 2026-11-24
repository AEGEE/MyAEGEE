// Checks the builders the mocked-API suite uses for the summeruniversity service
// (ui/support/factories/summeruniversity.ts) against what summeruniversity really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { uploadPicture } from '../support/core-data.ts';
import { applyToSu, asSu, createSeason, createSuEvent, setSuApplicationPeriod, setSuPublished, setSuStatus } from '../support/summeruniversity-data.ts';
import {
    suSeason, suApplication, suApplicationPermissions, suBoardviewApplication, suBoardviewEvent, suctPermissions, suEvent,
    suEventFull, suEventMinimal, suLocation, suOrganizerPermissions, suParticipantRow, suParticipatingEvent, suPermissions, suStats,
    VISA_DETAILS, type SuEvent
} from '../ui/support/factories/summeruniversity.ts';

type Single = Envelope<Record<string, unknown>> & { permissions: unknown };

// Every optional field of an SU, filled, so the comparison has a value on both sides.
const FILLED = {
    image: 'picture.png',
    photos: [{ name: '', description: 'https://photos.example.org/e2e' }],
    video: 'https://video.example.org/e2e',
    website: 'https://su.example.org/e2e',
    social_media: [{ name: '', description: 'https://social.example.org/e2e' }],
    trainers: 'Two language trainers',
    pax_description: 'Somebody who likes walking',
    pax_confirmation: 'payment',
    budget: 'https://budget.example.org/e2e',
    programme: 'A walk every morning',
    activities_list: 'Hiking, cooking, a city tour',
    optional_programme: 'A day trip to the sea',
    course_level: 'beginner',
    courses: 'Basic Spanish',
    special_equipment: 'Walking shoes',
    university_support: true,
    cancellation_rules: 'No refunds after the first of June',
    additional_regulation: 'No smoking in the hostel'
} satisfies Partial<SuEvent>;

// The keys of these are the ids of the caller's bodies.
const PER_BODY = {
    ignore: {
        '$.set_board_comment': 'its keys are the ids of the bodies of whoever asks',
        '$.see_boardview': 'its keys are the ids of the bodies of whoever asks, next to global'
    }
};

test.describe('summeruniversity factories match the real API', () => {
    test('seasons, an SU at each publication, its permissions, applications and the board view', async ({ api }) => {
        const newSeason = await createSeason(api);
        const seasons = await asSu<unknown[]>(api, 'member', 'GET', '/seasons');
        expectShape('suSeason', suSeason(), seasons.find((item) => (item as { year: number }).year === newSeason.year));

        // A cooperation body is given too, so that list has an element on both sides.
        const member = await api.me('member');
        const created = await createSuEvent(api, {
            season: newSeason.year,
            ...FILLED,
            image: undefined,
            cooperation: [{ body_id: member.bodies[0].id }],
            questions: [{ name: '', description: 'Why this SU?', required: true }]
        });
        await uploadPicture(api, 'suct', `/api/summeruniversity/single/${created.id}/upload`);
        for (const status of ['first approval', 'second submission', 'second approval']) {
            await setSuStatus(api, created.id, status);
        }
        await setSuPublished(api, created.id, 'minimal');

        // Published as minimal: the list has the minimal fields only.
        const minimalList = await asSu<unknown[]>(api, 'member', 'GET', `/?season=${newSeason.year}`);
        expect(minimalList, 'the new SU is listed').toHaveLength(1);
        expectShape('suEventMinimal', suEventMinimal({ image: 'x' }), minimalList[0]);

        await setSuPublished(api, created.id, 'full');
        await setSuApplicationPeriod(api, created.id);
        // Opening the call with a maximum counts the accepted participants, which are null before.
        await asSu(api, 'suct', 'PUT', `/single/${created.id}/open_call`, { open_call: true, max_participants: 20 });

        const fullList = await asSu<unknown[]>(api, 'member', 'GET', `/?season=${newSeason.year}`);
        expectShape('suEventFull', suEventFull(FILLED), fullList[0]);

        const asMember = await api.call<Single>('member', 'GET', `/api/summeruniversity/single/${created.url}`);
        expectStatus(asMember, 200);
        expectShape('suEventFull', suEventFull(FILLED), asMember.body.data);
        expectShape('suLocation', suLocation(), (asMember.body.data.locations as unknown[])[0]);
        expectShape('suPermissions', suPermissions(), asMember.body.permissions, PER_BODY);

        const asSuct = await api.call<Single>('suct', 'GET', `/api/summeruniversity/single/${created.id}`);
        expectStatus(asSuct, 200);
        expectShape('suEvent', suEvent({ ...FILLED, cooperation: [{ body_id: 1, body_name: 'x' }] }), asSuct.body.data);
        expectShape('suctPermissions', suctPermissions(), asSuct.body.permissions, PER_BODY);

        // `board` is one of the organisers.
        const asOrganizer = await api.call<Single>('board', 'GET', `/api/summeruniversity/single/${created.id}`);
        expectStatus(asOrganizer, 200);
        expectShape('suOrganizerPermissions', suOrganizerPermissions(), asOrganizer.body.permissions, PER_BODY);

        const organizing = await asSu<unknown[]>(api, 'board', 'GET', `/mine/organizing?season=${newSeason.year}`);
        expectShape('suEvent', suEvent({ ...FILLED, cooperation: [{ body_id: 1, body_name: 'x' }] }), organizing[0]);
        const approvable = await asSu<{ id: number }[]>(api, 'suct', 'GET', '/mine/approvable');
        expectShape('suEvent', suEvent({ ...FILLED, cooperation: [{ body_id: 1, body_name: 'x' }] }), approvable.find((item) => item.id === created.id));

        // The member applies with visa details, so they have values too.
        const applied = await applyToSu(api, 'member', { ...created, questions: [{ description: 'Why this SU?' }] }, { ...VISA_DETAILS, allergies: 'Nuts' });
        await asSu(api, 'board', 'PUT', `/single/${created.id}/applications/${applied.id}/comment`, { board_comment: 'Active member' });

        const mine = await api.call<Single>('member', 'GET', `/api/summeruniversity/single/${created.id}/applications/me`);
        expectStatus(mine, 200);
        // The applicant doesn't get the board's comment on their own application.
        expect(mine.body.data).not.toHaveProperty('board_comment');
        expectShape('suApplication', suApplication({ ...VISA_DETAILS, allergies: 'x' }), mine.body.data);
        expectShape('suApplicationPermissions', suApplicationPermissions(), mine.body.permissions, PER_BODY);

        const forOrganizer = await api.call<Single>('board', 'GET', `/api/summeruniversity/single/${created.id}/applications/${applied.id}`);
        expectStatus(forOrganizer, 200);
        expectShape('suApplication', suApplication({ ...VISA_DETAILS, allergies: 'x', board_comment: 'x' }), forOrganizer.body.data);

        const rows = await asSu<unknown[]>(api, 'board', 'GET', `/single/${created.id}/applications`);
        expectShape('suParticipantRow', suParticipantRow({ ...VISA_DETAILS, allergies: 'x', board_comment: 'x' }), rows[0]);

        const participating = await asSu<unknown[]>(api, 'member', 'GET', `/mine/participating?season=${newSeason.year}`);
        expectShape('suParticipatingEvent', suParticipatingEvent({ image: 'x' }), participating[0]);

        const boardview = await asSu<{ event_id: number }[]>(api, 'board', 'GET', `/boardview/${member.bodies[0].id}`);
        const fromBoardview = boardview.find((item) => item.event_id === created.id);
        expectShape('suBoardviewApplication', suBoardviewApplication({ ...VISA_DETAILS, allergies: 'x', board_comment: 'x', event: { image: 'x' } }), fromBoardview);
        expectShape('suBoardviewEvent', suBoardviewEvent({ image: 'x' }), (fromBoardview as unknown as { event: unknown }).event);

        const stats = await asSu<unknown>(api, 'suct', 'GET', `/applications?season=${newSeason.year}`);
        expectShape('suStats', suStats(), stats);

        // The member's application is withdrawn, so it doesn't count for their next one.
        await asSu(api, 'member', 'PUT', `/single/${created.id}/applications/me/cancelled`, { cancelled: true });
    });
});
