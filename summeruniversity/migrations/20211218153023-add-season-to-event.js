module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'season',
            { type: Sequelize.INTEGER, allowNull: true }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn(
            'events',
            'season'
        );
    }
};
