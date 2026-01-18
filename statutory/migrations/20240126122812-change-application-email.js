module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'applications',
        'email',
        Sequelize.STRING
    ),
    down: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'applications',
        'email',
        Sequelize.STRING,
        { allowNull: false }
    ),
};
