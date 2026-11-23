const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid.json').data;
const callers = require('../scripts/callers');

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

    test('should export one row per application for an organizer without permissions', async () => {
        callers.asMember();
        const event = await generator.createEvent({
            organizers: [callers.organizer(callers.member)],
            questions: [
                { type: 'checkbox', description: 'Vegan?', required: false },
                { type: 'string', description: 'Why?', required: true }
            ]
        });
        await generator.createApplication(event, {
            user_id: regularUser.id,
            body_id: 34,
            body_name: 'AEGEE-Example',
            status: 'accepted',
            answers: [true, 'Because']
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/export',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-disposition']).toEqual('attachment; filename=stats.xlsx');

        const [header, row] = xlsx.parse(res.body)[0].data;
        expect(header).toContain('Answer 1: Vegan?');
        expect(header).toContain('Answer 2: Why?');
        const cell = (name) => row[header.indexOf(name)];
        expect(cell('User ID')).toEqual(regularUser.id);
        expect(cell('Body name')).toEqual('AEGEE-Example');
        expect(cell('Email')).toEqual(regularUser.notification_email);
        expect(cell('Status')).toEqual('accepted');
        expect(cell('Confirmed')).toEqual('No');
        expect(cell('Answer 1: Vegan?')).toEqual('Yes');
        expect(cell('Answer 2: Why?')).toEqual('Because');
    });

    test('should return 500 if core cannot give an applicant', async () => {
        mock.mockAll({ member: { unsuccessfulResponse: true } });
        const event = await generator.createEvent({ questions: [] });
        await generator.createApplication(event, { answers: [] });

        const res = await request({
            path: '/single/' + event.id + '/applications/export',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
    });

    test('should return nothing if no applications', async () => {
        const event = await generator.createEvent({
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'string', description: 'test', required: true }
            ]
        });
        const res = await request({
            path: '/single/' + event.id + '/applications/export',
            method: 'GET',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(200);

        const data = xlsx.parse(res.body);
        expect(data.length).toEqual(1); // at least 1 sheet

        const sheet = data[0].data;
        expect(sheet.length).toEqual(1); // 1 string in sheet
    });

    test('should return a header row and one row per application', async () => {
        const event = await generator.createEvent({
            questions: [
                { type: 'checkbox', description: 'test', required: true },
                { type: 'checkbox', description: 'test', required: false },
                { type: 'string', description: 'test', required: true }
            ]
        });

        await generator.createApplication(event, {
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, false, 'string']
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/export',
            method: 'GET',
            responseType: 'buffer',
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

        await generator.createApplication(event, {
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            answers: [true, 'string']
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/export',
            method: 'GET',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla', 'Content-Type': 'application/json' }
        });

        expect(res.statusCode).toEqual(403);
    });
});
