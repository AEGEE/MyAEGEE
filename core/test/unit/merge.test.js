const merge = require('../../lib/merge');

describe('Deep merge', () => {
    test('should overwrite the values of the target with those of the source', () => {
        const target = { port: 8084, host: 'localhost' };

        const result = merge(target, { port: 8085 });

        expect(result).toEqual({ port: 8085, host: 'localhost' });
    });

    test('should change and return the target itself', () => {
        const target = { port: 8084 };

        const result = merge(target, { host: 'localhost' });

        expect(result).toBe(target);
        expect(target).toEqual({ port: 8084, host: 'localhost' });
    });

    test('should merge nested objects field by field, on every level', () => {
        const target = {
            postgres: { host: 'postgres-core', port: 5432, pool: { min: 1, max: 5 } },
            logger: { level: 'info' }
        };

        merge(target, { postgres: { host: 'localhost', pool: { max: 10 } } });

        expect(target).toEqual({
            postgres: { host: 'localhost', port: 5432, pool: { min: 1, max: 10 } },
            logger: { level: 'info' }
        });
    });

    test('should add a nested object that the target does not have', () => {
        const target = { port: 8084 };
        const source = { mailer: { url: 'http://localhost', port: 4000 } };

        merge(target, source);

        expect(target).toEqual({ port: 8084, mailer: { url: 'http://localhost', port: 4000 } });
        // A copy: changing the result later does not change the source.
        expect(target.mailer).not.toBe(source.mailer);
    });

    test('should put a nested object in the place of an empty value of the target', () => {
        const target = { mailer: null, logger: 0 };

        merge(target, { mailer: { port: 4000 }, logger: { silent: true } });

        expect(target).toEqual({ mailer: { port: 4000 }, logger: { silent: true } });
    });

    test('should replace a list as a whole', () => {
        const target = { filter_fields: ['token', 'password'] };

        merge(target, { filter_fields: ['cookie'] });

        expect(target).toEqual({ filter_fields: ['cookie'] });
    });

    test('should replace a nested object with a value that is not an object', () => {
        const target = { logger: { level: 'info' }, mailer: { port: 4000 } };

        merge(target, { logger: null, mailer: false });

        expect(target).toEqual({ logger: null, mailer: false });
    });

    test('should merge fields that have a symbol as their key', () => {
        const key = Symbol('key');
        const target = { [key]: { a: 1 } };

        merge(target, { [key]: { b: 2 } });

        expect(target[key]).toEqual({ a: 1, b: 2 });
    });

    test('should leave the target as it is for an empty source', () => {
        const target = { port: 8084 };

        merge(target, {});

        expect(target).toEqual({ port: 8084 });
    });
});
