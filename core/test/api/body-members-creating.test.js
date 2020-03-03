const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User, BodyMembership } = require('../../models');

describe('Body members creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();
        const member = generator.generateUser({ first_name: '   ' });

        const res = await request({
            uri: '/bodies/' + body.id + '/create-member',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: member
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('first_name');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();
        const member = generator.generateUser();

        const res = await request({
            uri: '/bodies/' + body.id + '/create-member',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: member
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should remove extra fields', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();
        const member = generator.generateUser({ superadmin: true });

        const res = await request({
            uri: '/bodies/' + body.id + '/create-member',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: member
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const memberFromDb = await User.findByPk(res.body.data.user_id);
        expect(memberFromDb.superadmin).not.toEqual(true);
    });

    test('should create a body membership', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();
        const member = generator.generateUser({ superadmin: true });

        const res = await request({
            uri: '/bodies/' + body.id + '/create-member',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: member
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const membershipFromDb = await BodyMembership.findOne({
            where: {
                user_id: res.body.data.user_id,
                body_id: body.id
            }
        });
        expect(membershipFromDb).not.toEqual(null);
    });
});
