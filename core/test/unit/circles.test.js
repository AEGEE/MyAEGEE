const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { Circle } = require('../../models');

describe('Cirrcle testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with null name', async () => {
        try {
            await generator.createCircle({ name: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('name');
        }
    });

    test('should fail with not set name', async () => {
        try {
            const circle = generator.generateCircle();
            delete circle.name;

            await Circle.create(circle);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('name');
        }
    });

    test('should fail with null description', async () => {
        try {
            await generator.createCircle({ description: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('description');
        }
    });

    test('should fail with not set description', async () => {
        try {
            const circle = generator.generateCircle();
            delete circle.description;

            await Circle.create(circle);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('description');
        }
    });

    test('should normalize fields', async () => {
        const data = generator.generateCircle({
            name: '\t\t\ttest\t\t\t',
            description: '  \t test\t  \t',
        });

        const circle = await Circle.create(data);
        expect(circle.name).toEqual('test');
        expect(circle.description).toEqual('test');
    });

    test('should fail with a gsuite_id that is not an email address', async () => {
        await expect(generator.createCircle({ gsuite_id: 'test' })).rejects.toMatchObject({
            name: 'SequelizeValidationError',
            errors: [expect.objectContaining({ path: 'gsuite_id', message: 'GSuite ID should be a valid email.' })]
        });
        expect(await Circle.count()).toEqual(0);
    });

    test('should fail with the gsuite_id of another circle in another case', async () => {
        await generator.createCircle({ gsuite_id: 'example-test@aegee.eu' });

        await expect(generator.createCircle({ gsuite_id: '\t example-Test@AEGEE.eu ' })).rejects.toMatchObject({
            name: 'SequelizeUniqueConstraintError',
            errors: [expect.objectContaining({ path: 'gsuite_id', type: 'unique violation' })]
        });
        expect(await Circle.count()).toEqual(1);
    });

    test('should normalize the gsuite_id', async () => {
        const circle = await generator.createCircle({ gsuite_id: '\t example-Test@AEGEE.eu ' });

        expect(circle.gsuite_id).toEqual('example-test@aegee.eu');
    });

    test('should succeed for several circles without a gsuite_id', async () => {
        await generator.createCircle({ gsuite_id: null });
        await generator.createCircle({ gsuite_id: null });

        expect(await Circle.count({ where: { gsuite_id: null } })).toEqual(2);
    });
});
