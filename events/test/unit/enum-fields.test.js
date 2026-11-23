const models = require('../../models');

const { Event, Application } = models;
const { isOneOf } = require('../../lib/validators');

// The fields the model refuses for an instance with only these values.
const fieldsWithErrors = async (Model, values) => {
    const error = await Model.build(values).validate().catch((err) => err);
    return error instanceof Error ? error.errors.map((item) => item.path) : [];
};

// Every field with a fixed set of values, with one of its values.
const ENUM_FIELDS = [
    ['Event', 'type', Event, 'training'],
    ['Event', 'status', Event, 'published'],
    ['Event', 'method', Event, 'online'],
    ['Application', 'status', Application, 'accepted']
];

// Every field with a fixed set of values takes only one of those strings. Sequelize's own
// isIn compares String(value), which an array such as ['online'] would pass.
describe('Enum fields', () => {
    test.each(ENUM_FIELDS)('%s.%s takes only one of its strings', async (_name, field, Model, value) => {
        expect(await fieldsWithErrors(Model, { [field]: value })).not.toContain(field);

        for (const sent of [[value], { [field]: value }, 1, true, 'garbage']) {
            expect(await fieldsWithErrors(Model, { [field]: sent })).toContain(field);
        }
    });

    // A field with a fixed set of values that is missing from ENUM_FIELDS would not be checked
    // above: an ENUM column, or a column with an isOneOf (or Sequelize's isIn) validator.
    test('ENUM_FIELDS lists every field with a fixed set of values', () => {
        const hasFixedValues = (attribute) => attribute.type.key === 'ENUM'
            || ['isOneOf', 'isIn'].some((name) => attribute.validate && name in attribute.validate);
        const fields = Object.entries(models).flatMap(([name, Model]) => Object.entries(Model.rawAttributes)
            .filter(([, attribute]) => hasFixedValues(attribute))
            .map(([field]) => `${name}.${field}`));

        expect(ENUM_FIELDS.map(([name, field]) => `${name}.${field}`).sort()).toEqual(fields.sort());
    });

    test('a missing value is left to allowNull', () => {
        const check = isOneOf(['a', 'b'], 'Should be a or b.');

        expect(() => check(null)).not.toThrow();
        expect(() => check(undefined)).not.toThrow();
        expect(() => check('b')).not.toThrow();
        expect(() => check(['a'])).toThrow('Should be a or b.');
    });
});
