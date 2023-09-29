const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { CircleMembership } = require('../../models');

describe('Circle memberships deleting own', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the membership is not found', async () => {
        const circle = await generator.createCircle();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const res = await request({
            uri: '/circles/' + circle.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const circle = await generator.createCircle();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const membership = await generator.createCircleMembership(circle, user);

        const res = await request({
            uri: '/circles/' + circle.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await CircleMembership.findByPk(membership.id);
        expect(membershipFromDb).toEqual(null);
    });
});
