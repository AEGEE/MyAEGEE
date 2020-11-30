module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'bodies',
        'abbreviation',
        {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('bodies', 'abbreviation')
};
