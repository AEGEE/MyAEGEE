const { Event, Application, Season } = require('../../models');

// Every BOOLEAN column takes only true and false (and null where it allows null). Sequelize
// reads 'true', 'false', 1 and 0 as booleans before validating; the columns keep the value as
// sent, so that their validators refuse it.
const booleanFields = (Model) => Object.entries(Model.rawAttributes)
    .filter(([, attribute]) => attribute.type.key === 'BOOLEAN')
    .map(([field]) => field);

const rows = [['Event', Event], ['Application', Application], ['Season', Season]]
    .flatMap(([name, Model]) => booleanFields(Model).map((field) => [name, field, Model]));

describe('Boolean fields', () => {
    test('every model has its boolean columns listed', () => {
        expect(rows.map(([name, field]) => `${name}.${field}`)).toEqual([
            'Event.deleted', 'Event.open_call', 'Event.university_support', 'Event.agreed_to_su_terms',
            'Application.visa_required', 'Application.confirmed', 'Application.attended', 'Application.cancelled',
            'Application.agreed_to_privacy_policy', 'Application.agreed_to_su_terms',
            'Season.active'
        ]);
    });

    test.each(rows)('%s.%s keeps the value as sent and refuses anything but true and false', async (_name, field, Model) => {
        for (const sent of ['true', 'false', 1, 0, 'garbage']) {
            const instance = Model.build({ [field]: sent });
            expect(instance[field]).toBe(sent);

            const error = await instance.validate({ fields: [field] }).catch((err) => err);
            expect(error).toBeInstanceOf(Error);
            expect(error.errors.map((item) => item.path)).toContain(field);
        }

        // true is a boolean for every one of them (the agreements take only true).
        expect(Model.build({ [field]: true })[field]).toBe(true);
    });
});
