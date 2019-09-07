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
        expect(Object.keys(cron.jobs).length).toEqual(1);

        cron.clearJobs(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, { id: 1338 });
        expect(Object.keys(cron.jobs).length).toEqual(1);
    });

    test('should do nothing if trying to cancel nonexistant job', async () => {
        const id = cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
        expect(Object.keys(cron.jobs).length).toEqual(1);

        cron.cancelJob(id + 1);
        expect(Object.keys(cron.jobs).length).toEqual(1);
    });

    test('should do nothing if trying to execute nonexistant job', async () => {
        const id = cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
        expect(Object.keys(cron.jobs).length).toEqual(1);

        await cron.executeJob(id + 1);
        expect(Object.keys(cron.jobs).length).toEqual(1);
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

            expect(Object.keys(cron.jobs).length).toEqual(3);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(position.id);
            expect(Object.values(cron.jobs)[1].params.id).toEqual(position.id);
            expect(Object.values(cron.jobs)[2].params.id).toEqual(position.id);
            expect(Object.values(cron.jobs).map(job => job.key)).toContain(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            expect(Object.values(cron.jobs).map(job => job.key)).toContain(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
        });

        test('should set the close deadline for plenaries on cron.registerAll()', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            cron.clearAll(); // to clear all of them
            await cron.registerAllDeadlines();

            expect(Object.keys(cron.jobs).length).toEqual(1);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(plenary.id);
            expect(Object.values(cron.jobs)[0].key).toEqual(cron.JOB_TYPES.CLOSE_ATTENDANCES.key);
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

            expect(Object.keys(cron.jobs).length).toEqual(0);

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

            expect(Object.keys(cron.jobs).length).toEqual(3);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[1].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[2].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs).map(job => job.key)).toContain(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            expect(Object.values(cron.jobs).map(job => job.key)).toContain(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
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

            expect(Object.keys(cron.jobs).length).toEqual(2);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[1].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[0].key).toEqual(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
            expect(Object.values(cron.jobs)[1].key).toEqual(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
        });

        test('should not set the deadlines if the candidating is in the past', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().subtract(3, 'week').toDate(),
                ends: moment().subtract(2, 'week').toDate(),
                ends_force: moment().subtract(1, 'week').toDate(),
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

            expect(Object.keys(cron.jobs).length).toEqual(0);
        });

        test('should execute the application opening', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().add(3, 'second').toDate(),
                ends: moment().add(1, 'week').toDate(),
                ends_force: moment().add(2, 'week').toDate(),
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

            expect(Object.keys(cron.jobs).length).toEqual(3); // opening, closing, closing force

            await sleep(4000);

            const positionFromDb = await Position.findByPk(res.body.data.id);
            expect(positionFromDb.status).toEqual('open');
            expect(Object.keys(cron.jobs).length).toEqual(2); // closing, closing force
        });

        test('should execute the application closing', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = generator.generatePosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'second').toDate(),
                ends_force: moment().add(1, 'week').toDate(),
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

            expect(Object.keys(cron.jobs).length).toEqual(2); // closing, closing force

            await sleep(4000);

            const positionFromDb = await Position.findByPk(res.body.data.id);
            expect(positionFromDb.status).toEqual('open'); // because no one applied
            expect(Object.keys(cron.jobs).length).toEqual(1); // closing force
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
                    ends_force: moment().add(3, 'week').toDate(),
                },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(Object.keys(cron.jobs).length).toEqual(3);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[1].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[2].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs).map(job => job.key)).toContain(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            expect(Object.values(cron.jobs).map(job => job.key)).toContain(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
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

            expect(Object.keys(cron.jobs).length).toEqual(2);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[0].key).toEqual(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
            expect(Object.values(cron.jobs)[1].params.id).toEqual(res.body.data.id);
            expect(Object.values(cron.jobs)[1].key).toEqual(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key);
        });

        test('should not set the deadlines if the candidating is in the past', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({}, event);

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id,
                method: 'PUT',
                body: {
                    starts: moment().subtract(3, 'week').toDate(),
                    ends: moment().subtract(2, 'week').toDate(),
                    ends_force: moment().subtract(1, 'week').toDate(),
                },
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(Object.keys(cron.jobs).length).toEqual(0);
        });
    });

    describe('executing open deadlines', () => {
        test('should not open the deadline for non-existant position', async () => {
            const id = await cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
            expect(Object.keys(cron.jobs).length).toEqual(1);

            await cron.executeJob(id);
            expect(Object.keys(cron.jobs).length).toEqual(0);
        });

        test('should not open the deadline if it\'s opened already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate(),
            }, event);
            expect(Object.keys(cron.jobs).length).toEqual(2); // closing, closing force

            const id = await cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: position.id });
            expect(Object.keys(cron.jobs).length).toEqual(3); // opening, closing, closing force

            await cron.executeJob(id);
            expect(Object.keys(cron.jobs).length).toEqual(2); // closing, closing force deadline
        });

        test('should open the deadline if everything\'s okay', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
            }, event);
            expect(Object.keys(cron.jobs).length).toEqual(3); // opening, closing, closing force deadline

            const job = Object.values(cron.jobs).find(j => j.key === cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS.key);
            await cron.executeJob(job.id);
            expect(Object.keys(cron.jobs).length).toEqual(2); // closing, closing force deadline
        });
    });

    describe('executing close deadlines', () => {
        test('should not close the deadline for non-existant position', async () => {
            const id = await cron.addJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: 1337 });
            expect(Object.keys(cron.jobs).length).toEqual(1);

            await cron.executeJob(id);
            expect(Object.keys(cron.jobs).length).toEqual(0);
        });

        test('should not close the deadline if it\'s closed already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1
            }, event);
            cron.clearAll();

            expect(Object.keys(cron.jobs).length).toEqual(0);

            const id = await cron.addJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, moment().add(1, 'week').toDate(), { id: position.id });
            expect(Object.keys(cron.jobs).length).toEqual(1);

            await cron.executeJob(id);
            expect(Object.keys(cron.jobs).length).toEqual(0);
        });

        test('should not close the deadline if not enough candidates', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
                places: 1,
                candidates: []
            }, event);
            expect(Object.keys(cron.jobs).length).toEqual(2); // closing, closing force deadline

            const job = Object.values(cron.jobs).find(j => j.key === cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key && !j.params.force);
            await cron.executeJob(job.id); // won't close it, too few people
            expect(Object.keys(cron.jobs).length).toEqual(1); // force closing;

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
            expect(Object.keys(cron.jobs).length).toEqual(2); // closing + closing force deadline

            const job = Object.values(cron.jobs).find(j => j.key === cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS.key && !j.params.force);
            await cron.executeJob(job.id);
            expect(Object.keys(cron.jobs).length).toEqual(1);

            const positionFromDb = await Position.findByPk(position.id);
            expect(positionFromDb.status).toEqual('closed');
        });
    });

    describe('executing close attendance deadlines', () => {
        test('should not close the attendances for non-existant plenary', async () => {
            const id = await cron.addJob(cron.JOB_TYPES.CLOSE_ATTENDANCES, moment().add(1, 'week').toDate(), { id: 1337 });
            expect(Object.keys(cron.jobs).length).toEqual(1);

            await cron.executeJob(id);
            expect(Object.keys(cron.jobs).length).toEqual(0);
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

            const id = await cron.addJob(cron.JOB_TYPES.CLOSE_ATTENDANCES, moment().add(1, 'week').toDate(), { id: plenary.id });
            expect(Object.keys(cron.jobs).length).toEqual(1);

            await cron.executeJob(id);

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

            expect(Object.keys(cron.jobs).length).toEqual(1);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(plenary.id);
        });

        test('should register close attendances deadline on editing plenary', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const plenary = await generator.createPlenary({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);

            cron.clearAll();
            await plenary.update({ ends: moment().add(2, 'weeks').toDate() });

            expect(Object.keys(cron.jobs).length).toEqual(1);
            expect(Object.values(cron.jobs)[0].params.id).toEqual(plenary.id);
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

            expect(Object.keys(cron.jobs).length).toEqual(1);

            await sleep(4000);

            const attendanceFromDb = await Attendance.findByPk(attendance.id);
            expect(attendanceFromDb.ends).not.toEqual(null);
        });
    });
});
