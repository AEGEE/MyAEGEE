const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

// Before the statuses are revealed, the statistics count every application as pending for
// the members, and give the real statuses to those who manage the applications.
describe('Application statistics before the statuses are revealed', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createApplication({ status: 'accepted' }, event);
        tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'day').toDate());
    });

    afterEach(async () => {
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    const numbers = async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/stats',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        return res.body.data.numbers;
    };

    test('those who manage applications get the statuses', async () => {
        mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });

        expect(await numbers()).toMatchObject({ accepted: 1, pending: 0 });
    });

    test('a member gets every application as pending', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        expect(await numbers()).toMatchObject({ accepted: 0, pending: 1 });
    });
});
