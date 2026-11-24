const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const helpers = require('../../lib/helpers');
const constants = require('../../lib/constants');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const mails = require('../assets/core-notification-mails.json').data;

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
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: constants.CANDIDATE_FIELDS }
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
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: ['id'] }
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
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: constants.CANDIDATE_FIELDS }
        });

        expect(res.statusCode).toEqual(403);
    });

    test('should work okay with selecting', async () => {
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ status: 'approved' }, position);

        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: ['id', 'status'] }
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
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: constants.CANDIDATE_FIELDS, filter: {} }
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
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
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

    test('should return 400 if the filter has a status candidates cannot have', async () => {
        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: constants.CANDIDATE_FIELDS,
                filter: { status: 'accepted' }
            }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(/approved, rejected, pending/);
    });

    test('should return 400 if the filter has a field other than the supported ones', async () => {
        const position = await generator.createPosition({}, event);
        await generator.createCandidate({ status: 'approved' }, position);

        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: constants.CANDIDATE_FIELDS,
                filter: { first_name: 'test' }
            }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(/^Filtering by this field is not supported\./);
        expect(body.message).not.toMatch(/first_name/);
    });

    test('should return 400 if the filter has a field of the position', async () => {
        const anotherEvent = await generator.createEvent({ type: 'agora' });
        const anotherPosition = await generator.createPosition({}, anotherEvent);
        await generator.createCandidate({ status: 'approved' }, anotherPosition);

        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: constants.CANDIDATE_FIELDS,
                filter: { '$position.event_id$': anotherEvent.id }
            }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
    });

    test('should export what the candidate wrote about the EPMs they attended', async () => {
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ attended_epm: 'EPM Yerevan 2019' }, position);

        const fields = await request({
            path: '/events/' + event.id + '/fields/candidates',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // The fields that can be selected are the fields of a candidate.
        expect(fields.statusCode).toEqual(200);
        expect(fields.body.data.attended_epm).toEqual('Number of EPMs visited');
        expect(fields.body.data).not.toHaveProperty('attended_epms');

        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' },
            query: { select: ['id', 'attended_epm'] }
        });

        expect(res.statusCode).toEqual(200);

        const [sheet] = xlsx.parse(res.body);
        expect(sheet.data).toEqual([
            ['ID', 'Number of EPMs visited'],
            [candidate.id, 'EPM Yerevan 2019']
        ]);
    });

    test('should export every selectable field of a candidate', async () => {
        const position = await generator.createPosition({ name: 'President' }, event);
        const candidate = await generator.createCandidate({ user_id: 2 }, position);
        const select = Object.keys(constants.CANDIDATE_FIELDS);

        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' },
            query: { select }
        });

        expect(res.statusCode).toEqual(200);

        const [sheet] = xlsx.parse(res.body);
        expect(sheet.data[0]).toEqual(Object.values(constants.CANDIDATE_FIELDS));

        // The values a candidate is asked for are all there, each under its own header.
        const row = Object.fromEntries(select.map((field, index) => [field, sheet.data[1][index]]));
        for (const field of ['first_name', 'last_name', 'nationality', 'studies', 'attended_agorae', 'attended_epm', 'attended_conferences', 'motivation', 'program']) {
            expect(row[field]).toEqual(candidate[field]);
        }
        expect(row['position.name']).toEqual('President');
        expect(row.notification_email).toEqual(mails.find((mail) => mail.id === 2).notification_email);
    });

    test('should take a single selected field as a list of one', async () => {
        const position = await generator.createPosition({}, event);
        await generator.createCandidate({ first_name: 'Carla' }, position);

        const res = await request({
            path: '/events/' + event.id + '/positions/export?select=first_name',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const [sheet] = xlsx.parse(res.body);
        expect(sheet.data).toEqual([['First name'], ['Carla']]);
    });
});
