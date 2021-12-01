const { startServer, stopServer } = require('../../lib/server');
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
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create_member', object: 'body' });

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

    test('should succeed if global permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create_member', object: 'body' });

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

    test('should succeed if local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'create_member', object: 'body' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

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

    test('should fail if no permissions', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const member = generator.generateUser();

        const res = await request({
            uri: '/bodies/' + body.id + '/create-member',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: member
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should remove extra fields', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create_member', object: 'body' });

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
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create_member', object: 'body' });

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

    test('should set mail_confirmed__at', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create_member', object: 'body' });

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

        const userFromDb = await User.findByPk(res.body.data.user_id);
        expect(userFromDb).not.toEqual(null);
        expect(userFromDb.mail_confirmed_at).not.toEqual(null);
    });
});
