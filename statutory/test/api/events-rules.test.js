const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');

describe('Event rules', () => {
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
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    describe('the publication date', () => {
        const setStatus = (event, status) => request({
            path: '/events/' + event.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { status }
        });

        test('is the moment a draft is published, and stays when the event is published once more', async () => {
            const event = await generator.createEvent({ status: 'draft' });
            const published = new Date('2029-06-01T12:00:00.000Z');
            tk.freeze(published);
            expect((await setStatus(event, 'published')).statusCode).toEqual(200);

            tk.freeze(new Date('2029-06-03T12:00:00.000Z'));
            const res = await setStatus(event, 'published');

            expect(res.statusCode).toEqual(200);
            expect((await Event.findByPk(event.id)).publication_date).toEqual(published);
        });
    });

    describe('the search', () => {
        test.each(['50%', 'item_1', 'a\\b'])('of the event list finds %s as it is written', async (search) => {
            const found = await generator.createEvent({ name: `Find ${search} here`, description: 'other' });
            await generator.createEvent({ name: 'Find 500 or item11 or ab here', description: 'other' });

            const res = await request({
                path: '/',
                query: { search },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((event) => event.id)).toEqual([found.id]);
        });

        test.each(['50%', 'item_1', 'a\\b'])('of the application lists finds %s as it is written', async (search) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const found = await generator.createApplication({ first_name: `Find ${search} here` }, event);
            await generator.createApplication({ first_name: 'Find 500 or item11 or ab here' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                query: { query: search },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((application) => application.id)).toEqual([found.id]);
        });
    });
});
