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
});
