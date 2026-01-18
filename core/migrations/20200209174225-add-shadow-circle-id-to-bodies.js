module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'shadow_circle_id',
        {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'circles',
                key: 'id'
            },
            onDelete: 'SET NULL'
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'shadow_circle_id')
};
