// The mocked-API suite (ui/) answers the frontend with objects from ui/support/factories/.
// This checks the builders for core (factories/core.ts) and the shared envelopes
// (factories/base.ts) against what core really answers: every field a factory builds has to
// exist in the real response with the same type, so the mocks can't drift away from the API
// unnoticed. The real responses may have more fields. Where a field can be null, the test
// fills it on both sides, as null isn't compared.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { asAdmin, createCampaign, createCircle } from '../support/core-data.ts';
import { badRequest, forbidden, notFound, okList, validationError } from '../ui/support/factories/base.ts';
import { body, bodyMembership, circle, member, memberSearchResult, payment, permission, publicCampaign } from '../ui/support/factories/core.ts';

type Row = Record<string, unknown>;

test.describe('core factories match the real API', () => {
    test('the logged-in member, their permissions and their body', async ({ api }) => {
        const me = await api.call<Envelope<unknown>>('member', 'GET', '/api/core/members/me');
        // The factory adds a primary body; the seeded member has none, so it's null there.
        expectShape('member', member({ event_application_ban: null }), me.body.data);

        const permissions = await api.call<Envelope<unknown[]>>('member', 'GET', '/api/core/my_permissions');
        expectShape('permission', [permission('global:create:event')], permissions.body.data);

        const ownBody = (await api.me('member')).bodies[0];
        const real = await api.call<Envelope<unknown>>('member', 'GET', `/api/core/bodies/${ownBody.id}`);
        expectShape('body', body(), real.body.data);
    });

    test('circles, in the list and as the holders of a local permission', async ({ api, otherAntenna }) => {
        const filled = circle({ body_id: 1, parent_circle_id: 1, gsuite_id: 'circle@example.com' });

        const [bound, remove] = await createCircle(api, { bodyId: otherAntenna.body.id });
        try {
            const [parent] = await asAdmin<{ id: number }[]>(api, 'GET', '/circles?limit=1');
            await asAdmin(api, 'PUT', `/circles/${bound.id}/parent`, { parent_circle_id: parent.id });
            await asAdmin(api, 'PUT', `/circles/${bound.id}`, { gsuite_id: `e2e-circle-${bound.id}@example.com` });

            const list = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/circles?all=true&query=${encodeURIComponent(bound.name)}`);
            expectStatus(list, 200);
            expect(list.body.data).toHaveLength(1);
            expectShape('circle', filled, list.body.data[0]);
            expectShape('okList', okList([filled]), list.body);
        } finally {
            await remove();
        }

        // `POST /my_permissions` answers with the circles through which the user holds a local
        // permission: for a board member, the board circle of their body.
        const mine = await api.call<Envelope<Row[]>>('board', 'POST', '/api/core/my_permissions', { action: 'approve_members', object: 'events' });
        expectStatus(mine, 200);
        expect(mine.body.data.length).toBeGreaterThan(0);
        expectShape('circle', circle({ body_id: 1, parent_circle_id: 1 }), mine.body.data[0]);
    });

    test('member search results, with and without global:view:member', async ({ api }) => {
        const ownBody = (await api.me('member')).bodies[0];

        const limited = await api.call<Envelope<Row[]>>('member', 'GET', `/api/core/members_search?query=member&body_id=${ownBody.id}`);
        expectStatus(limited, 200);
        expect(limited.body.data.length).toBeGreaterThan(0);
        expectShape('memberSearchResult', memberSearchResult(), limited.body.data[0]);
        // The default is all a member gets: nothing else to show in a mocked page.
        expect(Object.keys(limited.body.data[0]).sort()).toEqual(Object.keys(memberSearchResult()).sort());

        const full = await api.call<Envelope<Row[]>>('admin', 'GET', '/api/core/members_search?query=member');
        expectStatus(full, 200);
        expect(full.body.data.length).toBeGreaterThan(0);
        expectShape('memberSearchResult', memberSearchResult({ username: 'member', email: 'member@example.com', gsuite_id: null }), full.body.data[0]);
    });

    test('a body\'s memberships and payments', async ({ api, otherAntenna }) => {
        const { body: antenna, member: antennaMember } = otherAntenna;
        const membersPath = `/bodies/${antenna.id}/members`;

        await asAdmin(api, 'PUT', `/members/${antennaMember.id}`, {
            date_of_birth: '1999-05-01',
            gender: 'neutral',
            phone: '+32 2 123 45 67',
            address: 'Somewhere in Europe',
            about_me: 'Member of an antenna made for a test'
        });
        const [membership] = await asAdmin<{ id: number }[]>(api, 'GET', membersPath);
        await asAdmin(api, 'PUT', `${membersPath}/${membership.id}`, { comment: 'Joined at the fair' });

        const memberships = await asAdmin<Row[]>(api, 'GET', membersPath);
        expect(memberships).toHaveLength(1);
        expectShape('bodyMembership', bodyMembership({ comment: 'Joined at the fair' }), memberships[0]);

        const filled = payment({ comment: 'Paid in cash', invoice_name: 'A. Member', invoice_address: 'Somewhere in Europe' });
        const created = await asAdmin<Row>(api, 'POST', `/bodies/${antenna.id}/payments`, {
            user_id: antennaMember.id,
            starts: filled.starts,
            expires: filled.expires,
            amount: filled.amount,
            currency: filled.currency,
            comment: filled.comment,
            invoice_name: filled.invoice_name,
            invoice_address: filled.invoice_address
        });
        expectShape('payment', filled, created);
        // The amount comes back as the number that was sent, not as a string.
        expect(created.amount).toBe(filled.amount);

        const payments = await asAdmin<Row[]>(api, 'GET', `/bodies/${antenna.id}/payments`);
        expect(payments).toHaveLength(1);
        expectShape('payment', filled, payments[0]);
        expect(payments[0].amount).toBe(filled.amount);
    });

    test('a campaign as the signup page gets it', async ({ api, otherAntenna }) => {
        const antenna = otherAntenna.body;
        await asAdmin(api, 'PUT', `/bodies/${antenna.id}`, { website: 'https://www.example.org' });
        const filled = publicCampaign({
            autojoin_body: { id: 1, name: 'AEGEE-Antenna', email: 'antenna@example.com', phone: '+32 2 123 45 67', address: 'Somewhere in Europe', website: 'https://www.example.org' }
        });

        const [campaign, remove] = await createCampaign(api, { autojoinBody: antenna.id });
        try {
            for (const username of [null, 'member'] as const) {
                const real = await api.call<Envelope<Row>>(username, 'GET', `/api/core/campaigns/${campaign.url}`);
                expectStatus(real, 200);
                expectShape('publicCampaign', filled, real.body.data);
                // The public answer has these fields and no others.
                expect(Object.keys(real.body.data).sort()).toEqual(Object.keys(filled).sort());
                expect(Object.keys(real.body.data.autojoin_body as Row).sort()).toEqual(Object.keys(filled.autojoin_body as object).sort());
            }
        } finally {
            await remove();
        }
    });

    test('the error answers', async ({ api }) => {
        const invalid = await api.call('admin', 'POST', '/api/core/circles', { name: '', description: '' });
        expectStatus(invalid, 422);
        expectShape('validationError', validationError({ name: ['Name should be set.'], description: ['Description should be set.'] }), invalid.body);

        const notAllowed = await api.call('member', 'POST', '/api/core/circles', { name: 'Not allowed', description: 'Not allowed' });
        expectStatus(notAllowed, 403);
        expectShape('forbidden', forbidden('Permission global:create:circle is required, but not present.'), notAllowed.body);

        const missing = await api.call('admin', 'GET', '/api/core/circles/2147483647');
        expectStatus(missing, 404);
        expectShape('notFound', notFound('Circle is not found.'), missing.body);

        const malformed = await api.call('admin', 'GET', '/api/core/circles/not-a-number');
        expectStatus(malformed, 400);
        expectShape('badRequest', badRequest('Circle ID is invalid.'), malformed.body);
    });
});
