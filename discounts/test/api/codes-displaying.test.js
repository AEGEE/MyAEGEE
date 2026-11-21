const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const { Code } = require('../../models');

const setCodeUpdatedAt = (code, timestamp) => Code.sequelize.query('UPDATE codes SET updated_at = :timestamp WHERE id = :id', {
    replacements: { timestamp, id: code.id }
});

describe('Codes displaying', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should return my codes with integrations', async () => {
        const integration = await generator.createIntegration();

        // 1 code available
        const code = await generator.createCode({ claimed_by: user.id }, integration);

        const res = await request({
            path: '/codes/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(code.id);
        expect(res.body.data[0].integration.id).toEqual(integration.id);
    });

    test('should not return other users codes with integrations', async () => {
        const integration = await generator.createIntegration();

        // 1 code available
        await generator.createCode({ claimed_by: 1337 }, integration);

        const res = await request({
            path: '/codes/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(0);
    });

    test('should return my codes ordered by updated_at descending', async () => {
        const integration = await generator.createIntegration();

        const olderCode = await generator.createCode({ claimed_by: user.id }, integration);
        const newerCode = await generator.createCode({ claimed_by: user.id }, integration);
        await setCodeUpdatedAt(olderCode, new Date('2024-01-01T00:00:00.000Z'));
        await setCodeUpdatedAt(newerCode, new Date('2024-01-02T00:00:00.000Z'));

        const res = await request({
            path: '/codes/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.map((code) => code.id)).toEqual([newerCode.id, olderCode.id]);
    });
});
