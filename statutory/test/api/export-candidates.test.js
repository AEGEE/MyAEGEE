const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const helpers = require('../../lib/helpers');
const constants = require('../../lib/constants');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const mails = require('../assets/core-notification-mails.json').data;

// Every field that can be exported, in the order of the columns, and the header of each.
const ALL_FIELDS = Object.keys(constants.CANDIDATE_FIELDS);
const ALL_HEADERS = Object.values(constants.CANDIDATE_FIELDS);

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
            query: { select: ALL_FIELDS }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // 1 sheet

        const sheet = data[0].data;
        expect(sheet).toEqual([ALL_HEADERS]); // only the header row
        expect(res.headers['content-disposition']).toEqual('attachment; filename=stats.xlsx');
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
            query: { select: ['id', 'first_name'] }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
        expect(sheet[0]).toEqual(['ID', 'First name']);
        expect(sheet[1][0]).toEqual(candidate.id);
    });

    test('should return 403 if you have no permissions to access', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: ALL_FIELDS }
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
            query: { select: ALL_FIELDS, filter: {} }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(3); // headers + 2 applications
        expect(sheet[0]).toEqual(ALL_HEADERS);
        expect(sheet.slice(1).map((row) => row[ALL_FIELDS.indexOf('status')]).sort()).toEqual(['approved', 'rejected']);
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
                select: ALL_FIELDS,
                filter: { status: 'approved' }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
        expect(sheet[0]).toEqual(ALL_HEADERS);
        expect(sheet[1][ALL_FIELDS.indexOf('id')]).toEqual(candidate.id);
        expect(sheet[1][ALL_FIELDS.indexOf('status')]).toEqual('approved');
    });

    test('should return 400 if the filter has a status candidates cannot have', async () => {
        const res = await request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: ALL_FIELDS,
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
                select: ALL_FIELDS,
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
                select: ALL_FIELDS,
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

    describe('who may export and what is exported', () => {
        const MANAGE = 'global:manage_candidates:agora';

        const exportCandidates = (query) => request({
            path: '/events/' + event.id + '/positions/export',
            method: 'GET',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla' },
            query
        });

        const rowsOf = (res) => xlsx.parse(res.body)[0].data;

        test('lets a holder of global:manage_candidates:agora alone export the candidatures of this Agora for the positions that are not deleted', async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });

            const position = await generator.createPosition({ name: 'President' }, event);
            const candidate = await generator.createCandidate({ user_id: 2, first_name: 'Ada' }, position);

            const deletedPosition = await generator.createPosition({ deleted: true }, event);
            await generator.createCandidate({ user_id: 3 }, deletedPosition);

            const otherEvent = await generator.createEvent({ type: 'agora' });
            const otherPosition = await generator.createPosition({}, otherEvent);
            await generator.createCandidate({ user_id: 4 }, otherPosition);

            const res = await exportCandidates({ select: ['id', 'first_name', 'position.name', 'notification_email'] });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-disposition']).toEqual('attachment; filename=stats.xlsx');
            expect(rowsOf(res)).toEqual([
                ['ID', 'First name', 'Position', 'Email'],
                [candidate.id, 'Ada', 'President', 'test@example.com']
            ]);
        });

        test('refuses a holder of the permission for another event type and of the other permissions for an Agora', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:manage_candidates:epm',
                        'global:manage_event:agora',
                        'global:manage_applications:agora',
                        'global:manage_plenaries:agora',
                        'global:manage_question_lines:agora'
                    ]
                }
            });

            const res = await exportCandidates({ select: ['id', 'first_name'] });

            expect(res.statusCode).toEqual(403);
            expect(JSON.parse(res.body.toString())).toEqual({
                success: false,
                message: 'You are not allowed to export candidates.'
            });
        });

        test('exports every field when none is selected', async () => {
            const position = await generator.createPosition({}, event);
            const candidate = await generator.createCandidate({ user_id: 2 }, position);

            const res = await exportCandidates();

            expect(res.statusCode).toEqual(200);

            const rows = rowsOf(res);
            expect(rows.length).toEqual(2);
            expect(rows[0]).toEqual(ALL_HEADERS);
            expect(rows[1][ALL_FIELDS.indexOf('id')]).toEqual(candidate.id);
        });

        test('exports the candidatures with one of the statuses of a list', async () => {
            const position = await generator.createPosition({}, event);
            await generator.createCandidate({ status: 'approved' }, position);
            await generator.createCandidate({ status: 'pending' }, position);
            await generator.createCandidate({ status: 'rejected' }, position);

            const res = await request({
                path: '/events/' + event.id + '/positions/export?select[]=status&filter[status][]=approved&filter[status][]=pending',
                method: 'GET',
                responseType: 'buffer',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);

            const rows = rowsOf(res);
            expect(rows[0]).toEqual(['Status']);
            expect(rows.slice(1).map((row) => row[0]).sort()).toEqual(['approved', 'pending']);
        });

        // BUG: one selected field written as `select=id` reaches the route as a string, which it
        // takes as no selection at all. Expected: the one column, as with `select[]=id`.
        test('exports every field when one field is selected without brackets', async () => {
            const position = await generator.createPosition({}, event);
            await generator.createCandidate({ user_id: 2 }, position);

            const withoutBrackets = await request({
                path: '/events/' + event.id + '/positions/export?select=id',
                method: 'GET',
                responseType: 'buffer',
                headers: { 'X-Auth-Token': 'blablabla' }
            });
            const withBrackets = await request({
                path: '/events/' + event.id + '/positions/export?select[]=id',
                method: 'GET',
                responseType: 'buffer',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(rowsOf(withoutBrackets)[0]).toEqual(ALL_HEADERS);
            expect(rowsOf(withBrackets)[0]).toEqual(['ID']);
        });
    });
});
