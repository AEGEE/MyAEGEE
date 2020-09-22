module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'privacy_consent',
        {
            type: Sequelize.DATE,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'privacy_consent')
};
