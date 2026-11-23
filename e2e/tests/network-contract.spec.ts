// Checks the builders the mocked-API suite uses for the network service
// (ui/support/factories/network.ts) against what network really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { board } from '../ui/support/factories/network.ts';

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
});
