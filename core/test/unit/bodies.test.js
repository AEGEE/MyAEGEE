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

    test.each([
        ['null name', { name: null }, 'name', 'body.name cannot be null'],
        ['empty name', { name: '' }, 'name', 'Name must be set.'],
        ['name of spaces', { name: '  \t ' }, 'name', 'Name must be set.'],
        ['null description', { description: null }, 'description', 'body.description cannot be null'],
        ['empty description', { description: '' }, 'description', 'Description must be set.'],
        ['empty phone', { phone: '' }, 'phone', 'Phone must be set.'],
        ['empty address', { address: '' }, 'address', 'Address must be set.'],
        ['type that does not exist', { type: 'club' }, 'type', expect.stringMatching(/^Type must be one of these: /)],
        ['status that does not exist', { status: 'gone' }, 'status', 'Status must be one of these: "active", "deleted".']
    ])('should fail with %s', async (name, fields, path, message) => {
        await expect(generator.createBody(fields)).rejects.toMatchObject({
            name: 'SequelizeValidationError',
            errors: [expect.objectContaining({ path, message })]
        });
        expect(await Body.count()).toEqual(0);
    });

    test.each(['name', 'description'])('should fail with not set %s', async (field) => {
        const body = generator.generateBody();
        delete body[field];

        await expect(Body.create(body)).rejects.toMatchObject({
            name: 'SequelizeValidationError',
            errors: [expect.objectContaining({ path: field, message: `body.${field} cannot be null` })]
        });
    });

    test('should succeed without a phone and an address', async () => {
        const body = await generator.createBody({ phone: null, address: null });

        expect(body.phone).toEqual(null);
        expect(body.address).toEqual(null);
    });
});
