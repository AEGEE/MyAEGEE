const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const helpers = require('../../lib/helpers');
const constants = require('../../lib/constants');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const users = require('../assets/core-members.json').data;

describe('Export all', () => {
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

    test('should return nothing if no applications', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // at least 1 sheet

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1); // 1 string in sheet
    });

    test('should return nothing if only cancelled applications', async () => {
        await generator.createApplication({
            cancelled: true,
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1);
    });

    test('should return something if there are not cancelled applications', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            participant_type: 'delegate',
            participant_order: 2,
        }, event);
        await generator.createApplication({
            user_id: users[1].id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 1,
            attended: true,
            confirmed: true,
            incoming: true,
            departed: true,
            registered: true,
            cancelled: false,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(3);
    });

    test('should return 403 if you have no permissions to access', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(403);
    });

    test('should return 400 if no filter provided', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(400);
    });

    test('should work okay with selecting', async () => {
        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: ['id', 'answers.0'] }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2);

        const fields = helpers.getApplicationFields(event);

        // Headers
        expect(sheet[0].length).toEqual(2);
        expect(sheet[0][0]).toEqual(fields.id);
        expect(sheet[0][1]).toEqual(fields['answers.0']);

        // Actual data
        expect(sheet[1].length).toEqual(2);
        expect(sheet[1][0]).toEqual(helpers.beautify(application.id));
        expect(sheet[1][1]).toEqual(helpers.beautify(application.answers[0]));
    });

    test('should filter out selected fields on /incoming', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/incoming',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet[0].length).not.toEqual(Object.keys(helpers.getApplicationFields(event)).length);
        expect(sheet[0].length).toEqual(constants.ALLOWED_INCOMING_FIELDS.length);
    });

    test('should return 400 on invalid prefix', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/invalid',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(400);
    });

    test('should use the default filter if the passed filter is not provided', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 1,
            answers: [true, 'string'],
            status: 'accepted'
        }, event);

        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: 'delegate',
            participant_order: 2,
            answers: [true, 'string'],
            status: 'rejected'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)), filter: false }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(3); // headers + 2 applications
    });

    test('should use the filter if provided', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted',
            confirmed: true
        }, event);

        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'rejected'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: Object.keys(helpers.getApplicationFields(event)),
                filter: { status: 'accepted', confirmed: true }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
    });

    test('should work with all the fields the filter supports', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted',
            confirmed: true,
            participant_type: 'envoy',
            participant_order: 1
        }, event);

        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted',
            confirmed: true,
            participant_type: 'visitor',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: Object.keys(helpers.getApplicationFields(event)),
                filter: {
                    status: 'accepted',
                    cancelled: false,
                    confirmed: true,
                    incoming: false,
                    participant_type: 'envoy'
                }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1);

        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
    });

    test('should return 400 if the filter has a field other than the supported ones', async () => {
        const otherEvent = await generator.createEvent({ applications: [] });
        await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id
        }, otherEvent);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: Object.keys(helpers.getApplicationFields(event)),
                filter: { event_id: otherEvent.id }
            }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(/^Filtering by this field is not supported\./);
        expect(body.message).not.toMatch(/event_id/);
    });

    test('should return 400 if a filter value is not a plain value or a list of them', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all?filter[status][accepted]=true',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(/status/);
    });

    test.each([
        ['an unknown status', 'filter[status]=unknown', 'status'],
        ['an empty status', 'filter[status]=', 'status'],
        ['a flag that is not a boolean', 'filter[confirmed]=maybe', 'confirmed'],
        ['an unknown participant type', 'filter[participant_type]=chair', 'participant_type']
    ])('should return 400 if the filter has %s', async (name, query, field) => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all?' + query,
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: { select: Object.keys(helpers.getApplicationFields(event)) }
        });

        expect(res.statusCode).toEqual(400);

        const body = JSON.parse(res.body.toString());
        expect(body.success).toEqual(false);
        expect(body.message).toMatch(new RegExp(field));
    });

    test('should ignore the passed filter on /incoming', async () => {
        const otherEvent = await generator.createEvent({ applications: [] });
        await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            status: 'accepted'
        }, otherEvent);

        const application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string'],
            status: 'accepted'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/incoming',
            method: 'GET',
            responseType: 'buffer', // make response body to Buffer.
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' },
            query: {
                select: ['id', 'statutory_id'],
                filter: { event_id: otherEvent.id }
            }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        const sheet = data[0].data;
        expect(sheet.length).toEqual(2); // headers + 1 application
        expect(sheet[1][0]).toEqual(application.id);
    });

    // BUG: one column asked for as "select=id" is read as a word, not as a list of one, and
    // the export is refused with a message about filters. Only "select[]=id" works for one
    // column, while two columns work either way. Expected: 200 with the column.
    test('should return 400 for one column that is not written as a list', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/all',
            method: 'GET',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla' },
            query: { select: 'id' }
        });

        expect(res.statusCode).toEqual(400);
        expect(JSON.parse(res.body.toString())).toEqual({
            success: false,
            message: 'Filters are not provided or are invalid.'
        });
    });

    describe('who may export', () => {
        test.each([
            ['all', 'global:manage_applications:agora', 200],
            ['all', 'global:manage_incoming:agora', 403],
            ['all', 'global:manage_juridical:agora', 403],
            ['all', 'global:update_memberslist_status:agora', 403],
            ['all', 'global:manage_applications:epm', 403],
            ['incoming', 'global:manage_applications:agora', 200],
            ['incoming', 'global:manage_incoming:agora', 200],
            ['incoming', 'global:manage_juridical:agora', 403],
            ['incoming', 'global:update_memberslist_status:agora', 403],
            ['incoming', 'global:approve_members:agora', 403],
            ['incoming', 'global:manage_incoming:epm', 403],
            ['incoming', 'global:manage_applications:epm', 403]
        ])('/export/%s: %s alone answers %i on an Agora', async (prefix, permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const agora = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ user_id: 2, status: 'accepted', first_name: 'Anna' }, agora);

            const res = await request({
                path: '/events/' + agora.id + '/applications/export/' + prefix,
                method: 'GET',
                responseType: 'buffer',
                headers: { 'X-Auth-Token': 'blablabla' },
                query: { 'select[]': ['first_name'] }
            });

            expect(res.statusCode).toEqual(status);

            if (status === 200) {
                expect(res.headers['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                expect(res.headers['content-disposition']).toMatch(/^attachment; filename=participants_\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\.xlsx$/);
                expect(xlsx.parse(res.body)[0].data).toEqual([['First name'], ['Anna']]);
            } else {
                // No participant in the refusal.
                const body = JSON.parse(res.body.toString());
                expect(body.success).toEqual(false);
                expect(body).not.toHaveProperty('data');
            }
        });
    });

    describe('the export of the local organisers', () => {
        let agora;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_incoming:agora'] } });

            agora = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const exportIncoming = (select) => request({
            path: '/events/' + agora.id + '/applications/export/incoming',
            method: 'GET',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla' },
            query: { 'select[]': select }
        });

        test('should keep only the columns of their list, in the order they were asked for', async () => {
            const application = await generator.createApplication({
                user_id: 2,
                status: 'accepted',
                first_name: 'Anna',
                visa_passport_number: 'AB1234567'
            }, agora);

            const res = await exportIncoming([
                'board_comment',
                'visa_passport_number',
                'notification_email',
                'nationality',
                'first_name',
                'status',
                'answers.0',
                'gender',
                'id'
            ]);

            expect(res.statusCode).toEqual(200);
            expect(xlsx.parse(res.body)[0].data).toEqual([
                ['Visa: passport number', 'First name', 'ID'],
                ['AB1234567', 'Anna', application.id]
            ]);
        });

        test('should export no columns when none of the asked ones is on their list', async () => {
            await generator.createApplication({ user_id: 2, status: 'accepted' }, agora);

            const res = await exportIncoming(['board_comment', 'notification_email', 'nationality', 'answers.0']);

            expect(res.statusCode).toEqual(200);

            const cells = xlsx.parse(res.body)[0].data.flat();
            expect(cells).toEqual([]);
        });

        test('should export only the accepted applications that are not cancelled', async () => {
            const accepted = await generator.createApplication({ user_id: 2, status: 'accepted' }, agora);
            await generator.createApplication({ user_id: 3, status: 'pending' }, agora);
            await generator.createApplication({ user_id: 4, status: 'rejected' }, agora);
            await generator.createApplication({ user_id: 5, status: 'waiting_list' }, agora);
            await generator.createApplication({ user_id: 6, status: 'accepted', cancelled: true }, agora);

            const res = await exportIncoming(['id']);

            expect(res.statusCode).toEqual(200);
            expect(xlsx.parse(res.body)[0].data).toEqual([['ID'], [accepted.id]]);
        });
    });
});
