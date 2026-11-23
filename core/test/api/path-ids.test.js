const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { ROUTES, createFixtures } = require('../scripts/body-routes');

// Values that are not the ID of anything, but look like a number to JavaScript or are too big for the database.
const NOT_AN_ID = ['Infinity', '-Infinity', '1e3', '0x10', '1.5', '-1', '%20', '2147483648', '99999999999999999999'];

// One route per ID in a path. `alias`: the route also takes a name (a username, a body code or
// the URL of a campaign), so a value that is not an ID is looked up as a name and not found.
const PATHS = [
    { name: '/members/:user_id', path: (d, id) => `/members/${id}`, alias: true },
    { name: '/bodies/:body_id', path: (d, id) => `/bodies/${id}`, alias: true },
    { name: '/campaigns/:campaign_id', path: (d, id) => `/campaigns/${id}`, alias: true },
    { name: '/circles/:circle_id', path: (d, id) => `/circles/${id}` },
    { name: '/circles/:circle_id/members/:membership_id (circle)', path: (d, id) => `/circles/${id}/members/${d.circleMembership.id}` },
    { name: '/circles/:circle_id/members/:membership_id (membership)', path: (d, id) => `/circles/${d.circle.id}/members/${id}` },
    { name: '/permissions/:permission_id', path: (d, id) => `/permissions/${id}` },
    { name: '/bodies/:body_id/members/:membership_id', path: (d, id) => `/bodies/${d.body.id}/members/${id}` },
    { name: '/bodies/:body_id/campaigns/:campaign_id', path: (d, id) => `/bodies/${d.body.id}/campaigns/${id}` },
    { name: '/bodies/:body_id/payments/:payment_id', path: (d, id) => `/bodies/${d.body.id}/payments/${id}`, method: 'PUT' },
    { name: '/bodies/:body_id/join-requests/:request_id/status', path: (d, id) => `/bodies/${d.body.id}/join-requests/${id}/status`, method: 'PUT' },
    { name: '/resources/categories/:category_id', path: (d, id) => `/resources/categories/${id}` },
    { name: '/resources/links/:link_id', path: (d, id) => `/resources/links/${id}` }
];

describe('IDs in paths', () => {
    let data;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        data = await createFixtures();
        for (const [action, object] of [['view_members', 'body'], ['view', 'campaign'], ['view', 'member'], ['view_members', 'circle']]) {
            await generator.createPermission({ scope: 'global', action, object });
        }
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (row, id) => request({
        path: row.path(data, id),
        method: row.method || 'GET',
        headers: { 'X-Auth-Token': data.token.value },
        body: row.method === 'PUT' ? {} : undefined
    });

    describe.each(PATHS)('$name', (row) => {
        test.each(NOT_AN_ID)(`answers ${row.alias ? 404 : 400} for "%s"`, async (id) => {
            const res = await send(row, id);

            expect(res.statusCode).toEqual(row.alias ? 404 : 400);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
        });
    });

    // The routes under a body take its code as well as its ID.
    describe('a body addressed by its code', () => {
        const nested = ROUTES.filter((route) => route.name.startsWith('/bodies/:body_id/') && route.method === 'PUT' && route.name !== '/bodies/:body_id/status');

        test.each(nested)('$title works like with the ID', async (route) => {
            const res = await request({
                path: route.path(data).replace(`/bodies/${data.body.id}/`, `/bodies/${data.body.code}/`),
                method: route.method,
                headers: { 'X-Auth-Token': data.token.value },
                body: route.body(data)
            });

            expect(res.statusCode).toEqual(200);
        });

        test('GET /bodies/:body_id/members/:membership_id works like with the ID', async () => {
            const res = await request({
                path: `/bodies/${data.body.code.toLowerCase()}/members/${data.membership.id}`,
                headers: { 'X-Auth-Token': data.token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(data.membership.id);
        });

        test('a membership of another body is not found', async () => {
            const res = await request({
                path: `/bodies/${data.otherBody.code}/members/${data.membership.id}`,
                headers: { 'X-Auth-Token': data.token.value }
            });

            expect(res.statusCode).toEqual(404);
        });
    });
});
