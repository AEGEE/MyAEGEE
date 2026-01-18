const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Netcom } = require('../../models');

describe('Netcom', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail listing Netcom assignment if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/netcom',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should list Netcom assignment if everything is okay', async () => {
        await generator.createNetcom();

        const res = await request({
            uri: '/netcom',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
    });

    test('should fail creating Netcom assignment if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const netcom = generator.generateNetcom();

        const res = await request({
            uri: '/netcom',
            method: 'PUT',
            body: netcom,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail creating Netcom assignment if body_id is not set', async () => {
        const netcom = generator.generateNetcom({ body_id: null });

        const res = await request({
            uri: '/netcom',
            method: 'PUT',
            body: netcom,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('body_id');
    });

    test('should fail creating Netcom assignment if netcom_id is not set', async () => {
        const netcom = generator.generateNetcom({ netcom_id: null });

        const res = await request({
            uri: '/netcom',
            method: 'PUT',
            body: netcom,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('netcom_id');
    });

    test('should create new Netcom assignment if everything is okay', async () => {
        const netcom = generator.generateNetcom();

        const res = await request({
            uri: '/netcom',
            method: 'PUT',
            body: netcom,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('body_id');
        expect(res.body.data).toHaveProperty('netcom_id');
    });

    test('should update existing Netcom assignment if everything is okay', async () => {
        await generator.createNetcom({ body_id: 1, netcom_id: 2 });
        const netcom = generator.generateNetcom({ body_id: 1, netcom_id: 3 });

        const res = await request({
            uri: '/netcom',
            method: 'PUT',
            body: netcom,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('body_id');
        expect(res.body.data.body_id).toEqual(1);
        expect(res.body.data).toHaveProperty('netcom_id');
        expect(res.body.data.netcom_id).toEqual(3);
    });

    test('should fail deleting Netcom assignment if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const netcom = await generator.createNetcom();

        const res = await request({
            uri: '/netcom/' + netcom.body_id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should delete Netcom assignment if everything is okay', async () => {
        const netcom = await generator.createNetcom();

        const res = await request({
            uri: '/netcom/' + netcom.body_id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toEqual('NetCom assignment was deleted.');

        const netcomFromDB = await Netcom.findByPk(netcom.body_id);

        expect(netcomFromDB).toEqual(null);
    });
});
