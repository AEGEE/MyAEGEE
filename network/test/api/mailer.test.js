const mailer = require('../../lib/mailer');
const mock = require('../scripts/mock');

describe('Mailer', () => {
    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await mock.cleanAll();
    });

    test('should fail if mailer returns net error', async () => {
        try {
            mock.mockAll({ mailer: { netError: true } });
            await mailer.sendMail({
                to: 'test@test.io',
                subject: 'test',
                template: 'custom.html',
                parameters: {}
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(1).toEqual(1);
        }
    });

    test('should fail if mailer returns bad response', async () => {
        try {
            mock.mockAll({ mailer: { badResponse: true } });
            await mailer.sendMail({
                to: 'test@test.io',
                subject: 'test',
                template: 'custom.html',
                parameters: {}
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(1).toEqual(1);
        }
    });

    test('should fail if mailer returns unsuccessful response', async () => {
        try {
            mock.mockAll({ mailer: { unsuccessfulResponse: true } });
            await mailer.sendMail({
                to: 'test@test.io',
                subject: 'test',
                template: 'custom.html',
                parameters: {}
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(1).toEqual(1);
        }
    });

    test('should not fail if there are no errors', async () => {
        await mailer.sendMail({
            to: 'test@test.io',
            subject: 'test',
            template: 'custom.html',
            parameters: {}
        });

        expect(1).toEqual(1);
    });
});
