// /members_search after the scoped search change. In these fixtures regular members
// no longer have global:search:member; NetCom and boards still do.
const { test, expect, expectStatus } = require('../support/api');

const search = (api, username, params) => api.call(username, 'GET', `/api/core/members_search?${new URLSearchParams(params)}`);

test.describe('member search', () => {
    test('a member can search their own body and only gets names', async ({ api }) => {
        const member = await api.me('member');
        const board = await api.me('board');

        const res = await search(api, 'member', { query: board.first_name, body_id: member.bodies[0].id });
        expectStatus(res, 200);

        const found = res.body.data.find((user) => user.id === board.id);
        expect(found).toEqual({ id: board.id, first_name: board.first_name, last_name: board.last_name });
    });

    test('a member can search a co-organizing body together with their own', async ({ api }) => {
        const member = await api.me('member');
        const organizerB = await api.me('organizer-b');
        const secondAntenna = await api.secondAntenna();

        const res = await search(api, 'member', { query: 'Bravo', body_id: `${member.bodies[0].id},${secondAntenna.id}` });
        expectStatus(res, 200);
        expect(res.body.data.map((user) => user.id)).toContain(organizerB.id);
    });

    test('a member cannot search a body they are not a member of', async ({ api }) => {
        const secondAntenna = await api.secondAntenna();

        expectStatus(await search(api, 'member', { query: 'Bravo', body_id: secondAntenna.id }), 403);
    });

    test('a member cannot search all members', async ({ api }) => {
        expectStatus(await search(api, 'member', { query: 'Bravo' }), 403);
    });

    test('NetCom can search all members, without contact details', async ({ api }) => {
        const organizerB = await api.me('organizer-b');

        const res = await search(api, 'netcom', { query: 'Bravo' });
        expectStatus(res, 200);
        expect(res.body.data).toContainEqual({ id: organizerB.id, first_name: organizerB.first_name, last_name: organizerB.last_name });
    });

    test('short queries return nothing', async ({ api }) => {
        const res = await search(api, 'netcom', { query: 'B' });
        expectStatus(res, 200);
        expect(res.body.data).toEqual([]);
    });
});
