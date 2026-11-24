// Checks the builders the mocked-API suite uses for the static pages
// (ui/support/factories/static.ts) against what the services really answer. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { healthcheck, resourceCategory, resourceLink } from '../ui/support/factories/static.ts';

type Row = Record<string, unknown> & { links: unknown[] };

test.describe('static page factories match the real API', () => {
    test('the healthchecks of the services', async ({ api }) => {
        for (const service of ['core', 'events', 'summeruniversity', 'statutory']) {
            const res = await api.call<Envelope<unknown>>(null, 'GET', `/api/${service}/healthcheck`);
            expectStatus(res, 200);
            expectShape('healthcheck', healthcheck(), res.body.data);
        }
    });

    test('the sections of the resources page and their links', async ({ api }) => {
        const res = await api.call<Envelope<Row[]>>('member', 'GET', '/api/core/resources');
        expectStatus(res, 200);
        // core's seed has sections with links.
        const withLinks = res.body.data.find((section) => section.links.length > 0);
        expect(withLinks, 'a section with links').toBeTruthy();

        expectShape('resourceCategory', resourceCategory(), withLinks);
        expectShape('resourceLink', resourceLink(), withLinks!.links[0]);
    });
});
