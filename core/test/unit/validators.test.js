const validators = require('../../lib/validators');
const { Sequelize } = require('../../lib/sequelize');
const { User } = require('../../models');

const MESSAGE = 'The value is not valid.';

describe('Validators', () => {
    describe.each([
        ['isBoolean', validators.isBoolean(MESSAGE)],
        ['isDate', validators.isDate(MESSAGE)],
        ['isListOfTexts', validators.isListOfTexts(MESSAGE)],
        ['isOneOf', validators.isOneOf(['antenna', 'contact'], MESSAGE)]
    ])('%s', (name, validator) => {
        test('should accept null and undefined, which are for `allowNull` to judge', () => {
            expect(() => validator(null)).not.toThrow();
            expect(() => validator(undefined)).not.toThrow();
        });
    });

    describe('isBoolean', () => {
        const isBoolean = validators.isBoolean(MESSAGE);

        test('should accept true and false', () => {
            expect(() => isBoolean(true)).not.toThrow();
            expect(() => isBoolean(false)).not.toThrow();
        });

        test.each([
            ['a text', 'yes'],
            ['the text "true"', 'true'],
            ['a number', 1],
            ['zero', 0],
            ['an empty text', ''],
            ['an object', {}],
            ['a list', [true]]
        ])('should refuse %s with the given message', (description, value) => {
            expect(() => isBoolean(value)).toThrow(new Error(MESSAGE));
        });
    });

    describe('isDate', () => {
        const isDate = validators.isDate(MESSAGE);

        test('should accept a date', () => {
            expect(() => isDate(new Date('2020-02-29T12:00:00.000Z'))).not.toThrow();
        });

        test.each([
            ['a day', '2020-02-29'],
            ['a moment with a time zone', '2020-02-29T12:00:00.000Z']
        ])('should accept %s as an ISO 8601 text', (description, value) => {
            expect(() => isDate(value)).not.toThrow();
        });

        test.each([
            ['a date that is not valid', new Date('not a date')],
            ['the text Sequelize makes of a value that is not a date', 'Invalid date'],
            ['a day that does not exist', '2021-02-29'],
            ['a text that is not a date', 'tomorrow'],
            ['a date that is not written as ISO 8601', '29.02.2020'],
            ['an empty text', ''],
            ['a number', 1582977600000],
            ['an object', {}]
        ])('should refuse %s with the given message', (description, value) => {
            expect(() => isDate(value)).toThrow(new Error(MESSAGE));
        });
    });

    describe('isListOfTexts', () => {
        const isListOfTexts = validators.isListOfTexts(MESSAGE);

        test('should accept a list of texts and an empty list', () => {
            expect(() => isListOfTexts(['first_name', 'last_name'])).not.toThrow();
            expect(() => isListOfTexts([])).not.toThrow();
        });

        test.each([
            ['a text', 'first_name'],
            ['an object', { 0: 'first_name' }],
            ['a number', 1],
            ['false', false],
            ['a list with a number in it', ['first_name', 1]],
            ['a list with null in it', ['first_name', null]],
            ['a list with a list in it', [['first_name']]]
        ])('should refuse %s with the given message', (description, value) => {
            expect(() => isListOfTexts(value)).toThrow(new Error(MESSAGE));
        });
    });

    describe('isOneOf', () => {
        const isOneOf = validators.isOneOf(['antenna', 'contact'], MESSAGE);

        test('should accept each of the values', () => {
            expect(() => isOneOf('antenna')).not.toThrow();
            expect(() => isOneOf('contact')).not.toThrow();
        });

        test.each([
            ['another text', 'partner'],
            ['a value in another case', 'Antenna'],
            ['an empty text', ''],
            ['a list of a value', ['antenna']],
            ['a number', 0],
            ['false', false]
        ])('should refuse %s with the given message', (description, value) => {
            expect(() => isOneOf(value)).toThrow(new Error(MESSAGE));
        });
    });

    describe('addLengthValidators', () => {
        // What addLengthValidators reads of a model and calls on it.
        const makeModel = (rawAttributes) => ({ rawAttributes, refreshAttributes: jest.fn() });

        test('should refuse a text that is longer than its column, naming the field', () => {
            const model = makeModel({ first_name: { type: new Sequelize.STRING(5) } });

            validators.addLengthValidators(model);

            const { isShortEnough } = model.rawAttributes.first_name.validate;
            expect(() => isShortEnough('abcde')).not.toThrow();
            expect(() => isShortEnough('abcdef')).toThrow(new Error('First name should be at most 5 characters long.'));
        });

        test('should use 255 characters for a column without a length of its own', () => {
            const model = makeModel({ name: { type: new Sequelize.STRING() } });

            validators.addLengthValidators(model);

            const { isShortEnough } = model.rawAttributes.name.validate;
            expect(() => isShortEnough('a'.repeat(255))).not.toThrow();
            expect(() => isShortEnough('a'.repeat(256))).toThrow(new Error('Name should be at most 255 characters long.'));
        });

        test('should leave a value that is not a text to the other validators', () => {
            const model = makeModel({ name: { type: new Sequelize.STRING(2) } });

            validators.addLengthValidators(model);

            const { isShortEnough } = model.rawAttributes.name.validate;
            expect(() => isShortEnough(null)).not.toThrow();
            expect(() => isShortEnough(undefined)).not.toThrow();
            expect(() => isShortEnough(12345)).not.toThrow();
            expect(() => isShortEnough(['a', 'b', 'c'])).not.toThrow();
        });

        test('should keep the validators that a column has already', () => {
            const notEmpty = { msg: 'Name should be set.' };
            const model = makeModel({ name: { type: new Sequelize.STRING(5), validate: { notEmpty } } });

            validators.addLengthValidators(model);

            expect(model.rawAttributes.name.validate.notEmpty).toBe(notEmpty);
            expect(model.rawAttributes.name.validate.isShortEnough).toEqual(expect.any(Function));
        });

        test('should add one to a column that only has a minimal length', () => {
            const len = { args: [3], msg: 'Name should be at least 3 characters long.' };
            const model = makeModel({ name: { type: new Sequelize.STRING(5), validate: { len } } });

            validators.addLengthValidators(model);

            expect(model.rawAttributes.name.validate.len).toBe(len);
            expect(model.rawAttributes.name.validate.isShortEnough).toEqual(expect.any(Function));
        });

        test('should not add one to a column that has a maximal length already', () => {
            const validate = { len: { args: [3, 5], msg: 'Name should be 3 to 5 characters long.' } };
            const model = makeModel({ name: { type: new Sequelize.STRING(5), validate } });

            validators.addLengthValidators(model);

            expect(model.rawAttributes.name.validate).toBe(validate);
            expect(model.rawAttributes.name.validate.isShortEnough).toBeUndefined();
        });

        test('should not add one to a column that is not a STRING', () => {
            const model = makeModel({
                description: { type: new Sequelize.TEXT() },
                amount: { type: new Sequelize.INTEGER() },
                starts: { type: new Sequelize.DATE(), validate: { isDate: true } }
            });

            validators.addLengthValidators(model);

            expect(model.rawAttributes.description.validate).toBeUndefined();
            expect(model.rawAttributes.amount.validate).toBeUndefined();
            expect(model.rawAttributes.starts.validate).toEqual({ isDate: true });
        });

        test('should tell the model that its attributes have changed', () => {
            const model = makeModel({ name: { type: new Sequelize.STRING(5) } });

            validators.addLengthValidators(model);

            expect(model.refreshAttributes).toHaveBeenCalledTimes(1);
        });

        test('should have been applied to the models of the service', async () => {
            const user = User.build({ first_name: 'a'.repeat(256) });

            const err = await user.validate({ fields: ['first_name'] }).catch((e) => e);

            expect(err).toBeInstanceOf(Sequelize.ValidationError);
            expect(err.errors.map((item) => item.message)).toEqual(['First name should be at most 255 characters long.']);
        });
    });
});
