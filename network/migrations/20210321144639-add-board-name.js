module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'boards',
        'name',
        {
            type: Sequelize.STRING,
            allowNull: true
        }
    ),
    down: (queryInterface) => queryInterface.removeColumn('boards', 'name')
};
