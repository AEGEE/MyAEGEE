const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { Permission } = require('../../models');

describe('Permissions testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with invalid scope', async () => {
        try {
            await generator.createPermission({ scope: 'not-valid' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('scope');
        }
    });

    test('should fail with null action', async () => {
        try {
            await generator.createPermission({ action: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('action');
        }
    });

    test('should fail with not set action', async () => {
        try {
            const permission = generator.generatePermission();
            delete permission.action;

            await Permission.create(permission);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('action');
        }
    });

    test('should fail with null object', async () => {
        try {
            await generator.createPermission({ object: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('object');
        }
    });

    test('should fail with not set object', async () => {
        try {
            const permission = generator.generatePermission();
            delete permission.object;

            await Permission.create(permission);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('object');
        }
    });

    test('should fail with null description', async () => {
        try {
            await generator.createPermission({ description: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('description');
        }
    });

    test('should fail with not set description', async () => {
        try {
            const permission = generator.generatePermission();
            delete permission.description;

            await Permission.create(permission);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('description');
        }
    });

    test('should normalize fields', async () => {
        const data = generator.generatePermission({
            action: '\t    \t\t\tACTION\t\t\t',
            object: '    \t \t   oBjeCt\t\t\t   \t',
            description: '\t\t\ttest   \t\t'
        });

        const permission = await Permission.create(data);
        expect(permission.action).toEqual('action');
        expect(permission.object).toEqual('object');
        expect(permission.description).toEqual('test');
    });
});
