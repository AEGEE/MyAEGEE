const queryBoolean = require('../../lib/query-boolean');

// Mimics Express 5, where req.query is a getter that re-parses on each access.
function requestWithQuery(query) {
    const req = {};
    Object.defineProperty(req, 'query', {
        get: () => JSON.parse(JSON.stringify(query)),
        configurable: true,
        enumerable: true,
    });
    return req;
}

describe('query-boolean middleware', () => {
    test('should convert "true" and "false" to booleans', () => {
        expect(queryBoolean.parseValue({ a: 'true', b: 'false' })).toEqual({ a: true, b: false });
    });

    test('should leave other values untouched', () => {
        expect(queryBoolean.parseValue({ a: 'TRUE', b: '1', c: '', d: 'no', e: 'falsey' }))
            .toEqual({ a: 'TRUE', b: '1', c: '', d: 'no', e: 'falsey' });
    });

    test('should convert values inside nested objects and arrays', () => {
        expect(queryBoolean.parseValue({ filter: { active: 'false', name: 'x' }, list: ['true', 'y', ['false']] }))
            .toEqual({ filter: { active: false, name: 'x' }, list: [true, 'y', [false]] });
    });

    test('should replace req.query with the converted copy and call next', () => {
        const req = requestWithQuery({ all: 'false', limit: '10' });
        const next = jest.fn();

        queryBoolean()(req, {}, next);

        expect(req.query).toEqual({ all: false, limit: '10' });
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('should keep changes made to req.query afterwards', () => {
        const req = requestWithQuery({ all: 'true' });

        queryBoolean()(req, {}, jest.fn());
        req.query.sort = 'name';

        expect(req.query).toEqual({ all: true, sort: 'name' });
    });
});
