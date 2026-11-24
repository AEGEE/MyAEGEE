const http = require('http');
const { default: nock } = require('nock');

const config = require('../../config');
const mailer = require('../../lib/mailer');

// A recipient the mailer's own error text may name. It must not reach the error message,
// which is logged and can be returned to the client.
const RECIPIENT = 'mailer-error-recipient@example.org';

const mail = {
    to: RECIPIENT,
    subject: 'Subject',
    template: 'custom.html',
    parameters: { email_body: 'Hello' }
};

describe('Mailer client errors', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    const mockMailer = (status, body) => nock(`${config.mailer.url}:${config.mailer.port}`)
        .post('/')
        .reply(status, body);

    test('should name only the status for an unsuccessful response', async () => {
        mockMailer(422, { success: false, message: `Could not deliver to ${RECIPIENT}` });

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('Unsuccessful response from mailer (status 422)');
    });

    test('should name only the status for a malformed response', async () => {
        mockMailer(500, `Could not deliver to ${RECIPIENT}`);

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('Malformed response from mailer (status 500)');
    });

    test('should name only the status for an empty response', async () => {
        mockMailer(502, '');

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('Malformed response from mailer (status 502)');
    });
    test('should pass on a connection error', async () => {
        nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/')
            .replyWithError('connection refused');

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeTruthy();
        expect(String(err.message)).not.toContain('No answer from mailer');
    });

    describe('timeout', () => {
        test('should wait 10 seconds by default', () => {
            expect(config.mailer.timeout).toEqual(10000);
        });

        test('should give up when the mailer does not answer in time', async () => {
            // A local server that accepts the request and never answers. (nock's delayed
            // replies crash the process when the request was aborted before.)
            const silentServer = http.createServer(() => {});
            await new Promise((resolve) => { silentServer.listen(0, '127.0.0.1', resolve); });

            const saved = { ...config.mailer };
            Object.assign(config.mailer, { url: 'http://127.0.0.1', port: silentServer.address().port, timeout: 100 });

            try {
                const started = Date.now();
                const err = await mailer.sendMail(mail).catch((e) => e);

                expect(err.message).toEqual('No answer from mailer within 100 ms');
                expect(Date.now() - started).toBeLessThan(1500);
            } finally {
                Object.assign(config.mailer, saved);
                silentServer.closeAllConnections();
                await new Promise((resolve) => { silentServer.close(resolve); });
            }
        });
    });
});
