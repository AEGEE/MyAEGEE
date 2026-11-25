// Checks the builders the mocked-API suite uses for the network service
// (ui/support/factories/network.ts) against what network really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { createBoard, createPublishedAgora, createPublishedSummerUniversity, day } from '../support/network-data.ts';
import {
    antennaCriterion, board, mailComponent, netcomAssignment, networkRecentEvent, networkRecentStatutoryEvent, networkRecentSummerUniversity,
    recentBoardElection
} from '../ui/support/factories/network.ts';

type Row = Record<string, unknown>;

test.describe('network factories match the real API', () => {
    test('a board, in the lists and on its own', async ({ api, otherAntenna }) => {
        const { body, member } = otherAntenna;
        const path = `/api/network/bodies/${body.id}/boards`;
        // Every field filled, as null isn't compared.
        const filled = board({
            name: 'Board of the test antenna',
            other_members: [{ user_id: member.id, function: 'PR responsible' }],
            message: 'Elected at the local Agora',
            image_id: 1
        });

        expectStatus(await api.call('admin', 'POST', path, {
            name: filled.name,
            elected_date: filled.elected_date,
            start_date: filled.start_date,
            end_date: filled.end_date,
            president: member.id,
            secretary: member.id,
            treasurer: member.id,
            other_members: filled.other_members,
            message: filled.message,
            image_id: filled.image_id
        }), 200);

        const ofBody = await api.call<Envelope<Row[]>>('admin', 'GET', path);
        expectStatus(ofBody, 200);
        expect(ofBody.body.data).toHaveLength(1);
        const id = ofBody.body.data[0].id as number;

        try {
            expectShape('board', filled, ofBody.body.data[0]);

            const all = await api.call<Envelope<Row[]>>('netcom', 'GET', '/api/network/boards');
            expectShape('board', filled, all.body.data.find((item) => item.id === id));

            const current = await api.call<Envelope<Row[]>>('netcom', 'GET', `${path}/current`);
            expectShape('board', [filled], current.body.data);

            const single = await api.call<Envelope<Row>>('netcom', 'GET', `${path}/${id}`);
            expectShape('board', filled, single.body.data);
        } finally {
            expectStatus(await api.call('admin', 'DELETE', `${path}/${id}`), 200);
        }
    });

    test('the latest board election of a body', async ({ api, otherAntenna }) => {
        const [created, cleanup] = await createBoard(api, otherAntenna, { elected_date: day(-40) });
        try {
            const recents = await api.call<Envelope<Row[]>>('netcom', 'GET', `/api/network/boards/recents?ends=${day(0)}`);
            expectStatus(recents, 200);
            const ofBody = recents.body.data.find((row) => row.body_id === otherAntenna.body.id);
            expect(ofBody).toEqual({ body_id: otherAntenna.body.id, latest_election: created.elected_date });
            expectShape('recentBoardElection', recentBoardElection(), ofBody);
        } finally {
            await cleanup();
        }
    });

    test('a NetCom assignment, a criterion and a mail text of an Agora', async ({ api, otherAntenna }) => {
        const agora = await createPublishedAgora(api);
        const netcom = await api.me('netcom');

        expectStatus(await api.call('netcom', 'PUT', '/api/network/netcom', { body_id: otherAntenna.body.id, netcom_id: netcom.id }), 200);
        try {
            const assignments = await api.call<Envelope<Row[]>>('netcom', 'GET', '/api/network/netcom');
            expectStatus(assignments, 200);
            expectShape('netcomAssignment', netcomAssignment(), assignments.body.data.find((row) => row.body_id === otherAntenna.body.id));
        } finally {
            expectStatus(await api.call('netcom', 'DELETE', `/api/network/netcom/${otherAntenna.body.id}`), 200);
        }

        expectStatus(await api.call('netcom', 'PUT', '/api/network/antennaCriteria', {
            agora_id: agora.id, body_id: otherAntenna.body.id, antenna_criterion: 'communication', value: 'true', comment: 'Answers every mail'
        }), 200);
        const criteria = await api.call<Envelope<Row[]>>('netcom', 'GET', `/api/network/antennaCriteria/${agora.id}`);
        expectStatus(criteria, 200);
        expectShape('antennaCriterion', antennaCriterion(), criteria.body.data.find((row) => row.body_id === otherAntenna.body.id));

        // Only holders of global:manage_network:fulfilment_email read and write the texts.
        expectStatus(await api.call('admin', 'PUT', '/api/network/mailComponent', { agora_id: agora.id, mail_component: 'introduction', text: 'Dear board of {body_name},' }), 200);
        const texts = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/network/mailComponent/${agora.id}`);
        expectStatus(texts, 200);
        expect(texts.body.data).toHaveLength(1);
        expectShape('mailComponent', mailComponent(), texts.body.data[0]);
    });

    test('the latest events of a body, as the Antenna Criteria page counts them', async ({ api, otherAntenna }) => {
        const { body, member } = otherAntenna;

        const event = await api.createEvent(member.username);
        await api.publishAsAdmin(event.id);
        const events = await api.call<Envelope<Row[]>>('netcom', 'GET', '/api/events/recents');
        expectStatus(events, 200);
        expectShape('networkRecentEvent', networkRecentEvent(), events.body.data.find((row) => (row.organizing_bodies as { body_id: number }[]).some((item) => item.body_id === body.id)));

        await createPublishedAgora(api, { body_id: body.id });
        const statutory = await api.call<Envelope<Row[]>>('netcom', 'GET', '/api/statutory/recents');
        expectStatus(statutory, 200);
        expectShape('networkRecentStatutoryEvent', networkRecentStatutoryEvent(), statutory.body.data.find((row) => row.body_id === body.id));

        const suId = await createPublishedSummerUniversity(api, otherAntenna);
        try {
            const summerUniversities = await api.call<Envelope<Row[]>>('netcom', 'GET', '/api/summeruniversity/recents');
            expectStatus(summerUniversities, 200);
            expectShape('networkRecentSummerUniversity', networkRecentSummerUniversity(), summerUniversities.body.data.find((row) => (row.organizing_bodies as { body_id: number }[]).some((item) => item.body_id === body.id)));
        } finally {
            expectStatus(await api.call('admin', 'DELETE', `/api/summeruniversity/single/${suId}`), 200);
        }
    });
});
