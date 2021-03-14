module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'postal_address',
        {
            type: Sequelize.TEXT,
            allowNull: true,
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'postal_address')
};
