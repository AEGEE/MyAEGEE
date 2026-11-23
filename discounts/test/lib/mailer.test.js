jest.mock('../../lib/http', () => ({ request: jest.fn() }));

const { request } = require('../../lib/http');
const config = require('../../config');
const mailer = require('../../lib/mailer');

const mail = {
    from: 'from@example.org',
    to: 'to@example.org',
    subject: 'Subject',
    template: 'custom.html',
    parameters: { body: 'Hello' }
};

describe('Mailer client', () => {
    beforeEach(() => {
        request.mockReset();
    });

    test('sendMail should call mailer with expected payload', async () => {
        request.mockResolvedValue({ statusCode: 200, body: { success: true } });

        const body = await mailer.sendMail(mail);

        expect(body).toEqual({ success: true });
        expect(request).toHaveBeenCalledWith({
            url: `${config.mailer.url}:${config.mailer.port}/`,
            method: 'POST',
            body: mail,
            fullResponse: true,
            timeout: 10000
        });
    });

    test('sendMail should fail on malformed response', async () => {
        request.mockResolvedValue({ statusCode: 200, body: 'bad response' });

        await expect(mailer.sendMail(mail)).rejects.toThrow('Malformed response from mailer');
    });

    test('sendMail should fail on unsuccessful response', async () => {
        request.mockResolvedValue({ statusCode: 500, body: { success: false, message: 'Nope' } });

        await expect(mailer.sendMail(mail)).rejects.toThrow('Unsuccessful response from mailer');
    });
});
