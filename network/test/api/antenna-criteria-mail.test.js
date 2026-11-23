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
            'a..b@aegee.eu',
            '.a@aegee.eu',
            'a.@aegee.eu',
            'a\\@aegee.eu',
            'x[]@aegee.eu',
            'x y@aegee.eu',
            'network@aegee.eu\r\nBcc: x@example.org',
            'network@aegee.eu\n',
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

    describe('input', () => {
        test.each([
            ['to', undefined],
            ['to', ''],
            ['to', []],
            ['to', ['board@example.org', '']],
            ['to', 42],
            ['subject', undefined],
            ['subject', ''],
            ['subject', { text: 'x' }],
            ['body', undefined],
            ['body', ''],
            ['body', ['<p>x</p>']],
            ['cc', 42],
            ['cc', [42]],
            ['reply_to', ['network@aegee.eu']]
        ])('should reject %s set to %p', async (field, value) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ [field]: value })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty(field);
            expect(sendMailSpy).not.toHaveBeenCalled();
        });

        test('should list every invalid field', async () => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { from: 'x@example.org' }
            });

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body.errors).sort()).toEqual(['body', 'from', 'subject', 'to']);
        });

        test.each([
            ['to', ['board@example.org', 'president@example.org']],
            ['cc', ''],
            ['cc', ['netcom@aegee.eu', 'network@aegee.eu']],
            ['cc', undefined],
            ['reply_to', ''],
            ['reply_to', undefined]
        ])('should accept %s set to %p', async (field, value) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ [field]: value })
            });

            expect(res.statusCode).toEqual(200);
            expect(sendMailSpy).toHaveBeenCalledTimes(1);
            expect(sendMailSpy.mock.calls[0][0][field]).toEqual(value);
        });
    });

    describe('addresses and header lines', () => {
        test.each([
            ['to', 'a@b.org\r\nBcc: x@example.org'],
            ['to', 'board@example.org\n'],
            ['to', 'not an address'],
            ['to', 'a..b@example.org'],
            ['to', 'board@example'],
            ['to', 'a'.repeat(65) + '@example.org'],
            ['to', 'a@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(63) + '.' + 'e'.repeat(60) + '.org'],
            ['to', ['board@example.org', 'president@']],
            ['to', ['board@example.org', 'x@example.org\rBcc: y@example.org']],
            ['cc', 'netcom@aegee.eu\r\nBcc: x@example.org'],
            ['cc', 'netcom'],
            ['cc', ['netcom@aegee.eu', 'x[]@aegee.eu']],
            ['reply_to', 'network@aegee.eu\r\nBcc: x@example.org'],
            ['reply_to', 'network'],
            ['reply_to', 'Network <network@aegee.eu>'],
            ['subject', 'Antenna Criteria\r\nBcc: x@example.org'],
            ['subject', 'Antenna Criteria\ncheck'],
            ['subject', 'Antenna Criteria\rcheck']
        ])('should reject %s set to %p', async (field, value) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ [field]: value })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect(sendMailSpy).not.toHaveBeenCalled();
        });

        test.each([
            ['to', 'first.last+agora@sub.example.org'],
            ['to', "o'brien@example.org"],
            ['cc', ['netcom@aegee.eu', 'Network.Director@AEGEE.org']],
            ['reply_to', 'network-director@aegee.eu'],
            ['subject', 'Preliminary Antenna Criteria check: Agora Example 2026']
        ])('should accept %s set to %p', async (field, value) => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({ [field]: value })
            });

            expect(res.statusCode).toEqual(200);
            expect(sendMailSpy.mock.calls[0][0][field]).toEqual(value);
        });

        test('should name the rule in the messages', async () => {
            const res = await request({
                path: '/antennaCriteria/sendFulfilmentMail',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: validMail({
                    to: 'a@b.org\r\nBcc: x@example.org',
                    cc: 'netcom',
                    reply_to: 'network',
                    subject: 'Antenna Criteria\ncheck'
                })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({
                to: ['The recipient must be an address or a list of addresses.'],
                cc: ['Cc must be an address or a list of addresses.'],
                reply_to: ['Reply-to must be an address.'],
                subject: ['The subject must be one line.']
            });
        });
    });
});
