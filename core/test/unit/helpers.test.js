const crypto = require('crypto');

const helpers = require('../../lib/helpers');
const { BadRequestError } = require('../../lib/errors');
const { Sequelize } = require('../../lib/sequelize');
const { User, Body, MailConfirmation } = require('../../models');

describe('isRestrictedEmail', () => {
    test('should block restricted domains and their subdomains', () => {
        expect(helpers.isRestrictedEmail('test@aegee.org')).toEqual(true);
        expect(helpers.isRestrictedEmail('test@aegee.eu')).toEqual(true);
        expect(helpers.isRestrictedEmail('test@sub.aegee.org')).toEqual(true);
    });

    test('should ignore case and surrounding whitespace', () => {
        expect(helpers.isRestrictedEmail('  Test@AEGEE.Org  ')).toEqual(true);
    });

    test('should allow addresses that only look like restricted domains', () => {
        expect(helpers.isRestrictedEmail('me@notaegee.org')).toEqual(false);
        expect(helpers.isRestrictedEmail('aegee.org.fan@example.com')).toEqual(false);
        expect(helpers.isRestrictedEmail('test@aegee.org.example.com')).toEqual(false);
    });
});

describe('parseId', () => {
    test.each([
        ['a positive whole number', 15, 15],
        ['a text of digits', '15', 15],
        ['a text of digits with zeros in front', '007', 7],
        ['the highest ID the database can hold', 2147483647, 2147483647],
        ['the highest ID the database can hold, as a text', '2147483647', 2147483647]
    ])('should return %s as a number', (description, value, expected) => {
        expect(helpers.parseId(value)).toEqual(expected);
    });

    test.each([
        ['zero', 0],
        ['zero as a text', '0'],
        ['a negative number', -1],
        ['a negative number as a text', '-1'],
        ['a number with decimals', 1.5],
        ['a number with decimals as a text', '1.5'],
        ['a number in scientific notation', '1e3'],
        ['a hexadecimal number', '0x10'],
        ['a number with a plus sign', '+1'],
        ['a number with a space around it', ' 1 '],
        ['a text that starts with digits', '1abc'],
        ['an empty text', ''],
        ['a space', ' '],
        ['a number that is higher than the database can hold', 2147483648],
        ['a text of a number that is higher than the database can hold', '2147483648'],
        ['a text of more digits than a number can hold exactly', '99999999999999999999'],
        ['infinity', Infinity],
        ['something that is not a number', NaN],
        ['true', true],
        ['null', null],
        ['undefined', undefined],
        ['a list of an ID', [15]],
        ['an object', { id: 15 }]
    ])('should return null for %s', (description, value) => {
        expect(helpers.parseId(value)).toBeNull();
    });
});

describe('getPagination', () => {
    test('should return nothing if no limit and offset are given', () => {
        expect(helpers.getPagination({})).toEqual({});
    });

    test('should return the limit and the offset as numbers', () => {
        expect(helpers.getPagination({ limit: '10', offset: '20' })).toEqual({ limit: 10, offset: 20 });
    });

    test('should return a limit without an offset', () => {
        expect(helpers.getPagination({ limit: '10' })).toEqual({ limit: 10 });
    });

    test('should return an offset without a limit', () => {
        expect(helpers.getPagination({ offset: 20 })).toEqual({ offset: 20 });
    });

    test.each([
        ['zero', '0'],
        ['a negative number', '-5'],
        ['a text', 'ten'],
        ['a number with decimals', '1.5'],
        ['a list', ['10', '20']],
        ['a number that is higher than the database can hold', '2147483648']
    ])('should leave out a limit and an offset that are %s', (description, value) => {
        expect(helpers.getPagination({ limit: value, offset: value })).toEqual({});
    });

    test('should ignore the other fields of the query', () => {
        expect(helpers.getPagination({ limit: '10', query: 'test', sort: 'name' })).toEqual({ limit: 10 });
    });
});

describe('getSorting', () => {
    test('should sort by ID, ascending, by default', () => {
        expect(helpers.getSorting({}, Body)).toEqual([['id', 'ASC']]);
    });

    test('should sort by a column of the model', () => {
        expect(helpers.getSorting({ sort: 'name' }, Body)).toEqual([['name', 'ASC']]);
    });

    test('should sort in the given direction', () => {
        expect(helpers.getSorting({ direction: 'desc' }, Body)).toEqual([['id', 'desc']]);
        expect(helpers.getSorting({ sort: 'name', direction: 'asc' }, Body)).toEqual([['name', 'asc']]);
    });

    test.each([
        ['another word', 'descending'],
        ['a direction in capitals', 'DESC'],
        ['a list', ['desc']],
        ['something to add to the query', 'desc; DROP TABLE users']
    ])('should keep the default direction for %s', (description, direction) => {
        expect(helpers.getSorting({ direction }, Body)).toEqual([['id', 'ASC']]);
    });

    test('should refuse a field that the model does not have', () => {
        expect(() => helpers.getSorting({ sort: 'no_such_field' }, Body))
            .toThrow(new BadRequestError('The list cannot be sorted by this field.'));
        expect(() => helpers.getSorting({ sort: 'no_such_field' }, Body)).toThrow(BadRequestError);
    });

    test('should refuse a field that the model never returns', () => {
        expect(() => helpers.getSorting({ sort: 'password' }, User)).toThrow(BadRequestError);
    });

    test('should refuse a field that is computed and not stored', () => {
        expect(() => helpers.getSorting({ sort: 'notification_email' }, User)).toThrow(BadRequestError);
        expect(() => helpers.getSorting({ sort: 'is_expired' }, MailConfirmation)).toThrow(BadRequestError);
    });

    test('should sort by a column of a model that hides other fields', () => {
        expect(helpers.getSorting({ sort: 'first_name' }, User)).toEqual([['first_name', 'ASC']]);
    });

    test('should refuse a field of another model and a field with a table in front', () => {
        expect(() => helpers.getSorting({ sort: 'first_name' }, Body)).toThrow(BadRequestError);
        expect(() => helpers.getSorting({ sort: 'bodies.name' }, Body)).toThrow(BadRequestError);
    });

    test('should keep the default field for a sort that is not a text', () => {
        expect(helpers.getSorting({ sort: ['name', 'code'] }, Body)).toEqual([['id', 'ASC']]);
        expect(helpers.getSorting({ sort: { field: 'name' } }, Body)).toEqual([['id', 'ASC']]);
    });

    test('should refuse an empty text', () => {
        expect(() => helpers.getSorting({ sort: '' }, Body)).toThrow(BadRequestError);
    });
});

describe('filterBy', () => {
    test.each([
        ['no query', undefined],
        ['null', null],
        ['an empty text', ''],
        ['a text of spaces', '   '],
        ['a list', ['test']],
        ['an object', { like: 'test' }],
        ['a number', 5]
    ])('should not filter for %s', (description, query) => {
        expect(helpers.filterBy(query, ['first_name', 'last_name'])).toEqual({});
    });

    test('should look for the text anywhere in the fields, ignoring the case', () => {
        expect(helpers.filterBy('test', ['first_name', 'last_name', 'email'])).toEqual({
            namesQuery: Sequelize.where(
                Sequelize.fn(
                    'concat',
                    Sequelize.col('first_name'),
                    ' ',
                    Sequelize.col('last_name'),
                    ' ',
                    Sequelize.col('email')
                ),
                { [Sequelize.Op.iLike]: '%test%' }
            )
        });
    });

    test('should look in a single field without a space after it', () => {
        expect(helpers.filterBy('test', ['name'])).toEqual({
            namesQuery: Sequelize.where(
                Sequelize.fn('concat', Sequelize.col('name')),
                { [Sequelize.Op.iLike]: '%test%' }
            )
        });
    });

    test('should keep the spaces of the text', () => {
        const { namesQuery } = helpers.filterBy(' two words ', ['name']);

        expect(namesQuery.logic).toEqual({ [Sequelize.Op.iLike]: '% two words %' });
    });
});

describe('findBy', () => {
    const FIELDS = { type: 'string', status: 'array' };

    test.each([
        ['no query', undefined],
        ['null', null],
        ['a text', 'type=antenna'],
        ['a number', 5],
        ['true', true]
    ])('should not filter for %s', (description, query) => {
        expect(helpers.findBy(query, FIELDS)).toEqual({});
    });

    test('should not filter for a query without the fields', () => {
        expect(helpers.findBy({}, FIELDS)).toEqual({});
    });

    test('should filter a text field by its value', () => {
        expect(helpers.findBy({ type: 'antenna' }, FIELDS)).toEqual({ type: 'antenna' });
    });

    test('should filter a list field by its values, which are separated by commas', () => {
        expect(helpers.findBy({ status: 'pending,accepted' }, FIELDS)).toEqual({
            status: { [Sequelize.Op.in]: ['pending', 'accepted'] }
        });
    });

    test('should filter a list field by a single value', () => {
        expect(helpers.findBy({ status: 'pending' }, FIELDS)).toEqual({
            status: { [Sequelize.Op.in]: ['pending'] }
        });
    });

    test('should filter by several fields', () => {
        expect(helpers.findBy({ type: 'antenna', status: 'pending,accepted' }, FIELDS)).toEqual({
            type: 'antenna',
            status: { [Sequelize.Op.in]: ['pending', 'accepted'] }
        });
    });

    test('should ignore the fields of the query that are not asked for', () => {
        expect(helpers.findBy({ type: 'antenna', password: 'secret' }, FIELDS)).toEqual({ type: 'antenna' });
    });

    test.each([
        ['an empty text', ''],
        ['null', null],
        ['undefined', undefined],
        ['false', false],
        ['zero', 0]
    ])('should leave out a field with %s', (description, value) => {
        expect(helpers.findBy({ type: value, status: value }, FIELDS)).toEqual({});
    });

    test.each([
        ['true', true],
        ['a number', 5],
        ['a list', ['antenna', 'contact']],
        ['an object', { ne: 'antenna' }],
        ['a text of spaces', '   ']
    ])('should refuse a text field with %s', (description, value) => {
        expect(() => helpers.findBy({ type: value }, FIELDS))
            .toThrow(new BadRequestError('The "type" filter should be a text.'));
        expect(() => helpers.findBy({ type: value }, FIELDS)).toThrow(BadRequestError);
    });

    test.each([
        ['true', true],
        ['a list', ['pending', 'accepted']],
        ['an object', { ne: 'pending' }]
    ])('should refuse a list field with %s', (description, value) => {
        expect(() => helpers.findBy({ status: value }, FIELDS))
            .toThrow(new BadRequestError('The "status" filter should be a text.'));
    });
});

describe('stringOrEmpty', () => {
    test('should return a text as it is', () => {
        expect(helpers.stringOrEmpty('a token')).toEqual('a token');
        expect(helpers.stringOrEmpty(' ')).toEqual(' ');
        expect(helpers.stringOrEmpty('')).toEqual('');
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
        ['a number', 5],
        ['true', true],
        ['a list', ['a token']],
        ['an object', { token: 'a token' }]
    ])('should return an empty text for %s', (description, value) => {
        expect(helpers.stringOrEmpty(value)).toEqual('');
    });
});

describe('whitelistObject', () => {
    test('should keep the allowed fields only', () => {
        const object = { name: 'Name', description: 'Description', id: 5, superadmin: true };

        expect(helpers.whitelistObject(object, ['name', 'description'])).toEqual({
            name: 'Name',
            description: 'Description'
        });
    });

    test('should have every allowed field, also if the object does not have it', () => {
        const result = helpers.whitelistObject({ name: 'Name' }, ['name', 'description']);

        expect(Object.keys(result)).toEqual(['name', 'description']);
        expect(result.description).toBeUndefined();
    });

    test('should keep empty values as they are', () => {
        expect(helpers.whitelistObject({ a: null, b: 0, c: '', d: false }, ['a', 'b', 'c', 'd']))
            .toEqual({ a: null, b: 0, c: '', d: false });
    });

    test('should return a new object and leave the given one alone', () => {
        const object = { name: 'Name', id: 5 };

        const result = helpers.whitelistObject(object, ['name']);

        expect(result).not.toBe(object);
        expect(object).toEqual({ name: 'Name', id: 5 });
    });

    test('should return an empty object if no fields are allowed', () => {
        expect(helpers.whitelistObject({ name: 'Name' }, [])).toEqual({});
    });
});

describe('traverseIndirectCircles', () => {
    // A tree of circles, three levels deep:
    //   1
    //   ├── 2
    //   │   ├── 4
    //   │   └── 5
    //   └── 3
    //   6 (on its own)
    const CIRCLES = {
        1: { id: 1, parent_circle_id: null },
        2: { id: 2, parent_circle_id: 1 },
        3: { id: 3, parent_circle_id: 1 },
        4: { id: 4, parent_circle_id: 2 },
        5: { id: 5, parent_circle_id: 2 },
        6: { id: 6, parent_circle_id: null }
    };

    test('should return a circle and every circle above it', () => {
        expect(helpers.traverseIndirectCircles(CIRCLES, [4]).sort()).toEqual(['1', '2', '4']);
    });

    test('should return a circle in the middle of the tree with the one above it, not those below it', () => {
        expect(helpers.traverseIndirectCircles(CIRCLES, [2]).sort()).toEqual(['1', '2']);
    });

    test('should return only the circle itself if it has no parent circle', () => {
        expect(helpers.traverseIndirectCircles(CIRCLES, [1])).toEqual(['1']);
        expect(helpers.traverseIndirectCircles(CIRCLES, [6])).toEqual(['6']);
    });

    test('should return each circle once for circles that share parent circles', () => {
        expect(helpers.traverseIndirectCircles(CIRCLES, [4, 5, 3, 6]).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    test('should return each circle once if a circle is given twice', () => {
        expect(helpers.traverseIndirectCircles(CIRCLES, [4, 4]).sort()).toEqual(['1', '2', '4']);
    });

    test('should return nothing for no circles', () => {
        expect(helpers.traverseIndirectCircles(CIRCLES, [])).toEqual([]);
    });
});

describe('equalsIgnoreCase', () => {
    test('should compare the lowercased column with the lowercased value', () => {
        expect(helpers.equalsIgnoreCase('email', 'Member@Example.COM')).toEqual(
            Sequelize.where(Sequelize.fn('lower', Sequelize.col('email')), 'member@example.com')
        );
    });

    test('should keep the characters that have a meaning in a pattern as they are', () => {
        const condition = helpers.equalsIgnoreCase('username', 'A%_$1');

        expect(condition.logic).toEqual('a%_$1');
    });

    test('should compare with the text of a value that is not a text', () => {
        expect(helpers.equalsIgnoreCase('username', 12345).logic).toEqual('12345');
        expect(helpers.equalsIgnoreCase('username', null).logic).toEqual('null');
    });
});

describe('getRandomBytes', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should give a hexadecimal text of the given length', async () => {
        const value = await helpers.getRandomBytes(128);

        expect(value).toMatch(/^[0-9a-f]{128}$/);
    });

    test('should give another text every time', async () => {
        expect(await helpers.getRandomBytes(64)).not.toEqual(await helpers.getRandomBytes(64));
    });

    test('should ask for half as many bytes as characters', async () => {
        const randomBytes = jest.spyOn(crypto, 'randomBytes');

        await helpers.getRandomBytes(64);

        expect(randomBytes).toHaveBeenCalledWith(32, expect.any(Function));
    });

    test('should fail if no random bytes could be made', async () => {
        const failure = new Error('No entropy');
        jest.spyOn(crypto, 'randomBytes').mockImplementation((size, callback) => callback(failure));

        await expect(helpers.getRandomBytes(64)).rejects.toBe(failure);
    });
});

describe('addGaugeData', () => {
    test('should replace the values of the gauge with the given ones', () => {
        const gauge = { reset: jest.fn(), set: jest.fn() };

        helpers.addGaugeData(gauge, [
            { type: 'antenna', status: 'active', value: 5 },
            { type: 'contact', status: 'active', value: 0 }
        ]);

        expect(gauge.reset).toHaveBeenCalledTimes(1);
        expect(gauge.set.mock.calls).toEqual([
            [{ type: 'antenna', status: 'active' }, 5],
            [{ type: 'contact', status: 'active' }, 0]
        ]);
        expect(gauge.reset.mock.invocationCallOrder[0]).toBeLessThan(gauge.set.mock.invocationCallOrder[0]);
    });

    test('should only reset the gauge if there are no values', () => {
        const gauge = { reset: jest.fn(), set: jest.fn() };

        helpers.addGaugeData(gauge, []);

        expect(gauge.reset).toHaveBeenCalledTimes(1);
        expect(gauge.set).not.toHaveBeenCalled();
    });
});
