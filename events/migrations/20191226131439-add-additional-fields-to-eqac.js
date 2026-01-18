module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'budget',
            { type: Sequelize.TEXT, allowNull: true }
        );
        await queryInterface.addColumn(
            'events',
            'programme',
            { type: Sequelize.TEXT, allowNull: true }
        );
    },
    down: (queryInterface) => {
        queryInterface.removeColumn('events', 'programme');
        queryInterface.removeColumn('events', 'budget');
    }
};
