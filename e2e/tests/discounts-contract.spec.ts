// Checks the builders the mocked-API suite uses for the discounts pages
// (ui/support/factories/discounts.ts) against what the discounts service really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { addCodes, createCategory, createIntegration } from '../support/discounts-data.ts';
import { discount, discountCategory, discountCode, integration, myDiscountCode } from '../ui/support/factories/discounts.ts';

type Row = Record<string, unknown> & { id: number };

test.describe('discounts factories match the real API', () => {
    test('a category and its discounts', async ({ api }) => {
        const [category, cleanup] = await createCategory(api);
        try {
            const one = await api.call<Envelope<Row & { discounts: unknown[] }>>('member', 'GET', `/api/discounts/categories/${category.id}`);
            expectStatus(one, 200);
            expectShape('discountCategory', discountCategory(), one.body.data);
            expectShape('discount', discount(), one.body.data.discounts[0]);

            const all = await api.call<Envelope<Row[]>>('member', 'GET', '/api/discounts/categories');
            expectStatus(all, 200);
            expectShape('discountCategory', discountCategory(), all.body.data.find((row) => row.id === category.id));
        } finally {
            await cleanup();
        }
    });

    test('an integration, a claimed code and the member\'s codes', async ({ api, otherAntenna }) => {
        const created = await createIntegration(api);
        await addCodes(api, created, 1);

        const one = await api.call<Envelope<Row>>('member', 'GET', `/api/discounts/integrations/${created.id}`);
        expectStatus(one, 200);
        expectShape('integration', integration(), one.body.data);
        const all = await api.call<Envelope<Row[]>>('member', 'GET', '/api/discounts/integrations');
        expectStatus(all, 200);
        expectShape('integration', integration(), all.body.data.find((row) => row.id === created.id));

        const { member } = otherAntenna;
        const claimed = await api.call<Envelope<Row>>(member.username, 'POST', `/api/discounts/integrations/${created.id}/claim`);
        expectStatus(claimed, 200);
        expectShape('discountCode', discountCode(), claimed.body.data);

        const mine = await api.call<Envelope<Row[]>>(member.username, 'GET', '/api/discounts/codes/mine');
        expectStatus(mine, 200);
        expect(mine.body.data).toHaveLength(1);
        expectShape('myDiscountCode', myDiscountCode(), mine.body.data[0]);
    });
});
