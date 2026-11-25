// Checks the builders of factories/core-members.ts (what the member pages get) against the real
// answers. See tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { PASSWORD } from '../support/constants.ts';
import { expectShape } from '../support/contract.ts';
import { asAdmin, createCampaign, fillAntenna } from '../support/core-data.ts';
import { okList } from '../ui/support/factories/base.ts';
import { eventApplicationBan, futureApplication, memberListItem } from '../ui/support/factories/core-members.ts';

type Row = Record<string, unknown>;

// What the future applications of a member look like in the three services.
const futureApplications = (api: Parameters<typeof asAdmin>[0], service: string, userId: number) => api.call<Envelope<Row[]>>('admin', 'GET', `/api/${service}/applications/future/${userId}`);

test.describe('member page factories match the real API', () => {
    test('a row of the members list', async ({ api, otherAntenna }) => {
        await fillAntenna(api, otherAntenna, { otherBodyId: (await api.me('member')).bodies[0].id });
        const { username } = otherAntenna.member;

        const list = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/members?query=${encodeURIComponent(username)}&limit=30&offset=0&sort=id&direction=asc`);
        expectStatus(list, 200);
        expect(list.body.data).toHaveLength(1);
        // Every optional field filled, as null isn't compared.
        const filled = memberListItem({ about_me: 'x', image: 'picture.png', gsuite_id: 'example-x@aegee.eu', campaign_id: 1 });
        expectShape('memberListItem', filled, list.body.data[0]);
        expectShape('okList', okList([filled]), list.body);
        // Bodies and circles are not part of a row.
        expect(Object.keys(list.body.data[0])).not.toContain('bodies');
        expect(Object.keys(list.body.data[0])).not.toContain('circles');
    });

    test('a row of the unconfirmed members list', async ({ api, otherAntenna }) => {
        const [campaign, removeCampaign] = await createCampaign(api, { autojoinBody: otherAntenna.body.id });
        try {
            const username = `e2e-unconfirmed-${Date.now()}`;
            const signup = await api.call(null, 'POST', `/api/core/signup/${campaign.url}`, {
                username, email: `${username}@example.com`, password: PASSWORD, first_name: 'Not', last_name: 'Confirmed', privacy_consent: new Date()
            });
            expectStatus(signup, 200);

            const list = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/members/unconfirmed?query=${username}&limit=30&offset=0&sort=id&direction=asc`);
            expectStatus(list, 200);
            expect(list.body.data).toHaveLength(1);
            expectShape('memberListItem', memberListItem({ campaign_id: 1 }), list.body.data[0], {
                gaps: {
                    '$.mail_confirmed_at': 'nobody in this list has confirmed the address: that is what the list is for',
                    '$.primary_body_id': 'a member who signed up has no primary body yet',
                    '$.about_me': 'signing up does not ask for it',
                    '$.image': 'signing up does not ask for a picture',
                    '$.gsuite_id': 'a member who signed up has no Workspace account yet',
                    '$.last_logged_in': 'an unconfirmed member cannot log in',
                    '$.last_active': 'an unconfirmed member cannot log in',
                    '$.date_of_birth': 'signing up does not ask for it'
                }
            });
            expectShape('okList', okList([memberListItem()]), list.body, { ignore: { '$.data': 'the rows are compared just above' } });
        } finally {
            await removeCampaign();
        }
    });

    test('an event application ban, as set and as the member page shows it', async ({ api, otherAntenna }) => {
        const { member } = otherAntenna;
        const banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const set = await api.call<Envelope<Row>>('admin', 'PUT', `/api/core/members/${member.id}/event-application-ban`, { ban_until: banUntil });
        expectStatus(set, 200);
        const gaps = {
            '$.lifted_by_user_id': 'an active ban was never lifted; a lifted one is not sent',
            '$.lifted_at': 'an active ban was never lifted; a lifted one is not sent'
        };
        expectShape('eventApplicationBan', eventApplicationBan(), set.body.data, { gaps });

        const shown = await asAdmin<{ event_application_ban: Row }>(api, 'GET', `/members/${member.id}`);
        expectShape('eventApplicationBan', eventApplicationBan(), shown.event_application_ban, { gaps });
    });

    test('a future application in events', async ({ api }) => {
        const event = await api.createEvent('admin');
        await api.publishAsAdmin(event.id);
        await api.apply('member', event.id);
        const { id } = await api.me('member');

        const future = await futureApplications(api, 'events', id);
        expectStatus(future, 200);
        const mine = future.body.data.find((item) => item.event_id === event.id);
        expectShape('futureApplication', futureApplication({ service: 'events' }), mine);
        expect(mine?.service).toBe('events');
    });

    test('a future application in statutory', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        await api.applyToStatutory('member', event);
        const { id } = await api.me('member');

        const future = await futureApplications(api, 'statutory', id);
        expectStatus(future, 200);
        const mine = future.body.data.find((item) => item.event_id === event.id);
        expectShape('futureApplication', futureApplication({ service: 'statutory', event_type: 'agora' }), mine);
        expect(mine?.service).toBe('statutory');
    });

    test('the future applications in summeruniversity', async ({ api }) => {
        const { id } = await api.me('member');

        const future = await futureApplications(api, 'summeruniversity', id);
        expectStatus(future, 200);
        expectShape('futureApplication', [futureApplication({ service: 'summeruniversity' })], future.body.data, {
            gaps: {
                '$[0]': 'a summer university only takes applications after its approvals and publication, which the real stack has no helper for; the service builds the same rows as events and statutory (lib/applications.js)'
            }
        });
    });
});
