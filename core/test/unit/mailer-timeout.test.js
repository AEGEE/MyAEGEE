const config = require('../../config');
const mailer = require('../../lib/mailer');
const { startSilentServer } = require('../scripts/silent-server');

const mail = {
    to: 'test@test.io',
    subject: 'Subject',
    template: 'custom.html',
    parameters: { email_body: 'test' }
};

describe('Mailer client timeout', () => {
    const original = { ...config.mailer };
    let silentMailer;

    beforeEach(async () => {
        silentMailer = await startSilentServer();
        config.mailer.url = 'http://127.0.0.1';
        config.mailer.port = silentMailer.port;
    });

    afterEach(async () => {
        Object.assign(config.mailer, original);
        await silentMailer.close();
    });

    test('should wait 10 seconds by default', () => {
        expect(original.timeout).toEqual(10 * 1000);
    });

    test('should fail if the mailer does not answer in time', async () => {
        config.mailer.timeout = 500;
        const started = Date.now();

        const err = await mailer.sendMail(mail).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('No response from mailer within 500 ms');
        expect(err.template).toEqual('custom.html');
        expect(silentMailer.requests).toEqual(1);
        expect(Date.now() - started).toBeLessThan(5000);
    });
});
