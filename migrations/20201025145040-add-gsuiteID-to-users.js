module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'gsuite_id',
        {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'gsuite_id')
};
