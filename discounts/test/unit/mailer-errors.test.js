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
    parameters: { body: 'Hello' }
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

    test('should give up when the mailer does not answer within the timeout', async () => {
        // A local server that accepts the request and never answers. (nock's delayed
        // replies crash the process when the request was aborted before.)
        const silentServer = http.createServer(() => {});
        await new Promise((resolve) => { silentServer.listen(0, '127.0.0.1', resolve); });

        const saved = { ...config.mailer };
        Object.assign(config.mailer, { url: 'http://127.0.0.1', port: silentServer.address().port, timeout: 50 });

        try {
            const err = await mailer.sendMail(mail).catch((e) => e);

            // A DOMException, which jest's sandbox does not see as an Error.
            expect(err.name).toEqual('TimeoutError');
        } finally {
            Object.assign(config.mailer, saved);
            silentServer.closeAllConnections();
            await new Promise((resolve) => { silentServer.close(resolve); });
        }
    });
});
