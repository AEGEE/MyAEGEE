const http = require('http');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const config = require('../../config');
const core = require('../../lib/core');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

// A mailer or a core that does not answer in time is given up on: the mail fails like any
// other mailer error, which does not undo the saved change.
describe('Mailer that does not answer', () => {
    let silentMailer;
    const originalMailer = { ...config.mailer };

    beforeAll(async () => {
        await startServer();

        // Accepts the connection and never answers. (A delayed nock reply crashes the
        // process once the request was aborted.)
        silentMailer = http.createServer(() => {});
        await new Promise((resolve) => {
            silentMailer.listen(0, '127.0.0.1', resolve);
        });
    });

    afterAll(async () => {
        silentMailer.closeAllConnections();
        await new Promise((resolve) => {
            silentMailer.close(resolve);
        });
        await stopServer();
    });

    beforeEach(() => {
        mock.mockAll();
        Object.assign(config.mailer, { url: 'http://127.0.0.1', port: silentMailer.address().port, timeout: 200 });
    });

    afterEach(async () => {
        Object.assign(config.mailer, originalMailer);
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should save the application and answer once the mailer timed out', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });

        const started = Date.now();
        const res = await request({
            path: '/events/' + event.id + '/applications',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateApplication({ body_id: regularUser.bodies[0].id }, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(Date.now() - started).toBeLessThan(4000);
        expect(await Application.count()).toEqual(1);
    });

    test('should give up on core after core.timeout', async () => {
        const originalCore = { ...config.core };
        Object.assign(config.core, { url: 'http://127.0.0.1', port: silentMailer.address().port, timeout: 200 });

        const started = Date.now();
        try {
            await expect(core.getBodyUsersForPermission({ action: 'approve_members', object: 'agora' }, 1))
                .rejects.toThrow('The operation was aborted due to timeout');
        } finally {
            Object.assign(config.core, originalCore);
        }

        expect(Date.now() - started).toBeLessThan(4000);
    });
});
