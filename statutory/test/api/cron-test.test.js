const moment = require('moment')

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position } = require('../../models');
const cron = require('../../lib/cron');

const sleep = (delay) => new Promise(res => setTimeout(res, delay));

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
            expect(positionFromDb.status).toEqual('closed');
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
            expect(cron.getJobs().length).toEqual(0);

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
            expect(cron.getJobs().length).toEqual(0);

            await cron.closeApplications(1337);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should not close the deadline if it\'s closed already', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(2, 'week').toDate(),
                ends: moment().subtract(1, 'week').toDate(),
            }, event);
            expect(cron.getJobs().length).toEqual(0);

            await cron.closeApplications(position.id);
            expect(cron.getJobs().length).toEqual(0);
        });

        test('should close the deadline if everything\'s okay', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(2, 'week').toDate(),
            }, event);
            expect(cron.getJobs().length).toEqual(1); // closing deadline

            await cron.closeApplications(position.id);
            expect(cron.getJobs().length).toEqual(0); // closing deadline
        });
    });
});
