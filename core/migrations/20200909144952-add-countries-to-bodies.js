module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'country',
        {
            type: Sequelize.STRING,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'country')
};
