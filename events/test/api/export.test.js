const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid.json').data;

describe('Export all', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const event = await generator.createEvent({
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'string', description: 'test', required: true }
            ]
        });
        const res = await request({
            uri: '/single/' + event.id + '/applications/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // at least 1 sheet

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1); // 1 string in sheet
    });

    test('should return fields if only cancelled applications', async () => {
        const event = await generator.createEvent({
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'checkbox', description: 'test', required: false },
                { type: 'string', description: 'test', required: true }
            ]
        });

        await generator.createApplication({
            cancelled: true,
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, false, 'string']
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2);
    });

    test('should return 403 if you have no permissions to access', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            organizers: [{ user_id: 1337, first_name: 'test', last_name: 'test' }],
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'string', description: 'test', required: true }
            ]
        });

        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(403);
    });
});
