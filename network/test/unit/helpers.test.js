const helpers = require('../../lib/helpers');

describe('network helpers', () => {
    test('allows only known board sorting fields', () => {
        expect(helpers.getSorting({ sort: 'start_date', direction: 'desc' })).toEqual([['start_date', 'desc']]);
        expect(helpers.getSorting({ sort: 'created_at', direction: 'desc' })).toEqual([['id', 'desc']]);
        expect(helpers.getSorting({ sort: 'start_date;drop table boards', direction: 'asc' })).toEqual([['id', 'asc']]);
    });
});
