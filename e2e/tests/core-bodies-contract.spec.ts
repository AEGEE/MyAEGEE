// Checks the builders of ui/support/factories/core-bodies.ts (one body and its members) against
// what core really answers. See tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { asAdmin, fillAntenna } from '../support/core-data.ts';
import { circle } from '../ui/support/factories/core.ts';
import { bodyDetail } from '../ui/support/factories/core-bodies.ts';

type Row = Record<string, unknown>;

test.describe('core factories of the body pages match the real API', () => {
    test('one body, with its circles and its shadow circle', async ({ api, otherAntenna }) => {
        const { body } = otherAntenna;
        await fillAntenna(api, otherAntenna, { otherBodyId: (await api.me('member')).bodies[0].id });
        await asAdmin(api, 'PUT', `/bodies/${body.id}`, {
            phone: '+32 000 00 00 00',
            postal_address: 'PO Box 1',
            gsuite_id: `e2e-body-${body.id}@example.org`,
            google_group: `e2e-group-${body.id}@example.org`
        });
        // The antenna's members circle is its shadow circle (createAntenna): give it a mailing list.
        const real = await api.call<Envelope<Row>>('admin', 'GET', `/api/core/bodies/${body.id}`);
        expectStatus(real, 200);
        const shadow = real.body.data.shadow_circle as { id: number };
        await asAdmin(api, 'PUT', `/circles/${shadow.id}`, { gsuite_id: `e2e-circle-${shadow.id}@example.com` });

        const filledCircle = circle({ body_id: 1, parent_circle_id: 1, gsuite_id: 'circle@example.com' });
        const filled = bodyDetail({
            task_description: 'x',
            abbreviation: 'x',
            phone: 'x',
            fee_currency: 'EUR',
            country: 'x',
            website: 'https://www.example.org',
            shadow_circle_id: 1,
            postal_address: 'x',
            gsuite_id: 'x@example.org',
            google_group: 'x@example.org',
            circles: [filledCircle],
            shadow_circle: filledCircle
        });
        const again = await api.call<Envelope<Row>>('admin', 'GET', `/api/core/bodies/${body.id}`);
        expectStatus(again, 200);
        expectShape('bodyDetail', filled, again.body.data);
    });
});
