module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'publication_date',
            { type: Sequelize.DATE, allowNull: true }
        );
    },
    down: (queryInterface) => {
        queryInterface.removeColumn('events', 'publication_date');
    }
};
