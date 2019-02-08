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
        expect(res.body.data.by_body.find(t => t.type === 1).value).toEqual(1);
        expect(res.body.data.by_body.find(t => t.type === 2).value).toEqual(2);
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

    test('should work in a proper way by gender', async () => {
        await generator.createApplication({ user_id: 1, gender: 'male' }, event);
        await generator.createApplication({ user_id: 2, gender: 'male' }, event);
        await generator.createApplication({ user_id: 3, gender: 'female' }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_gender).length).toEqual(2);
        expect(res.body.data.by_gender.find(t => t.type === 'male').value).toEqual(2);
        expect(res.body.data.by_gender.find(t => t.type === 'female').value).toEqual(1);
    });

    test('should work in a proper way by number of events visited', async () => {
        await generator.createApplication({ user_id: 1, number_of_events_visited: 0 }, event);
        await generator.createApplication({ user_id: 2, number_of_events_visited: 0 }, event);
        await generator.createApplication({ user_id: 3, number_of_events_visited: 1 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(Object.keys(res.body.data.by_number_of_events_visited).length).toEqual(2);
        expect(res.body.data.by_number_of_events_visited.find(t => t.type === 0).value).toEqual(2);
        expect(res.body.data.by_number_of_events_visited.find(t => t.type === 1).value).toEqual(1);
    });

    test('should calculate numbers properly', async () => {
        await generator.createApplication({ user_id: 1, status: 'pending' }, event);
        await generator.createApplication({ user_id: 2, status: 'rejected' }, event);
        await generator.createApplication({ user_id: 3, status: 'accepted' }, event);
        await generator.createApplication({ user_id: 4, status: 'accepted', paid_fee: true }, event);
        await generator.createApplication({ user_id: 5, status: 'accepted', paid_fee: true, attended: true }, event);
        await generator.createApplication({ user_id: 6, status: 'accepted', paid_fee: true, attended: true, registered: true }, event);
        await generator.createApplication({ user_id: 7, status: 'accepted', paid_fee: true, attended: true, registered: true, departed: true }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.numbers.total).toEqual(7);
        expect(res.body.data.numbers.rejected).toEqual(1);
        expect(res.body.data.numbers.pending).toEqual(1);
        expect(res.body.data.numbers.accepted).toEqual(5);
        expect(res.body.data.numbers.paid_fee).toEqual(4);
        expect(res.body.data.numbers.attended).toEqual(3);
        expect(res.body.data.numbers.registered).toEqual(2);
        expect(res.body.data.numbers.departed).toEqual(1);
    });
});
