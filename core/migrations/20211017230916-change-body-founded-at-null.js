module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'bodies',
        'founded_at',
        Sequelize.DATEONLY,
        { allowNull: true, defaultValue: null }
    ),
    down: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'bodies',
        'founded_at',
        Sequelize.DATEONLY,
        { allowNull: false, defaultValue: Sequelize.fn('NOW') }
    ),
};
