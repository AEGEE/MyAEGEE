const models = require('../../models');
const { sequelize, Sequelize } = require('../../lib/sequelize');
const { PERMISSIONS } = require('../../scripts/seed-permissions');
const generator = require('../scripts/generator');

// The length rule of a text field comes from its type in the model, so the model has to say
// what the column is: a text of the same length, or a text without a limit.
describe('Text fields of the models', () => {
    let columns;

    beforeAll(async () => {
        const [rows] = await sequelize.query(
            'SELECT table_name, column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_schema = \'public\''
        );

        columns = Object.fromEntries(rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    const fields = Object.values(models).flatMap((model) => Object.entries(model.rawAttributes)
        .filter(([, attribute]) => attribute.type instanceof Sequelize.STRING || attribute.type instanceof Sequelize.TEXT)
        .map(([field, attribute]) => ({
            name: `${model.name}.${field}`,
            column: `${model.getTableName()}.${attribute.field || field}`,
            // eslint-disable-next-line no-underscore-dangle
            expected: attribute.type instanceof Sequelize.STRING ? `character varying(${attribute.type._length})` : 'text'
        })));

    test('are found in every model', () => {
        expect(fields.length).toBeGreaterThan(50);
    });

    test.each(fields)('$name is declared as its column is: $expected', ({ column, expected }) => {
        const { data_type: type, character_maximum_length: length } = columns[column];

        expect(length ? `${type}(${length})` : type).toEqual(expected);
    });

    test('take every permission of the seed', async () => {
        const longest = Math.max(...PERMISSIONS.map((permission) => permission.description.length));
        expect(longest).toBeGreaterThan(255);

        // As the seed creates them.
        const created = await models.Permission.bulkCreate(PERMISSIONS, { individualHooks: true, validate: true });
        expect(created.length).toEqual(PERMISSIONS.length);
    });
});
