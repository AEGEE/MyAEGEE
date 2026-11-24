const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

// Every route that takes `sort`, with a column its rows have. `listsMembers`: the rows are members.
const LISTS = [
    { name: 'GET /members', listsMembers: true, path: () => '/members', column: 'first_name' },
    { name: 'GET /members_search', listsMembers: true, path: () => '/members_search', column: 'first_name' },
    { name: 'GET /members/unconfirmed', listsMembers: true, path: () => '/members/unconfirmed', column: 'created_at' },
    { name: 'GET /bodies', path: () => '/bodies', column: 'code' },
    { name: 'GET /circles', path: () => '/circles', column: 'name' },
    { name: 'GET /permissions', path: () => '/permissions', column: 'combined' },
    { name: 'GET /campaigns', path: () => '/campaigns', column: 'url' },
    { name: 'GET /campaigns/:campaign_id/members', listsMembers: true, path: (data) => `/campaigns/${data.campaign.id}/members`, column: 'last_name' },
    { name: 'GET /bodies/:body_id/campaigns', path: (data) => `/bodies/${data.body.id}/campaigns`, column: 'name' },
    { name: 'GET /bodies/:body_id/campaigns/:campaign_id/members', listsMembers: true, path: (data) => `/bodies/${data.body.id}/campaigns/${data.campaign.id}/members`, column: 'email' },
    { name: 'GET /bodies/:body_id/members', path: (data) => `/bodies/${data.body.id}/members`, column: 'user_id' },
    {
        name: 'GET /bodies/:body_id/members?holds_permission',
        path: (data) => `/bodies/${data.body.id}/members`,
        query: { holds_permission: { action: 'process', object: 'join_request' } },
        column: 'user_id'
    },
    { name: 'GET /bodies/:body_id/join-requests', path: (data) => `/bodies/${data.body.id}/join-requests`, column: 'status' },
    { name: 'GET /bodies/:body_id/payments', path: (data) => `/bodies/${data.body.id}/payments`, column: 'expires' },
    { name: 'GET /circles/:circle_id/members', path: (data) => `/circles/${data.circle.id}/members`, column: 'user_id' },
    { name: 'GET /permissions/:permission_id/members', listsMembers: true, path: (data) => `/permissions/${data.permission.id}/members`, column: 'first_name' },
    {
        name: 'POST /my_permissions',
        path: () => '/my_permissions',
        method: 'POST',
        body: { action: 'process', object: 'join_request' },
        column: 'name'
    }
];

describe('Sorting and paging of lists', () => {
    let token;
    let data;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        const user = await generator.createUser({ superadmin: true });
        token = await generator.createAccessToken(user);

        for (const [scope, action, object] of [
            ['global', 'view', 'member'],
            ['global', 'search', 'member'],
            ['global', 'view_unconfirmed', 'member'],
            ['global', 'view', 'campaign'],
            ['global', 'view_members', 'body'],
            ['global', 'view', 'join_request'],
            ['global', 'view', 'payment'],
            ['global', 'view_members', 'circle']
        ]) {
            await generator.createPermission({ scope, action, object });
        }

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(circle, user);
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });

        data = { body, circle, permission, campaign };
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    const list = (row, sort) => request({
        path: row.path(data),
        method: row.method || 'GET',
        headers: { 'X-Auth-Token': token.value },
        query: { ...row.query, sort },
        body: row.body
    });

    const expectRefused = (res) => {
        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({
            success: false,
            message: 'The list cannot be sorted by this field.'
        });
    };

    test.each(LISTS)('$name sorts by a field of its rows', async (row) => {
        const res = await list(row, row.column);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test.each(LISTS)('$name refuses a field that does not exist', async (row) => {
        expectRefused(await list(row, 'bogus'));
    });

    test.each(LISTS)('$name refuses a field of another table', async (row) => {
        expectRefused(await list(row, 'user.password'));
    });

    // The password is the only column that the rows of a list leave out.
    test.each(LISTS.filter((row) => row.listsMembers))('$name refuses the password', async (row) => {
        expectRefused(await list(row, 'password'));
    });

    test('GET /members refuses a field that is computed and not stored', async () => {
        expectRefused(await list(LISTS[0], 'notification_email'));
    });

    test('GET /members ignores a sort that is not a single value', async () => {
        const res = await request({
            path: '/members?sort[]=first_name&sort[]=password',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
    });

    // A limit or an offset that can't be used is ignored, as a missing one is.
    describe.each(['limit', 'offset'])('%s', (parameter) => {
        test.each(LISTS)('$name ignores a value that is not a whole number', async (row) => {
            for (const value of ['Infinity', '1e3', '1.5', '-1', '0x10', '99999999999999999999', 'abc', '']) {
                const res = await request({
                    path: row.path(data),
                    method: row.method || 'GET',
                    headers: { 'X-Auth-Token': token.value },
                    query: { ...row.query, [parameter]: value },
                    body: row.body
                });

                expect({ value, status: res.statusCode }).toEqual({ value, status: 200 });
            }
        });
    });

    test('GET /circles respects a limit and an offset that are whole numbers', async () => {
        await generator.createCircle({ name: 'Aaa' });
        await generator.createCircle({ name: 'Bbb' });
        await generator.createCircle({ name: 'Ccc' });

        const res = await request({
            path: '/circles?sort=name&limit=1&offset=1',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((circle) => circle.name)).toEqual(['Bbb']);
        expect(res.body.meta.count).toEqual(3);
    });

    // Whatever a query string holds, a list answers with a success or a 4xx. Each parameter
    // a list reads (and one it does not) is tried on its own, next to the list's own query.
    describe('a query string that a list does not expect', () => {
        const PARAMETERS = ['limit', 'offset', 'sort', 'direction', 'query', 'all', 'type', 'status', 'body_id', 'holds_permission', 'filter', 'unknown'];
        const VALUES = [
            '2147483648', '-1', '0', '1.5', '1e300', '12345678', '0000-01-01', '2001-02-30', 'abc', '',
            '%00', '\u0000', 'a'.repeat(5000), ['a', 'b'], { a: 'b' }, { action: 'a', object: 'b' }
        ];

        // The other lists that take a query string.
        const OTHER_LISTS = [
            { name: 'GET /my_permissions', path: () => '/my_permissions' },
            { name: 'GET /members_email', path: () => '/members_email' },
            { name: 'GET /resources', path: () => '/resources' },
            { name: 'GET /circles/:circle_id/permissions', path: (row) => `/circles/${row.circle.id}/permissions` },
            { name: 'GET /bodies/:body_id/my_permissions', path: (row) => `/bodies/${row.body.id}/my_permissions` },
            { name: 'GET /bodies/:body_id', path: (row) => `/bodies/${row.body.id}` }
        ];

        test.each([...LISTS, ...OTHER_LISTS])('$name never answers with a server error', async (row) => {
            const failures = [];

            for (const parameter of PARAMETERS) {
                for (const value of VALUES) {
                    const res = await request({
                        path: row.path(data),
                        method: row.method || 'GET',
                        headers: { 'X-Auth-Token': token.value },
                        query: { ...row.query, [parameter]: value },
                        body: row.body
                    });

                    if (res.statusCode >= 500) {
                        failures.push({ parameter, value: JSON.stringify(value).slice(0, 20), status: res.statusCode, message: res.body.message });
                    }
                }
            }

            expect(failures).toEqual([]);
        }, 30000);
    });
});
