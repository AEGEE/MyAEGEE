const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Plenaries displaying', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if not Agora', async () => {
        const event = await generator.createEvent({ type: 'epm', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary is not found', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if plenary_id is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/NaN',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should list all of the plenaries for this event', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.id).toEqual(plenary.id);
    });

    test('should sort attendances', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const firstApplication = await generator.createApplication({}, event);
        const secondApplication = await generator.createApplication({}, event);
        const plenary = await generator.createPlenary({}, event);

        const firstAttendance = await generator.createAttendance({ starts: moment().add(1, 'day').toDate(), application_id: firstApplication.id }, plenary);
        const secondAttendance = await generator.createAttendance({ starts: moment().add(2, 'day').toDate(), application_id: firstApplication.id }, plenary);
        const fourthAttendance = await generator.createAttendance({ starts: moment().add(4, 'day').toDate(), application_id: secondApplication.id }, plenary);
        const thirdAttendance = await generator.createAttendance({ starts: moment().add(3, 'day').toDate(), application_id: secondApplication.id }, plenary);

        const res = await request({
            uri: '/events/' + event.id + '/plenaries/' + plenary.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.id).toEqual(plenary.id);
        expect(res.body.data.attendances.length).toEqual(4);
        expect(res.body.data.attendances[0].id).toEqual(fourthAttendance.id);
        expect(res.body.data.attendances[1].id).toEqual(thirdAttendance.id);
        expect(res.body.data.attendances[2].id).toEqual(secondAttendance.id);
        expect(res.body.data.attendances[3].id).toEqual(firstAttendance.id);
    });
});
