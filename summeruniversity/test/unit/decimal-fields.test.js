const { Event } = require('../../models');
const { sequelize } = require('../../lib/sequelize');

// The most digits before the decimal point, 308, so that a fee reads back as a number: the
// largest value at the model, and that Postgres keeps it (field-types.test.js has the others).
const fieldErrors = async (values, fields) => {
    const error = await Event.build(values).validate({ fields }).catch((err) => err);
    return error instanceof Error ? error.errors.map((item) => item.message) : [];
};

describe('Decimal fields', () => {
    test.each([
        ['fee', 'Event fee should be valid.'],
        ['optional_fee', 'Optional fee should be valid.']
    ])('%s refuses 309 digits before the decimal point', async (field, message) => {
        expect(await fieldErrors({ [field]: '9'.repeat(309) }, [field])).toContain(message);
        expect(await fieldErrors({ [field]: `${'9'.repeat(309)}.5` }, [field])).toContain(message);
        expect(await fieldErrors({ [field]: `0${'9'.repeat(309)}` }, [field])).toContain(message);
    });

    test.each([
        ['308 digits, leading zeros aside', `000${'9'.repeat(308)}.5`, 308 + 2],
        ['an exponent that makes 308 digits', '1e307', 308]
    ])('a fee takes %s before the decimal point, which Postgres keeps and reads back as a number', async (_name, fee, length) => {
        expect(await fieldErrors({ fee }, ['fee'])).toEqual([]);

        const [[row]] = await sequelize.query('SELECT length(CAST(:fee AS numeric)::text) AS length, CAST(:fee AS numeric) AS value', { replacements: { fee } });
        expect(row.length).toEqual(length);
        expect(Number.isFinite(parseFloat(row.value))).toEqual(true);
    });
});
