const { startServer, stopServer } = require('../../lib/server.js');
const generator = require('../scripts/generator');
const { Body } = require('../../models');

describe('Bodies testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with null body_code', async () => {
        try {
            await generator.createBody({ code: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('code');
        }
    });

    test('should fail with not set body_code', async () => {
        try {
            const body = generator.generateBody();
            delete body.code;

            await Body.create(body);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('code');
        }
    });

    test('should work with email not set', async () => {
        const data = generator.generateBody({ email: null });
        const body = await Body.create(data);

        expect(body.email).toEqual(null);
    });

    test('should normalize fields', async () => {
        const data = generator.generateBody({
            code: '\t\t\ttest\t\t\t',
            email: '  \t test@TeSt.Io\t  \t',
        });

        const body = await Body.create(data);
        expect(body.code).toEqual('TEST');
        expect(body.email).toEqual('test@test.io');
    });
});
