module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'image_id',
        {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'images',
                key: 'id'
            }
        }
    ),
    down: queryInterface => queryInterface.removeColumn('events', 'image_id')
};
