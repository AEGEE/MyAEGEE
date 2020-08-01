module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'task_description',
        {
            type: Sequelize.TEXT,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'task_description')
};
