const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Join requests list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const firstUser = await generator.createUser();
        await generator.createJoinRequest(body, firstUser);

        const joinRequest = await generator.createJoinRequest(body, user);

        const thirdUser = await generator.createUser();
        await generator.createJoinRequest(body, thirdUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(joinRequest.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser({ password: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken({}, user);
        const body = await generator.createBody();

        const firstUser = await generator.createUser();
        const firstJoinRequest = await generator.createJoinRequest(body, firstUser);

        const secondUser = await generator.createUser();
        const secondJoinRequest = await generator.createJoinRequest(body, secondUser);

        const res = await request({
            uri: '/bodies/' + body.id + '/join-requests?sort=id&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondJoinRequest.id);
        expect(res.body.data[1].id).toEqual(firstJoinRequest.id);
    });
});
