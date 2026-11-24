// The answers the forms for managing the resources page read (one section, one link), compared
// with the factories of the mocked suite. The list of sections is checked in
// static-contract.spec.ts, for the Resources page.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { resourceCategory, resourceLink } from '../ui/support/factories/static.ts';

type Section = Record<string, unknown> & { id: number; links: (Record<string, unknown> & { id: number })[] };

test.describe('resources factories match the real API', () => {
    test('one section with its links, and one link', async ({ api }) => {
        const list = await api.call<Envelope<Section[]>>('member', 'GET', '/api/core/resources');
        expectStatus(list, 200);
        // core's seed has sections with links.
        const seeded = list.body.data.find((item) => item.links.length > 0);
        expect(seeded, 'a section with links').toBeTruthy();

        const section = await api.call<Envelope<Section>>('member', 'GET', `/api/core/resources/categories/${seeded!.id}`);
        expectStatus(section, 200);
        expectShape('resourceCategory', resourceCategory(), section.body.data);
        expect(section.body.data.links.map((link) => link.id)).toEqual(seeded!.links.map((link) => link.id));

        const link = await api.call<Envelope<Section['links'][number]>>('member', 'GET', `/api/core/resources/links/${seeded!.links[0].id}`);
        expectStatus(link, 200);
        expectShape('resourceLink', resourceLink(), link.body.data);
    });
});
