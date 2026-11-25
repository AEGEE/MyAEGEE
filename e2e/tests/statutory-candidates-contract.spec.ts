// Checks the builders the mocked-API suite uses for the positions and candidatures of an Agora
// (ui/support/factories/statutory-candidates.ts) against what statutory really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { ONE_PIXEL_PNG } from '../support/core-data.ts';
import {
    approvedCandidate,
    candidate,
    candidateFields,
    listedCandidate,
    myCandidature,
    pendingCandidateSummary,
    position,
    positionWithCandidates
} from '../ui/support/factories/statutory-candidates.ts';
import { statutoryImage } from '../ui/support/factories/statutory-events.ts';

const DAY = 24 * 60 * 60 * 1000;

// A candidature has an address column that nothing fills.
const noEmail = { gaps: { '$.email': 'statutory keeps the column but nothing fills it: every candidature made today has null' } };
const withPicture = { image_id: 3, image: statutoryImage() };

interface Listed {
    id: number;
    candidates: { id: number }[];
}

test.describe('statutory candidature factories match the real API', () => {
    test('a position, a candidature with its picture, and the lists of both', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        const member = await api.me('member');
        const now = Date.now();
        const created = await api.call<Envelope<{ id: number }>>('admin', 'POST', `/api/statutory/events/${event.id}/positions`, {
            name: 'Contract position',
            places: 2,
            body_id: member.bodies[0].id,
            starts: new Date(now - DAY),
            ends: new Date(now + 5 * DAY),
            start_term: '2030-01-01',
            end_term: '2030-12-31',
            requirements: 'Be a member'
        });
        expectStatus(created, 200);
        const positionId = created.body.data.id;

        const positions = await api.call<Envelope<{ id: number }[]>>('member', 'GET', `/api/statutory/events/${event.id}/positions`);
        expectStatus(positions, 200);
        expectShape('position', position(), positions.body.data.find((item) => item.id === positionId));

        const applied = await api.call<Envelope<{ id: number }>>('member', 'POST', `/api/statutory/events/${event.id}/positions/${positionId}/candidates`, {
            body_id: member.bodies[0].id,
            first_name: member.first_name,
            last_name: member.last_name,
            date_of_birth: '1999-05-01',
            member_since: '2019-10-01',
            nationality: 'Belgian',
            languages: ['English'],
            studies: 'Economics',
            attended_agorae: 'One',
            attended_epm: 'One',
            attended_conferences: 'One',
            european_experience: 'Some',
            local_experience: 'Some',
            external_experience: 'Some',
            related_experience: 'Some',
            motivation: 'Contract check',
            program: 'Contract check',
            agreed_to_privacy_policy: true
        });
        expectStatus(applied, 200);
        const candidateId = applied.body.data.id;
        const { access } = await api.login('member');
        const upload = await api.request.post(`/api/statutory/events/${event.id}/positions/${positionId}/candidates/${candidateId}/image`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-Auth-Token': access },
            multipart: { image: { name: 'picture.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG } }
        });
        expect(upload.status(), await upload.text()).toBe(200);

        const single = await api.call<Envelope<unknown>>('member', 'GET', `/api/statutory/events/${event.id}/positions/${positionId}/candidates/${candidateId}`);
        expectStatus(single, 200);
        expectShape('candidate', candidate(withPicture), single.body.data, noEmail);

        // Pending: whole in the list of the Juridical Commission, a summary in everybody's.
        const all = await api.call<Envelope<Listed[]>>('admin', 'GET', `/api/statutory/events/${event.id}/positions/all`);
        expectStatus(all, 200);
        const inAll = all.body.data.find((item) => item.id === positionId);
        expectShape('positionWithCandidates', positionWithCandidates({ candidates: [listedCandidate(withPicture)] }), inAll, { gaps: { '$.candidates[0].email': noEmail.gaps['$.email'] } });
        expectShape('listedCandidate', listedCandidate(withPicture), inAll!.candidates[0], noEmail);
        const pending = await api.call<Envelope<Listed[]>>('member', 'GET', `/api/statutory/events/${event.id}/positions/approved`);
        expectStatus(pending, 200);
        expectShape('pendingCandidateSummary', pendingCandidateSummary(), pending.body.data.find((item) => item.id === positionId)!.candidates[0]);

        // Approved: without the addresses in everybody's list.
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/positions/${positionId}/candidates/${candidateId}/status`, { status: 'approved' }), 200);
        const approved = await api.call<Envelope<Listed[]>>('member', 'GET', `/api/statutory/events/${event.id}/positions/approved`);
        expectStatus(approved, 200);
        const inApproved = approved.body.data.find((item) => item.id === positionId);
        expectShape('approvedCandidate', approvedCandidate(withPicture), inApproved!.candidates[0]);
        expectShape('positionWithCandidates', positionWithCandidates({ candidates: [approvedCandidate(withPicture)] }), inApproved);

        const mine = await api.call<Envelope<{ id: number }[]>>('member', 'GET', `/api/statutory/events/${event.id}/positions/candidates/mine`);
        expectStatus(mine, 200);
        expectShape('myCandidature', myCandidature(withPicture), mine.body.data.find((item) => item.id === candidateId), noEmail);
    });

    // Waits for statutory #2405, which renames the key of the EPMs column to `attended_epm`.
    test('the columns of the candidates export', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        const fields = await api.call<Envelope<unknown>>('admin', 'GET', `/api/statutory/events/${event.id}/fields/candidates`);
        expectStatus(fields, 200);
        expectShape('candidateFields', candidateFields(), fields.body.data);
        expect(Object.keys(fields.body.data as object)).toEqual(Object.keys(candidateFields()));
    });
});
