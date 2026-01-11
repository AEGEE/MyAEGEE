const { startServer, stopServer } = require('../../lib/server');
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

    test('should fail with alphaNumeric body_code', async () => {
        try {
            await generator.createBody({ code: 'Ts3' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('code');
        }
    });

    test('should fail with too long body_code', async () => {
        try {
            await generator.createBody({ code: 'testtest' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('code');
        }
    });

    test('should fail with too short body_code', async () => {
        try {
            await generator.createBody({ code: 'ts' });
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

    test('should fail with null email', async () => {
        try {
            await generator.createBody({ email: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('email');
        }
    });

    test('should fail with invalid email', async () => {
        try {
            await generator.createBody({ email: 'test' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('email');
        }
    });

    test('should fail with not set email', async () => {
        try {
            const body = generator.generateBody();
            delete body.email;

            await Body.create(body);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('email');
        }
    });

    test('should normalize fields', async () => {
        const data = generator.generateBody({
            code: '\t\t\ttet\t\t\t',
            email: '  \t test@TeSt.Io\t  \t',
        });

        const body = await Body.create(data);
        expect(body.code).toEqual('TET');
        expect(body.email).toEqual('test@test.io');
    });
});
