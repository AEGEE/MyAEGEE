module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'previous_agora_id',
        { type: Sequelize.INTEGER, allowNull: true }
    ),
    down: (queryInterface) => queryInterface.removeColumn('events', 'previous_agora_id')
};
