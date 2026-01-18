module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'application_starts',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'application_ends',
            { type: Sequelize.DATE, allowNull: true }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn(
            'events',
            'application_starts'
        );

        await queryInterface.removeColumn(
            'events',
            'application_ends'
        );
    }
};
