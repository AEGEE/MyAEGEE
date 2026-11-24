const http = require('http');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');
const regularUser = require('../assets/core-valid.json').data;
const { MembersList } = require('../../models');

const UNAVAILABLE = {
    success: false,
    message: 'The currency rates could not be fetched, so nothing was saved. Please try again later.'
};

// A members list takes its conversion rate from the European Commission's server. That
// server is asked before anything is saved, and given up on after conversion_rate_api.timeout:
// a slow server does not hold database connections that other requests need.
describe('Currency rates server that does not answer', () => {
    let silentServer;
    const originalRates = { ...config.conversion_rate_api };

    beforeAll(async () => {
        await startServer();

        // Accepts the connection and never answers.
        silentServer = http.createServer(() => {});
        await new Promise((resolve) => {
            silentServer.listen(0, '127.0.0.1', resolve);
        });
    });

    afterAll(async () => {
        silentServer.closeAllConnections();
        await new Promise((resolve) => {
            silentServer.close(resolve);
        });
        await stopServer();
    });

    beforeEach(() => {
        mock.mockAll();
        Object.assign(config.conversion_rate_api, { host: `http://127.0.0.1:${silentServer.address().port}`, timeout: 1000 });
    });

    afterEach(async () => {
        Object.assign(config.conversion_rate_api, originalRates);
        await generator.clearAll();
        mock.cleanAll();
    });

    const upload = (event, members = [generator.generateMembersListMember()]) => request({
        path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body: { currency: 'EU', members }
    });

    test('six uploads at once leave the other requests alone, and answer 503 with nothing saved', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const uploads = Promise.all(Array.from({ length: 6 }, () => upload(event)));

        // Another member opens the event while the uploads wait for the rates.
        await new Promise((resolve) => {
            setTimeout(resolve, 200);
        });
        const started = Date.now();
        const other = await request({ path: '/events/' + event.id, method: 'GET', headers: { 'X-Auth-Token': 'blablabla' } });
        expect(other.statusCode).toEqual(200);
        expect(Date.now() - started).toBeLessThan(700);

        const responses = await uploads;
        for (const res of responses) {
            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual(UNAVAILABLE);
        }
        expect(await MembersList.count()).toEqual(0);
    }, 20000);

    test('an edit of a members list answers 503 and keeps the stored list', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        Object.assign(config.conversion_rate_api, originalRates);
        const stored = await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        Object.assign(config.conversion_rate_api, { host: `http://127.0.0.1:${silentServer.address().port}`, timeout: 1000 });

        const res = await upload(event, [generator.generateMembersListMember({ first_name: 'Edited' })]);

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(UNAVAILABLE);
        expect((await MembersList.findByPk(stored.id)).members).toEqual(stored.members);
    }, 20000);

    test.each([
        ['a server error', { netError: true }],
        ['an answer that is no list of rates', { badResponse: true }]
    ])('the rates server that gives %s answers 503', async (description, conversion) => {
        Object.assign(config.conversion_rate_api, originalRates);
        mock.mockAll({ conversion });
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await upload(event);

        expect(res.statusCode).toEqual(503);
        expect(res.body).toEqual(UNAVAILABLE);
        expect(await MembersList.count()).toEqual(0);
    });

    test('a first members list without a currency answers 422 without asking for the rates', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { members: [generator.generateMembersListMember()] }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('currency');
        expect(await MembersList.count()).toEqual(0);
    });
});
