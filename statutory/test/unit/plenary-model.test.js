const { Plenary } = require('../../models');
const { Sequelize } = require('../../lib/sequelize');

describe('Plenary model', () => {
    test('should define name as a string, like the database column', () => {
        expect(Plenary.rawAttributes.name.type).toBeInstanceOf(Sequelize.STRING);
    });
});
