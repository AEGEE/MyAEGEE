const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { BodyMembership, CircleMembership } = require('../../models');

describe('Memberships deleting', () => {
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
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members/1337',
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
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);
        const membership = await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members/' + membership.id,
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
        const user = await generator.createUser();
        const token = await generator.createAccessToken({}, user);

        const circleMembership = await generator.createCircleMembership(circle, user);
        const membership = await generator.createBodyMembership(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/members/' + membership.id,
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
});
