module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'published',
        {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'none'
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('events', 'published')
};
