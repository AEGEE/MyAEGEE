jest.mock('request-promise-native', () => jest.fn());

const request = require('request-promise-native');
const mailer = require('../../lib/mailer');

describe('Mailer client', () => {
    beforeEach(() => {
        request.mockReset();
    });

    test('sendMail should call mailer with expected payload', async () => {
        request.mockResolvedValue({ success: true });

        const body = await mailer.sendMail({
            from: 'from@example.org',
            to: 'to@example.org',
            subject: 'Subject',
            template: 'custom.html',
            parameters: { body: 'Hello' }
        });

        expect(body).toEqual({ success: true });
        expect(request).toHaveBeenCalledWith({
            url: 'http://mailer:4000/',
            method: 'POST',
            simple: false,
            json: true,
            body: {
                from: 'from@example.org',
                to: 'to@example.org',
                subject: 'Subject',
                template: 'custom.html',
                parameters: { body: 'Hello' }
            }
        });
    });

    test('sendMail should fail on malformed response', async () => {
        request.mockResolvedValue('bad response');

        await expect(mailer.sendMail({
            from: 'from@example.org',
            to: 'to@example.org',
            subject: 'Subject',
            template: 'custom.html',
            parameters: { body: 'Hello' }
        })).rejects.toThrow('Malformed response from mailer');
    });

    test('sendMail should fail on unsuccessful response', async () => {
        request.mockResolvedValue({ success: false, message: 'Nope' });

        await expect(mailer.sendMail({
            from: 'from@example.org',
            to: 'to@example.org',
            subject: 'Subject',
            template: 'custom.html',
            parameters: { body: 'Hello' }
        })).rejects.toThrow('Unsuccessful response from mailer');
    });
});
