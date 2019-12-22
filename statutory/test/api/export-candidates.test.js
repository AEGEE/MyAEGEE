const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const helpers = require('../../lib/helpers');
const constants = require('../../lib/constants');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Export candidates', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({
            type: 'agora',
            applications: [],
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'string', description: 'test', required: true }
            ]
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return nothing if no candidates', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/positions/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            qs: { select: constants.CANDIDATE_FIELDS }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // 1 sheet

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1); // 1 string in sheet
    });

    test('should return something if present', async () => {
        const anotherEvent = await generator.createEvent({ type: 'agora' });
        const anotherPosition = await generator.createPosition({}, anotherEvent);
        await generator.createCandidate({}, anotherPosition);

        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({}, position);

        const res = await request({
            uri: '/events/' + event.id + '/positions/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            qs: { select: ['id'] }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
        expect(sheet[1][0]).toEqual(candidate.id);
    });

    test('should return 403 if you have no permissions to access', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/events/' + event.id + '/positions/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            qs: { select: constants.CANDIDATE_FIELDS }
        });

        expect(res.statusCode).toEqual(403);
    });

    test('should work okay with selecting', async () => {
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ status: 'approved' }, position);

        const res = await request({
            uri: '/events/' + event.id + '/positions/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            qs: { select: ['id', 'status'] }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2);

        // Headers
        expect(sheet[0].length).toEqual(2);
        expect(sheet[0][0]).toEqual(constants.CANDIDATE_FIELDS.id);
        expect(sheet[0][1]).toEqual(constants.CANDIDATE_FIELDS.status);

        // Actual data
        expect(sheet[1].length).toEqual(2);
        expect(sheet[1][0]).toEqual(helpers.beautify(candidate.id));
        expect(sheet[1][1]).toEqual(helpers.beautify(candidate.status));
    });

    test('should return all candidates if no filter provided', async () => {
        const position = await generator.createPosition({}, event);
        await generator.createCandidate({ status: 'approved' }, position);
        await generator.createCandidate({ status: 'rejected' }, position);

        const res = await request({
            uri: '/events/' + event.id + '/positions/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            qs: { select: constants.CANDIDATE_FIELDS, filter: {} }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(3); // headers + 2 applications
    });

    test('should use the filter if provided', async () => {
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ status: 'approved' }, position);
        await generator.createCandidate({ status: 'rejected' }, position);

        const res = await request({
            uri: '/events/' + event.id + '/positions/export',
            method: 'GET',
            json: false,
            encoding: null, // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            qs: {
                select: constants.CANDIDATE_FIELDS,
                filter: { status: 'approved' }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
        expect(sheet[1][0]).toEqual(candidate.id);
    });
});
