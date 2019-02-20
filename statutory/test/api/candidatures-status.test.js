const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;
const { Position } = require('../../models');

describe('Candidates status', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id + '/status',
            method: 'PUT',
            body: { status: 'approved' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if status is malformed', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id + '/status',
            method: 'PUT',
            body: { status: false },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 200 if yes permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id + '/status',
            method: 'PUT',
            body: { status: 'approved' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should not close deadline if enough approved applicants but application period is opened still', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            places: 1,
            candidates: [
                generator.generateCandidate({ user_id: 1, status: 'approved' }),
                generator.generateCandidate({ user_id: 2, status: 'pending' })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[1].id + '/status',
            method: 'PUT',
            body: { status: 'approved' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const positionFromDb = await Position.findByPk(position.id);
        expect(positionFromDb.status).toEqual('open');
    });

    test('should close deadline if enough approved applicants', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            places: 1,
            candidates: [
                generator.generateCandidate({ user_id: 1, status: 'approved' }),
                generator.generateCandidate({ user_id: 2, status: 'pending' })
            ]
        }, event);

        tk.travel(moment(event.application_period_starts).add(2, 'week').toDate());

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[1].id + '/status',
            method: 'PUT',
            body: { status: 'approved' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const positionFromDb = await Position.findByPk(position.id);
        expect(positionFromDb.status).toEqual('closed');
    });
});
