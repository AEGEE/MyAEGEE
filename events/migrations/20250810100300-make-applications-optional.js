module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'has_applications',
            {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('events', 'has_applications');
    }
};
