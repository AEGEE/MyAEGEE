module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'image',
        {
            type: Sequelize.STRING,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'image')
};
