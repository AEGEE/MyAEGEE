const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { BodyMembership, CircleMembership, User } = require('../../models');

describe('Memberships deleting own', () => {
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
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);
        const membership = await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await BodyMembership.findByPk(membership.id);
        expect(membershipFromDb).toEqual(null);
    });

    test('should remove user from any circles in this body', async () => {
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken({}, user);

        const circleMembership = await generator.createCircleMembership(circle, user);
        await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await CircleMembership.findByPk(circleMembership.id);
        expect(membershipFromDb).toEqual(null);
    });

    test('should unset primary body', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true, primary_body_id: body.id });
        const token = await generator.createAccessToken({}, user);
        await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const memberFromDb = await User.findByPk(user.id);
        expect(memberFromDb.primary_body_id).toEqual(null);
    });
});
