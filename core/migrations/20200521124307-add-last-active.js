module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'last_active',
        {
            type: Sequelize.DATE,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'last_active')
};
