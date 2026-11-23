const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

// `/members/me` is the member who asks. It answers like `/members/<their own id>`.
describe('The member addressed as me', () => {
    let user;
    let token;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    // A member who holds a local permission through a circle of their own body.
    beforeEach(async () => {
        user = await generator.createUser();
        token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'delete', object: 'member' });
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    const send = (path, options = {}) => request({ path, headers: { 'X-Auth-Token': token.value }, ...options });

    test('should have the same permissions as by their own id', async () => {
        const byId = await send('/members/' + user.id + '/my_permissions');
        const asMe = await send('/members/me/my_permissions');

        expect(byId.statusCode).toEqual(200);
        expect(byId.body.data.map((permission) => permission.combined)).toEqual(['local:delete:member']);
        expect(asMe.statusCode).toEqual(200);
        expect(asMe.body).toEqual(byId.body);
    });

    test('should be allowed what a local permission in their own body allows', async () => {
        const res = await send('/members/me', { method: 'DELETE' });

        expect(res.statusCode).toEqual(200);
        expect(await User.count({ where: { id: user.id } })).toEqual(0);
    });

    test('should get the same profile as by their own id', async () => {
        const byId = await send('/members/' + user.id);
        const asMe = await send('/members/me');

        expect(asMe.statusCode).toEqual(200);
        expect(asMe.body.data.id).toEqual(user.id);
        expect(Object.keys(asMe.body.data).sort()).toEqual(Object.keys(byId.body.data).sort());
    });

    test('should not be found under the username me of somebody else', async () => {
        const other = await generator.createUser({ username: 'me' });

        const res = await send('/members/me');

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(user.id);
        expect(await User.count({ where: { id: other.id } })).toEqual(1);
    });
});
