module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'candidates',
        'email',
        Sequelize.STRING
    ),
    down: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'candidates',
        'email',
        Sequelize.STRING,
        { allowNull: false }
    ),
};
