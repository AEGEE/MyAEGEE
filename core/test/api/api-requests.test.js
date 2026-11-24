const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const logger = require('../../lib/logger');
const { Body } = require('../../models');

describe('API requests', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if endpoint is not found', async () => {
        const res = await request({
            path: '/not-existant',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the request is not JSON', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/bodies',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: 'garbage'
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('an error that the server did not expect', () => {
        const SERVER_ERROR = { success: false, message: 'Something went wrong on the server.' };

        test('should answer 500 without the text of the error, and log it', async () => {
            const error = new Error('relation "bodies" does not exist');
            jest.spyOn(Body, 'findAndCountAll').mockRejectedValue(error);
            const log = jest.spyOn(logger, 'error').mockImplementation(() => {});

            const res = await request({ path: '/bodies', method: 'GET' });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual(SERVER_ERROR);
            expect(log).toHaveBeenCalledWith({ err: error }, 'Request error');
        });

        test('should not pass on what the mailer answered', async () => {
            mock.mockAll({ mailer: { netError: true } });
            const campaign = await generator.createCampaign({ active: true });

            const res = await request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser()
            });

            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual({ success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' });
        });

        test('should not pass on what the mailing list server answered', async () => {
            mock.mockAll();
            const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            // Nothing answers at the address of the mailing list server.
            const res = await request({
                path: '/members/me/listserv',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { mailinglists: ['ANNOUNCE-L'] }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual(SERVER_ERROR);
            expect(log).toHaveBeenCalledWith({ err: expect.anything() }, 'Could not subscribe to the mailing lists');
        });
    });
});
