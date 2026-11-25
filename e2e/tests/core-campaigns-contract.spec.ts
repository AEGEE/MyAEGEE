// Checks the builders of ui/support/factories/core-campaigns.ts (signup campaigns and join
// requests) against what core really answers. See tests/core-contract.spec.ts for how the
// comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { asAdmin, fillAntenna } from '../support/core-data.ts';
import { okList } from '../ui/support/factories/base.ts';
import { body } from '../ui/support/factories/core.ts';
import { bodyCampaign, campaign, campaignDetail, joinRequest } from '../ui/support/factories/core-campaigns.ts';
import { memberListItem } from '../ui/support/factories/core-members.ts';

type Row = Record<string, unknown>;

// Every optional field of a body filled, as null isn't compared.
const filledBody = () => body({
    task_description: 'x', abbreviation: 'x', phone: 'x', fee_currency: 'EUR', country: 'x', website: 'https://www.example.org', shadow_circle_id: 1
});

test.describe('core factories of the campaign and join request pages match the real API', () => {
    test('a campaign in the lists, alone and with its body', async ({ api, otherAntenna }) => {
        const { body: antenna, member } = otherAntenna;
        await fillAntenna(api, otherAntenna, { otherBodyId: (await api.me('member')).bodies[0].id });
        // createAntenna signs its member up through a campaign whose url is the member's username.
        const [found] = await asAdmin<Row[]>(api, 'GET', `/campaigns?query=${encodeURIComponent(member.username)}`);
        const filled = campaign({ description_short: 'x' });

        const list = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/campaigns?query=${encodeURIComponent(member.username)}&limit=30&offset=0`);
        expectStatus(list, 200);
        expect(list.body.data).toHaveLength(1);
        expectShape('campaign', filled, list.body.data[0]);
        expectShape('okList', okList([filled]), list.body);

        const ofBody = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/bodies/${antenna.id}/campaigns`);
        expectStatus(ofBody, 200);
        expect(ofBody.body.data).toHaveLength(1);
        expectShape('campaign', filled, ofBody.body.data[0]);

        const detail = await api.call<Envelope<Row>>('admin', 'GET', `/api/core/campaigns/${String(found.id)}`);
        expectStatus(detail, 200);
        expectShape('campaignDetail', campaignDetail({
            description_short: 'x',
            autojoin_body: { id: 1, name: 'AEGEE-Antenna', email: 'antenna@example.com', phone: '+32 000 00 00 00', address: 'Somewhere in Europe', website: 'https://www.example.org' }
        }), detail.body.data);

        const ofOneBody = await api.call<Envelope<Row>>('admin', 'GET', `/api/core/bodies/${antenna.id}/campaigns/${String(found.id)}`);
        expectStatus(ofOneBody, 200);
        expectShape('bodyCampaign', bodyCampaign({ description_short: 'x', autojoin_body: filledBody() }), ofOneBody.body.data);
    });

    test('a campaign as creating it answers', async ({ api, otherAntenna }) => {
        const url = `e2e-contract-${Date.now()}`;
        const created = await api.call<Envelope<Row>>('admin', 'POST', `/api/core/bodies/${otherAntenna.body.id}/campaigns`, {
            name: 'E2E contract campaign', url, active: true, description_short: 'Short', description_long: 'Long'
        });
        expectStatus(created, 200);
        try {
            expectShape('campaign', campaign({ description_short: 'x' }), created.body.data);
        } finally {
            await asAdmin(api, 'DELETE', `/campaigns/${String(created.body.data.id)}`);
        }
    });

    test('the members who signed up through a campaign', async ({ api, otherAntenna }) => {
        const { member } = otherAntenna;
        await fillAntenna(api, otherAntenna, { otherBodyId: (await api.me('member')).bodies[0].id });
        const [found] = await asAdmin<Row[]>(api, 'GET', `/campaigns?query=${encodeURIComponent(member.username)}`);

        const list = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/campaigns/${String(found.id)}/members?limit=30&offset=0`);
        expectStatus(list, 200);
        expect(list.body.data).toHaveLength(1);
        const filled = memberListItem({ about_me: 'x', image: 'picture.png', gsuite_id: 'example-x@aegee.eu', campaign_id: 1 });
        expectShape('memberListItem', filled, list.body.data[0]);
        expectShape('okList', okList([filled]), list.body);

        const ofBody = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/bodies/${otherAntenna.body.id}/campaigns/${String(found.id)}/members?limit=30&offset=0`);
        expectStatus(ofBody, 200);
        expect(ofBody.body.data).toHaveLength(1);
        expectShape('memberListItem', filled, ofBody.body.data[0]);
    });

    test('a join request with the member who asked', async ({ api, otherAntenna }) => {
        const { member } = otherAntenna;
        const seededBody = (await api.me('member')).bodies[0].id;
        // Among others, the antenna's member asks to join the body of the seeded member.
        await fillAntenna(api, otherAntenna, { otherBodyId: seededBody });

        const list = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/bodies/${seededBody}/join-requests?query=${encodeURIComponent(member.first_name)}&limit=30&offset=0`);
        expectStatus(list, 200);
        const mine = list.body.data.filter((row) => row.user_id === member.id);
        expect(mine).toHaveLength(1);
        const filled = joinRequest({
            user: memberListItem({ about_me: 'x', image: 'picture.png', gsuite_id: 'example-x@aegee.eu', campaign_id: 1 })
        });
        expectShape('joinRequest', filled, mine[0]);
        expectShape('okList', okList([filled]), list.body, { ignore: { '$.data': 'the row of this test is compared just above' } });
    });
});
