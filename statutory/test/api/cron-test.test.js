const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position, Attendance } = require('../../models');
const cron = require('../../lib/cron');

const sleep = delay => new Promise(res => setTimeout(res, delay));

describe('Cron testing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
        cron.clearAll();
    });

    describe('on system start', () => {
        test('should set the open and close deadline for positions on cron.registerAll()', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
            }, event);

            cron.clearAll(); // to clear all of them
            await cron.registerAllDeadlines();

            expect(cron.getJobs().length).toEqual(2);
            expect(cron.getJobs()[0].objectId).toEqual(position.id);
            expect(cron.getJobs()[1].objectId).toEqual(position.id);
            expect(cron.getJobs().map(job => job.action)).toContain('open');
            expect(cron.getJobs().map(job => job.action)).toContain('close');
        });

        test('should set the close deadline for plenaries on cron.registerAll()', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            cron.clearAll(); // to clear all of them
            await cron.registerAllDeadlines();

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(plenary.id);
            expect(cron.getJobs().map(job => job.action)).toContain('close');
        });

        test('should close all attendances on cron.registerAll()', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({}, event);
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().subtract(1, 'week').toDate()
            }, event);
            const attendance = await generator.createAttendance({
                application_id: application.id
            }, plenary);

            cron.clearAll(); // to clear all of them
            await cron.registerAllDeadlines();

            expect(cron.getJobs().length).toEqual(0);

            const attendanceFromDb = await Attendance.findByPk(attendance.id);
            expect(attendanceFromDb.ends).not.toEqual(null);
        });
    });

    describe('for positions creation', () => {
        test('should set the open and close deadline if start and end are in the future', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
            });

            const res = await request({
                uri: '/events/' + event.id + '/positions/',
                method: 'POST',
                body: position,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(2);
            expect(cron.getJobs()[0].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs()[1].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs().map(job => job.action)).toContain('open');
            expect(cron.getJobs().map(job => job.action)).toContain('close');
        });

        test('should set the close deadline if the applications started but not ended', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate(),
            });

            const res = await request({
                uri: '/events/' + event.id + '/positions/',
                method: 'POST',
                body: position,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs()[0].action).toContain('close');
        });

        test('should set the close deadline if the applications started is not set', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                ends: moment().add(1, 'week').toDate(),
            });

            delete position.starts;

            const res = await request({
                uri: '/events/' + event.id + '/positions/',
                method: 'POST',
                body: position,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs()[0].action).toContain('close');
        });

        test('should not set the deadlines if the candidating is in the past', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().subtract(1, 'week').toDate(),
            });

            const res = await request({
                uri: '/events/' + event.id + '/positions/',
                method: 'POST',
                body: position,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(0);
        });

        test('should execute the application opening', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().add(3, 'second').toDate(),
                ends: moment().add(1, 'week').toDate(),
            });

            const res = await request({
                uri: '/events/' + event.id + '/positions/',
                method: 'POST',
                body: position,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.status).toEqual('closed');

            expect(cron.getJobs().length).toEqual(2); // opening, closing

            await sleep(4000);

            const positionFromDb = await Position.findByPk(res.body.data.id);
            expect(positionFromDb.status).toEqual('open');
            expect(cron.getJobs().length).toEqual(1); // closing
        });

        test('should execute the application closing', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(3, 'second').toDate(),
            });

            const res = await request({
                uri: '/events/' + event.id + '/positions/',
                method: 'POST',
                body: position,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.status).toEqual('open');

            expect(cron.getJobs().length).toEqual(1); // closing

            await sleep(4000);

            const positionFromDb = await Position.findByPk(res.body.data.id);
            expect(positionFromDb.status).toEqual('open'); // because no one applied
            expect(cron.getJobs().length).toEqual(0);
        });
    });

    describe('for position edition', () => {
        test('should set the open and close deadline if start and end are in the future', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({}, event);

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id,
                method: 'PUT',
                body: {
                    starts: moment().add(1, 'week').toDate(),
                    ends: moment().add(2, 'week').toDate(),
                },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(2);
            expect(cron.getJobs()[0].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs()[1].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs().map(job => job.action)).toContain('open');
            expect(cron.getJobs().map(job => job.action)).toContain('close');
        });

        test('should set the close deadline if the applications started but not ended', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({}, event);

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id,
                method: 'PUT',
                body: {
                    starts: moment().subtract(1, 'week').toDate(),
                    ends: moment().add(1, 'week').toDate(),
                },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs()[0].action).toContain('close');
        });

        test('should set the close deadline if the applications started is not set', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({}, event);

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id,
                method: 'PUT',
                body: {
                    ends: moment().add(1, 'week').toDate(),
                    starts: null
                },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(res.body.data.id);
            expect(cron.getJobs()[0].action).toContain('close');
        });

        test('should not set the deadlines if the candidating is in the past', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({}, event);

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id,
                method: 'PUT',
                body: {
                    starts: moment().subtract(2, 'week').toDate(),
                    ends: moment().subtract(1, 'week').toDate(),
                },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(cron.getJobs().length).toEqual(0);
        });
    });

    describe('executing open deadlines', () => {
        test('should not open the deadline for non-existant position', async () => {
            await cron.registerOpenApplicationDeadline(moment().add(1, 'week').toDate(), 1337);
            expect(cron.getJobs().length).toEqual(1);

            await cron.openApplications(1337);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should not open the deadline if it\'s opened already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate(),
            }, event);
            expect(cron.getJobs().length).toEqual(1); // closing deadline

            await cron.registerOpenApplicationDeadline(moment().add(1, 'week').toDate(), position.id);
            expect(cron.getJobs().length).toEqual(2);

            await cron.openApplications(position.id);
            expect(cron.getJobs().length).toEqual(1); // closing deadline
        });

        test('should open the deadline if everything\'s okay', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
            }, event);
            expect(cron.getJobs().length).toEqual(2); // closing deadline

            await cron.openApplications(position.id);
            expect(cron.getJobs().length).toEqual(1); // closing deadline
        });
    });

    describe('executing close deadlines', () => {
        test('should not close the deadline for non-existant position', async () => {
            await cron.registerCloseApplicationDeadline(moment().add(1, 'week').toDate(), 1337);
            expect(cron.getJobs().length).toEqual(1);

            await cron.closeApplications(1337);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should not close the deadline if it\'s closed already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1
            }, event);
            cron.clearAll();

            expect(cron.getJobs().length).toEqual(0);

            await cron.registerCloseApplicationDeadline(moment().add(1, 'week').toDate(), position.id);
            expect(cron.getJobs().length).toEqual(1);

            await cron.closeApplications(position.id);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should not close the deadline if not enough candidates', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1,
                candidates: []
            }, event);
            expect(cron.getJobs().length).toEqual(1); // closing deadline

            await cron.closeApplications(position.id); // won't close it, too few people
            expect(cron.getJobs().length).toEqual(0);

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.status).toEqual('open');
        });

        test('should close the deadline if everything\'s okay', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1,
                candidates: [
                    generator.generateCandidate({ user_id: 1, status: 'approved' }),
                    generator.generateCandidate({ user_id: 2, status: 'approved' }), // so it would properly close
                ]
            }, event);
            expect(cron.getJobs().length).toEqual(1); // closing deadline

            await cron.closeApplications(position.id);
            expect(cron.getJobs().length).toEqual(0);

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.status).toEqual('closed');
        });
    });

    describe('executing close attendance deadlines', () => {
        test('should not close the attendances for non-existant plenary', async () => {
            await cron.registerCloseAttendancesDeadline(moment().add(1, 'week').toDate(), 1337);
            expect(cron.getJobs().length).toEqual(1);

            await cron.closeAttendances(1337);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should not register the closing attendances schedule if the ends date has passed', async () => {
            await cron.registerCloseAttendancesDeadline(moment().subtract(1, 'week').toDate(), 1337);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should close attendances if everything\'s okay', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({}, event);
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().subtract(1, 'week').toDate()
            }, event);
            const attendance = await generator.createAttendance({
                application_id: application.id
            }, plenary);

            await cron.registerCloseAttendancesDeadline(moment().add(1, 'week').toDate(), plenary.id);
            await cron.closeAttendances(plenary.id);

            const attendanceFromDb = await Attendance.findByPk(attendance.id);
            expect(attendanceFromDb.ends).not.toEqual(null);
        });

        test('should register close attendances deadline on creating plenary', async () => {
            await cron.clearAll();

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(plenary.id);
        });

        test('should register close attendances deadline on editing plenary', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            await cron.clearAll();
            await plenary.update({ ends: moment().add(2, 'weeks').toDate() });

            expect(cron.getJobs().length).toEqual(1);
            expect(cron.getJobs()[0].objectId).toEqual(plenary.id);
        });

        test('should execute the attendance closing', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({}, event);
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'second').toDate()
            }, event);
            const attendance = await generator.createAttendance({
                application_id: application.id
            }, plenary);

            expect(cron.getJobs().length).toEqual(1);

            await sleep(4000);

            const attendanceFromDb = await Attendance.findByPk(attendance.id);
            expect(attendanceFromDb.ends).not.toEqual(null);
        });
    });
});
