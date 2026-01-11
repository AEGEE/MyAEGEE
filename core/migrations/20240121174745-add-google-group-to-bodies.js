module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'google_group',
        {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'google_group')
};
