const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');

describe('Events creation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should fail if user does not have rights to create events', async () => {
        mock.mockAll({ core: { regularUser: true } })
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const event = generator.generateEvent();

        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual(event.name);
        expect(res.body.data.description).toEqual(event.description);
        expect(res.body.data.fee).toEqual(event.fee);
        expect(res.body.data.type).toEqual(event.type);

        const eventFromDb = await Event.findOne({ where: { id: res.body.data.id } });

        expect(eventFromDb.name).toEqual(res.body.data.name);
        expect(eventFromDb.description).toEqual(res.body.data.description);
        expect(eventFromDb.fee).toEqual(res.body.data.fee);
        expect(eventFromDb.type).toEqual(res.body.data.type);

        for (const question of event.questions) {
            expect(eventFromDb.questions.find(q => question.name === q.name)).toBeTruthy();
        }
    });

    test('should fail if the dates are in the past', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().subtract(4, 'months').toDate(),
                application_period_ends: moment().subtract(3, 'months').toDate(),
                starts: moment().subtract(2, 'months').toDate(),
                ends: moment().subtract(1, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(4); // only these errors
        expect(res.body.errors).toHaveProperty('application_period_starts');
        expect(res.body.errors).toHaveProperty('application_period_ends');
        expect(res.body.errors).toHaveProperty('starts');
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if event ends before it starts', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                starts: moment().add(4, 'months').toDate(),
                ends: moment().add(3, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if event application period ends before it starts', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(2, 'months').toDate(),
                application_period_ends: moment().add(1, 'months').toDate(),
                starts: moment().add(3, 'months').toDate(),
                ends: moment().add(4, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('application_period_ends');
    });

    test('should fail if event starts before application period ends', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(3, 'months').toDate(),
                starts: moment().add(2, 'months').toDate(),
                ends: moment().add(4, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('application_period_ends');
    });

    test('should fail if no questions are set', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: []
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if questions are malformed', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: ['']
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });
});
