const { ValidationError } = require('sequelize');

const Category = require('../../models/Category');

describe('Category model', () => {
    test('should validate a valid category', async () => {
        const category = Category.build({
            name: 'Travel',
            discounts: [{
                name: 'Flixbus',
                icon: 'bus',
                shortDescription: 'Short description',
                longDescription: 'Long description'
            }]
        });

        await expect(category.validate()).resolves.toBe(category);
    });

    test('should fail if a nested discount name is missing', async () => {
        const category = Category.build({
            name: 'Travel',
            discounts: [{
                name: null,
                icon: 'bus',
                shortDescription: 'Short description',
                longDescription: 'Long description'
            }]
        });

        await expect(category.validate()).rejects.toBeInstanceOf(ValidationError);
    });
});
