module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'refresh_tokens',
        'rotated_at',
        {
            type: Sequelize.DATE,
            allowNull: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('refresh_tokens', 'rotated_at')
};
