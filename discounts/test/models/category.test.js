const { ValidationError } = require('sequelize');

const { Category } = require('../../models');

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

    test('should fail if name is longer than 255 characters', async () => {
        const category = Category.build({
            name: 'a'.repeat(256),
            discounts: [{ icon: 'icon', name: 'Name', shortDescription: 'Short', longDescription: 'Long' }]
        });

        await expect(category.validate()).rejects.toThrow('Name should be at most 255 characters long.');
    });
});
