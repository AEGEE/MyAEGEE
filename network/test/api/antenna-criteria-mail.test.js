const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const mailer = require('../../lib/mailer');

const validMail = (overrides = {}) => ({
    from: 'network@aegee.eu',
    to: 'board@example.org',
    cc: 'netcom@aegee.eu',
    reply_to: 'network@aegee.eu',
    subject: 'Preliminary Antenna Criteria check',
    body: '<p>Dear board,</p>',
    ...overrides
});

describe('Antenna Criteria fulfilment mail', () => {
    let sendMailSpy;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        sendMailSpy = jest.spyOn(mailer, 'sendMail');
    });

    afterEach(async () => {
        sendMailSpy.mockRestore();
        mock.cleanAll();
    });

    test('should send the mail through the custom template', async () => {
        const res = await request({
            path: '/antennaCriteria/sendFulfilmentMail',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: validMail()
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        expect(sendMailSpy).toHaveBeenCalledTimes(1);
        expect(sendMailSpy).toHaveBeenCalledWith({
            from: 'network@aegee.eu',
            to: 'board@example.org',
            cc: 'netcom@aegee.eu',
            reply_to: 'network@aegee.eu',
            subject: 'Preliminary Antenna Criteria check',
            template: 'custom.html',
            parameters: { email_body: '<p>Dear board,</p>' }
        });
    });

    test('should not send the mail without the permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/antennaCriteria/sendFulfilmentMail',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: validMail()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(sendMailSpy).not.toHaveBeenCalled();
    });

    describe('sender address', () => {
        test.each([
            'network@aegee.eu',
            'netcom@aegee.eu',
            'X@AEGEE.ORG'
        ])('should accept %p, an address on the AEGEE mail domains', async (from) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ from })
            });

            expect(res.statusCode).toEqual(200);
            expect(sendMailSpy).toHaveBeenCalledTimes(1);
            expect(sendMailSpy.mock.calls[0][0].from).toEqual(from);
        });

        test.each([
            'x@example.org',
            'x@sub.aegee.org',
            'x@aegee.org.example.com',
            'aegee.eu',
            'x@aegee.eu@example.org',
            'Network <network@aegee.eu>',
            42
        ])('should reject %p, which is not an address on the AEGEE mail domains', async (from) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ from })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty('from');
            expect(sendMailSpy).not.toHaveBeenCalled();
        });

        test.each([
            ['missing', undefined],
            ['null', null],
            ['empty', '']
        ])('should send from network@aegee.eu if the sender is %s', async (_, from) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ from })
            });

            expect(res.statusCode).toEqual(200);
            expect(sendMailSpy).toHaveBeenCalledTimes(1);
            expect(sendMailSpy.mock.calls[0][0].from).toEqual('network@aegee.eu');
        });
    });
});
