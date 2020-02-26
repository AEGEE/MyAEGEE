module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'campaigns',
        'autojoin_body_id',
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
    down: (queryInterface) => queryInterface.removeColumn('campaigns', 'autojoin_body_id')
};
