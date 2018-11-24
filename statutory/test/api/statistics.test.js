const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Statistics testing', () => {
    let event;
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
        event = await generator.createEvent();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_date).length).toEqual(0);
        expect(Object.keys(res.body.data.by_date_cumulative).length).toEqual(0);
        expect(Object.keys(res.body.data.by_body).length).toEqual(0);
        expect(Object.keys(res.body.data.by_type).length).toEqual(0);
    });

    test('should return nothing if all applications are cancelled', async () => {
        await generator.createApplication({ cancelled: true }, event);
        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_date).length).toEqual(0);
        expect(Object.keys(res.body.data.by_date_cumulative).length).toEqual(0);
        expect(Object.keys(res.body.data.by_body).length).toEqual(0);
        expect(Object.keys(res.body.data.by_type).length).toEqual(0);
    });

    test('should work in a proper way by date', async () => {
        tk.travel(moment(event.application_period_starts).add(1, 'day').toDate());
        const firstPax = await generator.createApplication({ user_id: 1, participant_order: 1 }, event);

        tk.travel(moment(event.application_period_starts).add(2, 'days').toDate());
        const secondPax = await generator.createApplication({ user_id: 2, participant_order: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_date).length).toEqual(2);
        expect(res.body.data.by_date.find(d => d.date === moment(firstPax.created_at).format('YYYY-MM-DD')).value).toEqual(1);
        expect(res.body.data.by_date.find(d => d.date === moment(secondPax.created_at).format('YYYY-MM-DD')).value).toEqual(1);
    });

    test('should work in a proper way by date cumulative', async () => {
        tk.travel(moment(event.application_period_starts).add(1, 'day').toDate());
        const firstPax = await generator.createApplication({ user_id: 1, participant_order: 1 }, event);

        tk.travel(moment(event.application_period_starts).add(2, 'days').toDate());
        const secondPax = await generator.createApplication({ user_id: 2, participant_order: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_date_cumulative).length).toEqual(2);
        expect(res.body.data.by_date_cumulative.find(d => d.date === moment(firstPax.created_at).format('YYYY-MM-DD')).value).toEqual(1);
        expect(res.body.data.by_date_cumulative.find(d => d.date === moment(secondPax.created_at).format('YYYY-MM-DD')).value).toEqual(2);
    });

    test('should work in a proper way by body', async () => {
        await generator.createApplication({ user_id: 1, body_id: 1 }, event);
        await generator.createApplication({ user_id: 2, body_id: 2, participant_order: 1 }, event);
        await generator.createApplication({ user_id: 3, body_id: 2, participant_order: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_body).length).toEqual(2);
        expect(res.body.data.by_body.find(t => t.body_id === 1).value).toEqual(1);
        expect(res.body.data.by_body.find(t => t.body_id === 2).value).toEqual(2);
    });

    test('should work in a proper way by type', async () => {
        await generator.createApplication({ user_id: 1, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 2, participant_type: 'visitor', participant_order: 1 }, event);
        await generator.createApplication({ user_id: 3, participant_type: 'visitor', participant_order: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_type).length).toEqual(2);
        expect(res.body.data.by_type.find(t => t.type === null).value).toEqual(1);
        expect(res.body.data.by_type.find(t => t.type === 'visitor').value).toEqual(2);
    });
});
