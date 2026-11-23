const http = require('http');
const nock = require('nock');

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

    test('should pass on a network error', async () => {
        nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/')
            .replyWithError('connection refused');

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).not.toContain('did not answer');
    });

    describe('timeout', () => {
        const defaultTimeout = config.mailer.timeout;

        afterEach(() => {
            config.mailer.timeout = defaultTimeout;
        });

        test('should wait at most 10 seconds for the mailer by default', () => {
            expect(defaultTimeout).toEqual(10000);
        });

        test('should give up when the mailer does not answer in time', async () => {
            // A local server that accepts the request and never answers.
            const server = http.createServer(() => {});
            await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
            const { url, port } = config.mailer;

            try {
                config.mailer.url = 'http://127.0.0.1';
                config.mailer.port = server.address().port;
                config.mailer.timeout = 50;

                const err = await mailer.sendMail(mail).catch((e) => e);

                expect(err.message).toEqual('The mailer did not answer within 50 ms');
            } finally {
                config.mailer.url = url;
                config.mailer.port = port;
                server.closeAllConnections();
                await new Promise((resolve) => { server.close(resolve); });
            }
        });
    });
});
