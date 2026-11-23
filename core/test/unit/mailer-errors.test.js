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
        expect(err.template).toEqual('custom.html');
    });

    test('should name only the status for a malformed response', async () => {
        mockMailer(500, `Could not deliver to ${RECIPIENT}`);

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('Malformed response from mailer (status 500)');
        expect(err.template).toEqual('custom.html');
    });

    test('should name only the status for an empty response', async () => {
        mockMailer(502, '');

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('Malformed response from mailer (status 502)');
        expect(err.template).toEqual('custom.html');
    });

    test('should name the template of a mail the mailer could not be reached for', async () => {
        nock(`${config.mailer.url}:${config.mailer.port}`).post('/').replyWithError('connection refused');

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err.message).toEqual('Could not reach the mailer');
        expect(err.template).toEqual('custom.html');
    });

    test('should fail with the error of the request if the mailer cannot be reached', async () => {
        nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/')
            .replyWithError(new Error('getaddrinfo ENOTFOUND mailer'));

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err.message).toEqual('getaddrinfo ENOTFOUND mailer');
        expect(err.name).not.toEqual('TimeoutError');
    });
});
