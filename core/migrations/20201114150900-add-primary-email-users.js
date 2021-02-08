module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'primary_email',
        {
            type: Sequelize.ENUM('personal', 'gsuite'),
            allowNull: false,
            defaultValue: 'personal'
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'primary_email')
};
