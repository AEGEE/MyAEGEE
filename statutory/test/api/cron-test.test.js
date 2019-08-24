const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position, Attendance } = require('../../models');
const cron = require('../../lib/cron');

const sleep = delay => new Promise(res => setTimeout(res, delay));

describe('Cron testing', () => {
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
        cron.clearAll();
    });

    test('should not clear the events that don\'t match the params', async () => {
        cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
        expect(cron.jobs.length).toEqual(1);

        cron.clearJobs(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, { id: 1338 });
        expect(cron.jobs.length).toEqual(1);
    });

    test('should throw if trying to cancel nonexistant job', async () => {
        cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
        expect(cron.jobs.length).toEqual(1);

        cron.cancelJobByIndex(1);
        expect(cron.jobs.length).toEqual(1);
    });

    test('should throw if trying to execute nonexistant job', async () => {
        cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
        expect(cron.jobs.length).toEqual(1);

        await cron.executeJob(cron.jobs[0].id + 1);
        expect(cron.jobs.length).toEqual(1);
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

            expect(cron.jobs.length).toEqual(2);
            expect(cron.jobs[0].params.id).toEqual(position.id);
            expect(cron.jobs[1].params.id).toEqual(position.id);
            expect(cron.jobs.map(job => job.key)).toContain(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            expect(cron.jobs.map(job => job.key)).toContain(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
        });

        test('should set the close deadline for plenaries on cron.registerAll()', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            cron.clearAll(); // to clear all of them
            await cron.registerAllDeadlines();

            expect(cron.jobs.length).toEqual(1);
            expect(cron.jobs[0].params.id).toEqual(plenary.id);
            expect(cron.jobs[0].key).toEqual(cron.JOB_TYPES.CLOSE_ATTENDANCES.key);
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

            expect(cron.jobs.length).toEqual(0);

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

            expect(cron.jobs.length).toEqual(2);
            expect(cron.jobs[0].params.id).toEqual(res.body.data.id);
            expect(cron.jobs[1].params.id).toEqual(res.body.data.id);
            expect(cron.jobs.map(job => job.key)).toContain(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            expect(cron.jobs.map(job => job.key)).toContain(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
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

            expect(cron.jobs.length).toEqual(1);
            expect(cron.jobs[0].params.id).toEqual(res.body.data.id);
            expect(cron.jobs[0].key).toEqual(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
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

            expect(cron.jobs.length).toEqual(0);
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

            expect(cron.jobs.length).toEqual(2); // opening, closing

            await sleep(4000);

            const positionFromDb = await Position.findByPk(res.body.data.id);
            expect(positionFromDb.status).toEqual('open');
            expect(cron.jobs.length).toEqual(1); // closing
        });

        test('should execute the application closing', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'second').toDate(),
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

            expect(cron.jobs.length).toEqual(1); // closing

            await sleep(4000);

            const positionFromDb = await Position.findByPk(res.body.data.id);
            expect(positionFromDb.status).toEqual('open'); // because no one applied
            expect(cron.jobs.length).toEqual(0);
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

            expect(cron.jobs.length).toEqual(2);
            expect(cron.jobs[0].params.id).toEqual(res.body.data.id);
            expect(cron.jobs[1].params.id).toEqual(res.body.data.id);
            expect(cron.jobs.map(job => job.key)).toContain(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            expect(cron.jobs.map(job => job.key)).toContain(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
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

            expect(cron.jobs.length).toEqual(1);
            expect(cron.jobs[0].params.id).toEqual(res.body.data.id);
            expect(cron.jobs[0].key).toEqual(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
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

            expect(cron.jobs.length).toEqual(0);
        });
    });

    describe('executing open deadlines', () => {
        test('should not open the deadline for non-existant position', async () => {
            await cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
            expect(cron.jobs.length).toEqual(1);

            await cron.executeJob(cron.jobs[0].id);
            expect(cron.jobs.length).toEqual(0);
        });

        test('should not open the deadline if it\'s opened already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate(),
            }, event);
            expect(cron.jobs.length).toEqual(1); // closing deadline

            await cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: position.id });
            expect(cron.jobs.length).toEqual(2);

            const job = cron.jobs.find(j => j.key === cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            await cron.executeJob(job.id);
            expect(cron.jobs.length).toEqual(1); // closing deadline
        });

        test('should open the deadline if everything\'s okay', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
            }, event);
            expect(cron.jobs.length).toEqual(2); // opening and closing deadline

            const job = cron.jobs.find(j => j.key === cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            await cron.executeJob(job.id);
            expect(cron.jobs.length).toEqual(1); // closing deadline
        });
    });

    describe('executing close deadlines', () => {
        test('should not close the deadline for non-existant position', async () => {
            await cron.addJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
            expect(cron.jobs.length).toEqual(1);

            await cron.executeJob(cron.jobs[0].id);
            expect(cron.jobs.length).toEqual(0);
        });

        test('should not close the deadline if it\'s closed already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1
            }, event);
            cron.clearAll();

            expect(cron.jobs.length).toEqual(0);

            await cron.addJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: position.id });
            expect(cron.jobs.length).toEqual(1);

            const job = cron.jobs.find(j => j.key === cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
            await cron.executeJob(job.id);
            expect(cron.jobs.length).toEqual(0);
        });

        test('should not close the deadline if not enough candidates', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1,
                candidates: []
            }, event);
            expect(cron.jobs.length).toEqual(1); // closing deadline

            const job = cron.jobs.find(j => j.key === cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
            await cron.executeJob(job.id); // won't close it, too few people
            expect(cron.jobs.length).toEqual(0);

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
            expect(cron.jobs.length).toEqual(1); // closing deadline

            const job = cron.jobs.find(j => j.key === cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
            await cron.executeJob(job.id);
            expect(cron.jobs.length).toEqual(0);

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.status).toEqual('closed');
        });
    });

    describe('executing close attendance deadlines', () => {
        test('should not close the attendances for non-existant plenary', async () => {
            await cron.addJob(cron.JOB_TYPES.CLOSE_ATTENDANCES, moment().add(1, 'week').toDate(), { id: 1337 });
            expect(cron.jobs.length).toEqual(1);

            await cron.executeJob(cron.jobs[0].id);
            expect(cron.jobs.length).toEqual(0);
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

            await cron.addJob(cron.JOB_TYPES.CLOSE_ATTENDANCES, moment().add(1, 'week').toDate(), { id: plenary.id });
            expect(cron.jobs.length).toEqual(1);

            await cron.executeJob(cron.jobs[0].id);

            const attendanceFromDb = await Attendance.findByPk(attendance.id);
            expect(attendanceFromDb.ends).not.toEqual(null);
        });

        test('should register close attendances deadline on creating plenary', async () => {
            cron.clearAll();

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            expect(cron.jobs.length).toEqual(1);
            expect(cron.jobs[0].params.id).toEqual(plenary.id);
        });

        test('should register close attendances deadline on editing plenary', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            cron.clearAll();
            await plenary.update({ ends: moment().add(2, 'weeks').toDate() });

            expect(cron.jobs.length).toEqual(1);
            expect(cron.jobs[0].params.id).toEqual(plenary.id);
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

            expect(cron.jobs.length).toEqual(1);

            await sleep(4000);

            const attendanceFromDb = await Attendance.findByPk(attendance.id);
            expect(attendanceFromDb.ends).not.toEqual(null);
        });
    });
});
