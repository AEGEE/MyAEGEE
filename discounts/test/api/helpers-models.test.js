const helpers = require('../../lib/helpers');
const generator = require('../scripts/generator');
const { Category } = require('../../models');

describe('Helpers and model contracts', () => {
    afterEach(async () => {
        await generator.clearAll();
    });

    test('should detect numeric values consistently', () => {
        expect(helpers.isNumber(5)).toEqual(true);
        expect(helpers.isNumber('42')).toEqual(true);
        expect(helpers.isNumber('4.2')).toEqual(true);
        expect(helpers.isNumber('abc')).toEqual(false);
        expect(helpers.isNumber(false)).toEqual(false);
    });

    test('should build mail text with key claim details', () => {
        const mailText = helpers.getMailText({
            user: { first_name: 'Alex' },
            integration: {
                name: 'FlixBus',
                description: 'Travel discount'
            },
            code: {
                value: 'DISCOUNT-123',
                updated_at: new Date('2026-03-06T12:34:56.000Z')
            }
        });

        expect(mailText).toContain('Hey Alex');
        expect(mailText).toContain('Partner: FlixBus');
        expect(mailText).toContain('Code: DISCOUNT-123');
        expect(mailText).toContain('Claimed on: 2026-03-06 12:34');
        expect(mailText).toContain('Travel discount');
    });

    test('should reset and populate gauge data', () => {
        const gauge = {
            reset: jest.fn(),
            set: jest.fn()
        };

        helpers.addGaugeData(gauge, [
            { category_name: 'Travel', value: 2 },
            { integration_name: 'FlixBus', claimed: 'true', value: 1 }
        ]);

        expect(gauge.reset).toHaveBeenCalledTimes(1);
        expect(gauge.set).toHaveBeenNthCalledWith(1, { category_name: 'Travel' }, 2);
        expect(gauge.set).toHaveBeenNthCalledWith(2, { integration_name: 'FlixBus', claimed: 'true' }, 1);
    });

    test('should create a category with valid discounts payload', async () => {
        const category = await Category.create(generator.generateCategory({
            name: 'Travel',
            discounts: [generator.generateDiscount({
                name: 'FlixBus',
                icon: 'bus',
                shortDescription: 'Short text',
                longDescription: 'Long text'
            })]
        }));

        expect(category.name).toEqual('Travel');
        expect(category.discounts).toHaveLength(1);
        expect(category.discounts[0].name).toEqual('FlixBus');
    });

    test('should reject a category with empty discounts list', async () => {
        await expect(Category.create(generator.generateCategory({
            discounts: []
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });

    test('should reject a category with malformed discount entry', async () => {
        await expect(Category.create(generator.generateCategory({
            discounts: [generator.generateDiscount({ icon: null })]
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });
});
