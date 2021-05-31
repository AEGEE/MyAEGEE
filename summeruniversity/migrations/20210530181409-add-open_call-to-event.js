module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'open_call',
            { type: Sequelize.BOOLEAN, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'accepted_participants',
            { type: Sequelize.INTEGER, allowNull: true }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn(
            'events',
            'open_call'
        );

        await queryInterface.removeColumn(
            'events',
            'accepted_participants'
        );
    }
};
