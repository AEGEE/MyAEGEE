const { startServer, stopServer } = require('../../lib/server.js');
const generator = require('../scripts/generator');
const { MailChange } = require('../../models');

describe('Mail changes', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with null new_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange({ new_email: null }, user);
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('new_email');
        }
    });

    test('should fail with empty new_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange({ new_email: '' }, user);
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(2);
            expect(err.errors[0].path).toEqual('new_email');
            expect(err.errors[1].path).toEqual('new_email');
        }
    });

    test('should fail with invalid new_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange({ new_email: 'test' }, user);
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('new_email');
        }
    });

    test('should normalize fields', async () => {
        const user = await generator.createUser();
        const permission = await MailChange.create({
            user_id: user.id,
            value: 'aaa',
            expires_at: new Date(),
            new_email: '\t\t\t email@email.test\t   \t'
        });
        expect(permission.new_email).toEqual('email@email.test');
    });
});
