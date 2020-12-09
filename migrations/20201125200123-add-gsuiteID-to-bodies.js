module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'gsuite_id',
        {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'gsuite_id')
};
