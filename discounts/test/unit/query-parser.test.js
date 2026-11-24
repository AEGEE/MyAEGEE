const { server } = require('../../lib/server');

// Express 5 parses the query string only when a handler reads req.query, which no
// discounts route does yet, so the configured parser is checked on its own.
describe('Query parser', () => {
    test('should keep nested and bracketed parameters, as Express 4 did', () => {
        const parse = server.get('query parser fn');

        expect(parse('filter[status]=active&type[]=antenna&type[]=contact&limit=10')).toEqual({
            filter: { status: 'active' },
            type: ['antenna', 'contact'],
            limit: '10'
        });
    });

    test('should allow up to 1000 array items', () => {
        const parse = server.get('query parser fn');
        const query = Array.from({ length: 1000 }, (_, index) => `id[${index}]=${index}`).join('&');

        expect(parse(query).id).toHaveLength(1000);
    });
});
