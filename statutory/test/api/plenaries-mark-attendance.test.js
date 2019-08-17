const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Attendance } = require('../../models');

describe('Plenary attendance marking', () => {
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

    test('should fail if not Agora', async () => {
        const event = await generator.createEvent({ type: 'epm', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary is not found', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/1337/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary_id is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/NaN/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if application is not found', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if applicant is not a delegate', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'visitor',
            participant_order: 1
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if it\'s too late', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({
            starts: moment().subtract(2, 'days').toDate(),
            ends: moment().subtract(1, 'days').toDate()
        }, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed and create new plenary attendance if there is none', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(1);
        expect(res.body.data.id).toEqual(attendanceFromDb[0].id);
        expect(attendanceFromDb[0].ends).toEqual(null);
    });

    test('should succeed and create new plenary attendance if there are some', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);
        await generator.createAttendance({
            plenary_id: plenary.id,
            application_id: application.id,
        });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(2);
    });

    test('should succeed and update existing attendance if it exists', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);
        await generator.createAttendance({
            plenary_id: plenary.id,
            application_id: application.id,
            starts: moment().subtract(1, 'hour').toDate(),
            ends: null
        });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(1);
        expect(res.body.data.id).toEqual(attendanceFromDb[0].id);
        expect(attendanceFromDb[0].ends).not.toEqual(null);
    });

    test('should fail if ends < starts', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);
        await generator.createAttendance({
            plenary_id: plenary.id,
            application_id: application.id,
            starts: moment().add(1, 'hour').toDate(),
            ends: null
        });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.id }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should find application by statutory_id', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const application = await generator.createApplication({
            participant_type: 'delegate',
            participant_order: 1
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { application_id: application.statutory_id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const attendanceFromDb = await Attendance.findAll({
            where: {
                application_id: application.id,
                plenary_id: plenary.id
            }
        });
        expect(attendanceFromDb.length).toEqual(1);
        expect(res.body.data.id).toEqual(attendanceFromDb[0].id);
        expect(attendanceFromDb[0].ends).toEqual(null);
    });
});
