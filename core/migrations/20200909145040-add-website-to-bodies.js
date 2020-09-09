module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'website',
        {
            type: Sequelize.STRING,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'website')
};
