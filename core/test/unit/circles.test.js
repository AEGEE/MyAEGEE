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
});
