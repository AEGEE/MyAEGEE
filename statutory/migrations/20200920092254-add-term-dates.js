module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'positions',
            'start_term',
            { type: Sequelize.DATEONLY, allowNull: false, defaultValue: Sequelize.NOW }
        );

        await queryInterface.addColumn(
            'positions',
            'end_term',
            { type: Sequelize.STRING, allowNull: false, defaultValue: '' }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('positions', 'start_term');
        await queryInterface.removeColumn('positions', 'end_term');
    }
};
