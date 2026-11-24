const { Op } = require('sequelize');

const merge = require('../../lib/merge');

describe('merge', () => {
    test('should merge nested objects and replace arrays and other values', () => {
        const target = { where: { deleted: false, type: 'nwm' }, order: [['starts', 'ASC']], limit: 10 };

        const result = merge(target, { where: { status: 'published' }, order: [['ends', 'DESC']], limit: 5 });

        expect(result).toBe(target);
        expect(result).toEqual({
            where: { deleted: false, type: 'nwm', status: 'published' },
            order: [['ends', 'DESC']],
            limit: 5
        });
    });

    test('should create nested objects the target lacks and keep symbol keys such as Op.or', () => {
        const result = merge({}, { where: { [Op.or]: [{ name: 'a' }, { name: 'b' }] } });

        expect(result.where[Op.or]).toEqual([{ name: 'a' }, { name: 'b' }]);
    });
});
