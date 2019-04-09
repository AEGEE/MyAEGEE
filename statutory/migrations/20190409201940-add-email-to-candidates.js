module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'candidates',
        'email',
        { type: Sequelize.STRING, allowNull: false, defaultValue: 'not-set@example.com' }
    ),
    down: queryInterface => queryInterface.removeColumn('candidates', 'email')
};
