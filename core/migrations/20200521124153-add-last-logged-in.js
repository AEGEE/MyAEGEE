module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'last_logged_in',
        {
            type: Sequelize.DATE,
            allowNull: true
        }
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'last_logged_in')
};
