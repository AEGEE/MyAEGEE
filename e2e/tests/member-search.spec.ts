// /members_search with the production permissions from the seed: regular members no longer
// have global:search:member and search their own bodies only, NetCom keeps it through the
// other board circle. The search rules themselves (scoping, exposed fields, short queries,
// email probing) are covered by core's tests in core/test/api/users-searching.test.js.
import { test, expect, expectStatus, type Api, type ApiResult, type Envelope } from '../support/api.ts';
import type { Username } from '../support/constants.ts';

interface SearchResult {
    id: number;
    first_name: string;
    last_name: string;
}

const search = (api: Api, username: Username, params: Record<string, string | number>): Promise<ApiResult<Envelope<SearchResult[]>>> => {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    return api.call<Envelope<SearchResult[]>>(username, 'GET', `/api/core/members_search?${query}`);
};

test.describe('member search', () => {
    test('a member can only search their own bodies, and only gets names', async ({ api }) => {
        const member = await api.me('member');
        const board = await api.me('board');

        expectStatus(await search(api, 'member', { query: board.first_name }), 403);

        const res = await search(api, 'member', { query: board.first_name, body_id: member.bodies[0].id });
        expectStatus(res, 200);
        expect(res.body.data).toContainEqual({ id: board.id, first_name: board.first_name, last_name: board.last_name });
    });

    test('NetCom can search all members, without contact details', async ({ api, otherAntenna }) => {
        const { member } = otherAntenna;

        const res = await search(api, 'netcom', { query: member.last_name });
        expectStatus(res, 200);
        expect(res.body.data).toEqual([{ id: member.id, first_name: member.first_name, last_name: member.last_name }]);
    });
});
