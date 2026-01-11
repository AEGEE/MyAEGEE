module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'users',
        'primary_body_id',
        {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'bodies',
                key: 'id'
            },
            onDelete: 'SET NULL'
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('users', 'primary_body_id')
};
