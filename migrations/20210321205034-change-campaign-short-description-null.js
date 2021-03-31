module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'campaigns',
        'description_short',
        Sequelize.TEXT
    ),
    down: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'campaigns',
        'description_short',
        Sequelize.TEXT,
        { allowNull: false }
    ),
};
